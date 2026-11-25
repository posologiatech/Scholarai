// review-harvest: fetches ONE page of results from an open source for a review's search.
//
// Why this is not search-papers: that function translates the query to English (which corrupts a
// Boolean string), caps the total, merges across sources and writes to the shared papers table.
// A review needs the query sent exactly as written, every hit paged through, and nothing hidden.
// This function stores nothing: the client inserts the records under the user's own RLS and logs
// the search, so a failed page never leaves half-written state on the server.
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGE = 100;
const UA_MAIL = "scholarai@research.app";

interface Rec {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  doi: string | null;
  url: string | null;
  journal: string | null;
  studyType: string | null;
}
interface Page { records: Rec[]; total: number | null; next: string | null }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const toYear = (v: unknown): number | null => {
  const n = parseInt(String(v ?? "").slice(0, 4), 10);
  return Number.isFinite(n) && n > 1000 ? n : null;
};

class NeedsKey extends Error {
  constructor(public source: string) { super(`${source} needs an API key for this volume`); }
}

class UpstreamError extends Error {
  constructor(public status: number) { super(`upstream ${status}`); }
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new UpstreamError(res.status);
  return res.json();
}

// ─── PubMed: esearch with the history server, then efetch pages from it ───
async function pubmed(query: string, cursor: string | null): Promise<Page> {
  let webenv: string, queryKey: string, start: number, total: number;
  if (!cursor) {
    const s = await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&usehistory=y&retmax=0&retmode=json`);
    const r = s.esearchresult;
    if (r?.ERROR) throw new Error(`PubMed rejected the query: ${r.ERROR}`);
    webenv = r.webenv; queryKey = r.querykey; total = parseInt(r.count, 10) || 0; start = 0;
  } else {
    // cursor = webenv|queryKey|start|total, produced by the previous page
    const [w, k, st, tt] = cursor.split("|");
    webenv = w; queryKey = k; start = parseInt(st, 10); total = parseInt(tt, 10);
  }
  if (total === 0 || start >= total) return { records: [], total, next: null };

  const xmlRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&query_key=${queryKey}&WebEnv=${encodeURIComponent(webenv)}&retstart=${start}&retmax=${PAGE}&retmode=xml`);
  if (!xmlRes.ok) throw new Error(`upstream ${xmlRes.status}`);
  const xml = await xmlRes.text();
  const records: Rec[] = [];
  for (const block of xml.split(/<Pubmed(?:Book)?Article>/).slice(1)) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const title = strip(block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? block.match(/<BookTitle[^>]*>([\s\S]*?)<\/BookTitle>/)?.[1] ?? "");
    const abstract = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => strip(m[1])).join(" ");
    const authors = [...block.matchAll(/<Author[ >][\s\S]*?<\/Author>/g)].map((m) => {
      const last = m[0].match(/<LastName>([^<]*)<\/LastName>/)?.[1] ?? m[0].match(/<CollectiveName>([^<]*)<\/CollectiveName>/)?.[1];
      const ini = m[0].match(/<Initials>([^<]*)<\/Initials>/)?.[1];
      return last ? (ini ? `${last}, ${ini}` : last) : "";
    }).filter(Boolean);
    const doi = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)?.[1] ?? null;
    const journal = strip(block.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] ?? "") || null;
    const year = toYear(block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ?? block.match(/<MedlineDate>(\d{4})/)?.[1]);
    const types = [...block.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g)].map((m) => m[1]);
    records.push({ id: `pmid_${pmid}`, title, authors, year, abstract: abstract || null, doi, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, journal, studyType: types[0] ?? null });
  }
  const nextStart = start + PAGE;
  return { records, total, next: nextStart < total ? `${webenv}|${queryKey}|${nextStart}|${total}` : null };
}

// ─── Europe PMC: cursorMark ───
async function europePmc(query: string, cursor: string | null): Promise<Page> {
  const d = await getJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${PAGE}&cursorMark=${encodeURIComponent(cursor ?? "*")}&resultType=core`);
  const list: any[] = d.resultList?.result ?? [];
  const records = list.map((r) => ({
    id: `${(r.source ?? "src").toLowerCase()}_${r.id}`,
    title: strip(r.title ?? ""),
    authors: r.authorString ? String(r.authorString).replace(/\.$/, "").split(", ") : [],
    year: toYear(r.pubYear),
    abstract: r.abstractText ? strip(r.abstractText) : null,
    doi: r.doi ?? null,
    url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : r.doi ? `https://doi.org/${r.doi}` : null,
    journal: r.journalTitle ?? null,
    studyType: r.pubTypeList?.pubType?.[0] ?? null,
  }));
  const nextC = d.nextCursorMark && d.nextCursorMark !== (cursor ?? "*") && list.length === PAGE ? d.nextCursorMark : null;
  return { records, total: d.hitCount ?? null, next: nextC };
}

