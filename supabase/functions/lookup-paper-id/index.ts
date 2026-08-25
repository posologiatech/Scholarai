import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaperRef {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  journal: string | null;
  abstract: string | null;
  url: string | null;
  source: string;
}

const CROSSREF_HEADERS = { "User-Agent": "ScholarAI/1.0 (mailto:contact@scholarai.com)" };

function stripTags(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

async function lookupDoi(doi: string): Promise<PaperRef | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: CROSSREF_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const work = data.message;
      if (work?.title?.[0]) {
        const authors = (work.author || [])
          .map((a: any) => [a.given, a.family].filter(Boolean).join(" "))
          .filter(Boolean);
        const year =
          work["published-print"]?.["date-parts"]?.[0]?.[0] ??
          work["published-online"]?.["date-parts"]?.[0]?.[0] ??
          work.issued?.["date-parts"]?.[0]?.[0] ??
          null;
        return {
          title: work.title[0],
          authors,
          year,
          doi,
          journal: work["container-title"]?.[0] || null,
          abstract: stripTags(work.abstract),
          url: work.URL || `https://doi.org/${doi}`,
          source: "doi",
        };
      }
    }
  } catch (e) {
    console.error("[lookup-paper-id] Crossref error:", e);
  }
  // Fallback: Europe PMC also indexes DOIs, sometimes with an abstract Crossref lacks.
  return lookupEuropePmc(`DOI:"${doi}"`, "doi");
}

async function lookupEuropePmc(query: string, source: string): Promise<PaperRef | null> {
  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.resultList?.result?.[0];
    if (!r || !r.title) return null;
    return {
      title: r.title,
      authors: (r.authorString || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      year: r.pubYear ? parseInt(r.pubYear, 10) : null,
      doi: r.doi || null,
      journal: r.journalTitle || null,
      abstract: r.abstractText || null,
      url: r.doi ? `https://doi.org/${r.doi}` : r.fullTextUrlList?.fullTextUrl?.[0]?.url || null,
      source,
    };
  } catch (e) {
    console.error("[lookup-paper-id] Europe PMC error:", e);
    return null;
  }
}

async function lookupPmid(pmid: string): Promise<PaperRef | null> {
  return lookupEuropePmc(`EXT_ID:${pmid} AND SRC:MED`, "pmid");
}

async function lookupArxiv(id: string): Promise<PaperRef | null> {
  try {
    const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
    if (!entry) return null;
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim();
    if (!title) return null;
    const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() || null;
    const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1];
    const year = published ? parseInt(published.slice(0, 4), 10) : null;
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => m[1].trim());
    const doi = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/)?.[1]?.trim() || null;
    return {
      title,
      authors,
      year,
      doi,
      journal: "arXiv",
      abstract: summary,
      url: `https://arxiv.org/abs/${id}`,
      source: "arxiv",
    };
  } catch (e) {
    console.error("[lookup-paper-id] arXiv error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { idType, value } = await req.json();
    const cleaned = String(value || "").trim();
    if (!cleaned || !["doi", "pmid", "arxiv"].includes(idType)) {
      return new Response(JSON.stringify({ error: "Invalid idType or value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let paper: PaperRef | null = null;
    if (idType === "doi") paper = await lookupDoi(cleaned);
    else if (idType === "pmid") paper = await lookupPmid(cleaned);
    else if (idType === "arxiv") paper = await lookupArxiv(cleaned);

    if (!paper) {
      return new Response(JSON.stringify({ error: "No paper found for this identifier" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ paper }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lookup-paper-id] error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
