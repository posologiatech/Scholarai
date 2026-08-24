import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkPlanLimit, planLimitExceededResponse } from "../_shared/plan-limits.ts";
import { trackUsage } from "../_shared/usage-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  doi?: string;
  journal?: string;
  citationCount?: number;
}

interface S2Ref {
  paperId?: string;
  title?: string;
  year?: number;
  externalIds?: { DOI?: string };
}

interface S2PaperDetail {
  paperId: string;
  title: string;
  year: number | null;
  citationCount: number;
  externalIds?: { DOI?: string };
  references: S2Ref[];
  citations: S2Ref[];
}

const normalizeDoi = (doi?: string | null): string | null => {
  if (!doi) return null;
  return doi.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
};

// Real bibliographic data from Semantic Scholar's Graph API — this is what actually makes
// a "connected papers" graph mean something. It replaces an earlier version of this
// function that asked an LLM to *invent* similarity scores and edges from abstracts alone,
// which produced a graph that looked like a real citation map but wasn't one.
async function fetchS2Paper(doi: string): Promise<S2PaperDetail | null> {
  try {
    const fields = "paperId,title,year,citationCount,externalIds,references.title,references.year,references.externalIds,citations.title,citations.year,citations.externalIds";
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=${fields}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      paperId: data.paperId,
      title: data.title,
      year: data.year ?? null,
      citationCount: data.citationCount ?? 0,
      externalIds: data.externalIds,
      references: data.references || [],
      citations: data.citations || [],
    };
  } catch (e) {
    console.error(`Semantic Scholar lookup failed for DOI ${doi}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  if (!(await checkPlanLimit(auth.supabase, auth.userId, "knowledge_graph"))) {
    return planLimitExceededResponse(corsHeaders, "knowledge_graph");
  }

  try {
    const { papers, query, locale = "en" } = await req.json();

    if (!papers?.length) {
      return new Response(JSON.stringify({ error: "No papers provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inputPapers: Paper[] = papers.slice(0, 20);

    // Map normalized DOI -> index in inputPapers, so we can tell whether a real citation
    // Semantic Scholar reports actually lands on another paper in this set.
    const doiToIndex = new Map<string, number>();
    inputPapers.forEach((p, i) => {
      const d = normalizeDoi(p.doi);
      if (d) doiToIndex.set(d, i);
    });

    // Fetch real reference/citation data for every paper that has a DOI, in small
    // concurrent batches to stay within Semantic Scholar's unauthenticated rate limit.
    const details: (S2PaperDetail | null)[] = new Array(inputPapers.length).fill(null);
    const BATCH = 5;
    for (let i = 0; i < inputPapers.length; i += BATCH) {
      const batch = inputPapers.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((p) => {
          const doi = normalizeDoi(p.doi);
          return doi ? fetchS2Paper(doi) : Promise.resolve(null);
        })
      );
      results.forEach((r, j) => { details[i + j] = r; });
    }

    // Build real edges from direct citation relationships found within this set of papers
    // — "A references B" or "A is cited by B" where both A and B are papers we're graphing.
    // No edge is ever invented; a paper with no resolvable DOI or no in-set citations is
    // still included as a node, just without fabricated connections.
    const edgeSet = new Map<string, number>(); // "i-j" (i<j) -> weight
    const addEdge = (i: number, j: number, w: number) => {
      if (i === j) return;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      edgeSet.set(key, Math.max(edgeSet.get(key) || 0, w));
    };

    const refDoiSets: Set<string>[] = inputPapers.map(() => new Set<string>());
    details.forEach((d, i) => {
      if (!d) return;
      for (const ref of d.references) {
        const rd = normalizeDoi(ref.externalIds?.DOI);
        if (rd) refDoiSets[i].add(rd);
        if (rd && doiToIndex.has(rd)) addEdge(i, doiToIndex.get(rd)!, 60);
      }
      for (const cit of d.citations) {
        const cd = normalizeDoi(cit.externalIds?.DOI);
        if (cd && doiToIndex.has(cd)) addEdge(i, doiToIndex.get(cd)!, 60);
      }
    });

    // Bibliographic coupling as the similarity score to the origin paper (p0): the real
    // fraction of shared references between each paper and the origin — the same metric
    // Connected Papers itself uses, computed here rather than guessed by an LLM.
    const originRefs = refDoiSets[0];
    const similarities: (number | null)[] = inputPapers.map((_, i) => {
      if (i === 0) return 100;
      const refs = refDoiSets[i];
      if (!details[i] || refs.size === 0 || originRefs.size === 0) return null; // no data — don't guess
      let shared = 0;
      for (const d of refs) if (originRefs.has(d)) shared++;
      const denom = Math.min(refs.size, originRefs.size) || 1;
      return Math.round((shared / denom) * 100);
    });

    // Strengthen coupling-based edges using the same shared-reference signal, on top of
    // (not instead of) direct citation edges already found above — addEdge keeps the max.
    for (let i = 1; i < inputPapers.length; i++) {
      const sim = similarities[i];
      if (sim !== null && sim >= 20) addEdge(0, i, sim);
    }

    const nodes = inputPapers.map((p, i) => ({
      id: `p${i}`,
      label: p.title.slice(0, 60),
      year: details[i]?.year ?? p.year ?? null,
      citationCount: details[i]?.citationCount ?? p.citationCount ?? null,
      paperIndex: i,
      similarity: similarities[i],
      hasRealCitationData: !!details[i],
    }));

    const edges = Array.from(edgeSet.entries()).map(([key, weight]) => {
      const [s, t] = key.split("-").map(Number);
      return { source: `p${s}`, target: `p${t}`, weight };
    });

    // Prior/derivative works determined from the origin paper's REAL reference and
    // citation lists — not inferred from publication year proximity or LLM guesswork.
    const origin = details[0];
    const priorWorks: number[] = [];
    const derivativeWorks: number[] = [];
    if (origin) {
      const originCitedByDois = new Set(
        origin.citations.map((c) => normalizeDoi(c.externalIds?.DOI)).filter((d): d is string => !!d)
      );
      inputPapers.forEach((p, i) => {
        if (i === 0) return;
        const d = normalizeDoi(p.doi);
        if (!d) return;
        if (originRefs.has(d)) priorWorks.push(i);
        else if (originCitedByDois.has(d)) derivativeWorks.push(i);
      });
    }

    // TL;DR summaries: legitimate use of an LLM (summarizing text that's actually in
    // front of it), unlike the graph structure above — kept separate on purpose.
    const papersSummary = inputPapers.map((p, i) =>
      `[${i}] "${p.title}"\nAbstract: ${(p.abstract || "").slice(0, 300)}`
    ).join("\n\n");

    let tldrs: Record<number, string> = {};
    try {
      const tldrResponse = await callAI({
        _userId: auth.userId,
        _promptType: "knowledge_graph",
        messages: [
          {
            role: "system",
            content: `Summarize each paper's abstract in one short sentence (TL;DR), in ${locale === "pt" ? "Brazilian Portuguese" : "English"}. Return ONLY JSON: {"tldrs": {"0": "...", "1": "..."}} keyed by the paper index.`,
          },
          { role: "user", content: papersSummary },
        ],
        model: "google/gemini-3-flash-preview",
      });
      if (tldrResponse.ok) {
        const tldrData = await tldrResponse.json();
        const content = tldrData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) tldrs = JSON.parse(jsonMatch[0]).tldrs || {};
      }
    } catch (e) {
      console.error("TL;DR generation failed (non-fatal):", e);
    }

    const nodesWithTldr = nodes.map((n) => ({ ...n, tldr: tldrs[n.paperIndex] || "" }));

    trackUsage(auth.userId, "knowledge_graph").catch((e) => console.error("usage tracking error:", e));

    return new Response(
      JSON.stringify({ nodes: nodesWithTldr, edges, priorWorks, derivativeWorks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-knowledge-graph error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