// ─── OpenAlex: cursor paging. A key is needed for volume (shared free budget otherwise) ───
function invertedToText(inv: Record<string, number[]> | null | undefined): string | null {
  if (!inv) return null;
  const words: string[] = [];
  for (const [w, pos] of Object.entries(inv)) for (const p of pos) words[p] = w;
  return words.filter(Boolean).join(" ") || null;
}
async function openalex(query: string, cursor: string | null): Promise<Page> {
  const key = Deno.env.get("OPENALEX_API_KEY");
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${PAGE}&cursor=${encodeURIComponent(cursor ?? "*")}&select=id,doi,title,publication_year,authorships,primary_location,abstract_inverted_index,type&mailto=${UA_MAIL}${key ? `&api_key=${key}` : ""}`;
  let d: any;
  try { d = await getJson(url); }
  catch (e) {
    // Without a key OpenAlex serves a small shared daily budget; paging deep runs out of it.
    if (e instanceof UpstreamError && [401, 403, 429].includes(e.status)) throw new NeedsKey("openalex");
    throw e;
  }
  const records = (d.results ?? []).map((w: any) => ({
    id: String(w.id ?? "").replace("https://openalex.org/", "oa_"),
    title: strip(w.title ?? ""),
    authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
    year: toYear(w.publication_year),
    abstract: invertedToText(w.abstract_inverted_index),
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, "") : null,
    url: w.primary_location?.landing_page_url ?? w.doi ?? null,
    journal: w.primary_location?.source?.display_name ?? null,
    studyType: w.type ?? null,
  }));
  return { records, total: d.meta?.count ?? null, next: d.meta?.next_cursor ?? null };
}

// ─── ClinicalTrials.gov v2: pageToken ───
async function clinicalTrials(query: string, cursor: string | null): Promise<Page> {
  const d = await getJson(`https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=${PAGE}&countTotal=true${cursor ? `&pageToken=${encodeURIComponent(cursor)}` : ""}`);
  const records = (d.studies ?? []).map((s: any) => {
    const p = s.protocolSection ?? {};
    const nct = p.identificationModule?.nctId ?? "";
    return {
      id: `ct_${nct}`,
      title: p.identificationModule?.briefTitle ?? p.identificationModule?.officialTitle ?? "",
      authors: p.sponsorCollaboratorsModule?.leadSponsor?.name ? [p.sponsorCollaboratorsModule.leadSponsor.name] : [],
      year: toYear(p.statusModule?.startDateStruct?.date),
      abstract: p.descriptionModule?.briefSummary ?? null,
      doi: null,
      url: nct ? `https://clinicaltrials.gov/study/${nct}` : null,
      journal: "ClinicalTrials.gov",
      studyType: p.designModule?.studyType ?? "Trial",
    };
  });
  return { records, total: d.totalCount ?? null, next: d.nextPageToken ?? null };
}

// ─── BDTD (VuFind): page numbers ───
async function bdtd(query: string, cursor: string | null): Promise<Page> {
  const page = cursor ? parseInt(cursor, 10) : 1;
  const f = ["id", "title", "authors", "publicationDates", "summary", "urls", "formats"].map((x) => `field%5B%5D=${x}`).join("&");
  const d = await getJson(`https://bdtd.ibict.br/vufind/api/v1/search?lookfor=${encodeURIComponent(query)}&limit=${PAGE}&page=${page}&${f}`);
  const records = (d.records ?? []).map((r: any) => ({
    id: `bdtd_${r.id}`,
    title: strip(r.title ?? ""),
    authors: Object.keys(r.authors?.primary ?? {}),
    year: toYear(r.publicationDates?.[0]),
    abstract: r.summary?.[0] ? strip(r.summary[0]) : null,
    doi: null,
    url: r.urls?.[0]?.url ?? null,
    journal: null,
    studyType: r.formats?.[0] ?? "thesis",
  }));
  const total = d.resultCount ?? null;
  return { records, total, next: total != null && page * PAGE < total ? String(page + 1) : null };
}

const SOURCES: Record<string, (q: string, c: string | null) => Promise<Page>> = {
  pubmed, europe_pmc: europePmc, openalex, clinical_trials: clinicalTrials, bdtd,
};

// Exposed for the smoke test in scratch; the edge runtime ignores extra exports.
export const __sources = SOURCES;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { reviewId, source, query, cursor = null } = await req.json();
    if (typeof reviewId !== "string" || typeof source !== "string" || typeof query !== "string" || !query.trim()) {
      return json({ error: "reviewId, source and query are required" }, 400);
    }
    const run = SOURCES[source];
    if (!run) return json({ error: `unsupported source: ${source}` }, 400);

    // Only people on the review may spend upstream quota on its behalf.
    const { data: allowed, error: accessError } = await auth.supabase.rpc("can_access_review", { _user_id: auth.userId, _review_id: reviewId });
    if (accessError || allowed !== true) return json({ error: "forbidden" }, 403);

    const page = await run(query.trim(), typeof cursor === "string" && cursor ? cursor : null);
    return json({ source, ...page });
  } catch (e) {
    if (e instanceof NeedsKey) return json({ error: e.message, code: "source_requires_key", source: e.source }, 429);
    console.error("[review-harvest]", e);
    return json({ error: e instanceof Error ? e.message : "harvest failed" }, 502);
  }
});
