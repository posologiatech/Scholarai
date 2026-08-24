import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from "../_shared/auth.ts";
import { checkPlanLimit, planLimitExceededResponse } from "../_shared/plan-limits.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Candidate {
  pmcid: string;
  doi?: string;
  title: string;
  journal?: string;
  year: number | null;
  url: string;
}

interface Figure {
  paper_id: null;
  doi: string | null;
  pmcid: string;
  source_paper_title: string;
  journal: string | null;
  year: number | null;
  paper_url: string;
  image_url: string;
  caption: string | null;
  figure_label: string | null;
  source: 'europe_pmc';
}

// ─── Find open-access, full-text-indexed candidates on Europe PMC ────────
async function searchEuropePMCCandidates(query: string, limit: number): Promise<Candidate[]> {
  try {
    const epmcQuery = `${query} AND OPEN_ACCESS:y AND IN_EPMC:y`;
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(epmcQuery)}&resultType=core&pageSize=${limit}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error('[search-paper-images] EuropePMC search status:', res.status);
      return [];
    }
    const data = await res.json();
    return (data.resultList?.result || [])
      .filter((r: any) => r.pmcid)
      .map((r: any) => ({
        pmcid: r.pmcid,
        doi: r.doi,
        title: r.title || '',
        journal: r.journalTitle,
        year: r.pubYear ? parseInt(r.pubYear) : null,
        url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
      }));
  } catch (e) {
    console.error('[search-paper-images] EuropePMC search error:', e);
    return [];
  }
}

// ─── Fetch raw full-text JATS XML (figures need the markup, not stripped text) ──
async function fetchFullTextXML(pmcid: string): Promise<string | null> {
  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    return xml && xml.length > 500 ? xml : null;
  } catch (e) {
    console.error(`[search-paper-images] fullTextXML error for ${pmcid}:`, e);
    return null;
  }
}

function stripInnerTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Extract <fig> blocks: label, caption, and graphic filename ──────────
function extractFigures(xml: string, candidate: Candidate): Figure[] {
  const figures: Figure[] = [];
  const figBlockRe = /<fig[^>]*>[\s\S]*?<\/fig>/g;
  const blocks = xml.match(figBlockRe) || [];

  for (const block of blocks.slice(0, 4)) {
    const labelMatch = block.match(/<label>([\s\S]*?)<\/label>/);
    const captionMatch = block.match(/<caption>([\s\S]*?)<\/caption>/);
    const hrefMatch = block.match(/<graphic[^>]+xlink:href="([^"]+)"/);
    if (!hrefMatch) continue;

    const filename = hrefMatch[1];
    figures.push({
      paper_id: null,
      doi: candidate.doi || null,
      pmcid: candidate.pmcid,
      source_paper_title: candidate.title,
      journal: candidate.journal || null,
      year: candidate.year,
      paper_url: candidate.url,
      image_url: `https://europepmc.org/articles/${candidate.pmcid}/bin/${filename}`,
      caption: captionMatch ? stripInnerTags(captionMatch[1]).slice(0, 1000) : null,
      figure_label: labelMatch ? stripInnerTags(labelMatch[1]) : null,
      source: 'europe_pmc',
    });
  }
  return figures;
}

async function lookupCachedFigures(supabase: ReturnType<typeof createClient>, pmcid: string): Promise<Figure[]> {
  const { data, error } = await supabase
    .from('paper_figures')
    .select('paper_id, doi, pmcid, source_paper_title, journal, year, paper_url, image_url, caption, figure_label, source')
    .eq('pmcid', pmcid);
  if (error) {
    console.error('[search-paper-images] cache lookup error:', error.message);
    return [];
  }
  return (data || []) as Figure[];
}

async function persistFigures(figures: Figure[]): Promise<void> {
  if (figures.length === 0) return;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from('paper_figures')
      .upsert(figures, { onConflict: 'pmcid,image_url', ignoreDuplicates: true });
    if (error) console.error('[search-paper-images] persist error:', error.message);
  } catch (e) {
    console.error('[search-paper-images] persist exception:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  if (!(await checkPlanLimit(auth.supabase, auth.userId, "search"))) {
    return planLimitExceededResponse(corsHeaders, "search");
  }

  try {
    const { query, limit = 40 } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidates = await searchEuropePMCCandidates(query, 15);
    const results: Figure[] = [];

    const batchSize = 3;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      await Promise.all(batch.map(async (candidate) => {
        const cached = await lookupCachedFigures(auth.supabase, candidate.pmcid);
        if (cached.length > 0) {
          results.push(...cached);
          return;
        }

        const xml = await fetchFullTextXML(candidate.pmcid);
        if (!xml) return;

        const figures = extractFigures(xml, candidate);
        if (figures.length === 0) return;

        await persistFigures(figures);
        results.push(...figures);
      }));
    }

    console.log(`[search-paper-images] Found ${results.length} figures from ${candidates.length} candidates for "${query}"`);

    return new Response(JSON.stringify({ figures: results.slice(0, limit), candidates: candidates.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[search-paper-images] error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
