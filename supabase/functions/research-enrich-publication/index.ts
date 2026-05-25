import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { publication_id, doi } = await req.json();
    if (!publication_id || !doi) return new Response(JSON.stringify({ error: 'publication_id and doi required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const cleanDoi = String(doi).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // OpenAlex
    let openalex_id: string | null = null;
    let citations_count = 0;
    let authors: string[] = [];
    let abstract: string | null = null;
    try {
      const r = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`);
      if (r.ok) {
        const w = await r.json();
        openalex_id = w.id ?? null;
        citations_count = w.cited_by_count ?? 0;
        authors = (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean);
        if (w.abstract_inverted_index) {
          const idx = w.abstract_inverted_index as Record<string, number[]>;
          const positions: { w: string; p: number }[] = [];
          for (const [word, ps] of Object.entries(idx)) ps.forEach(p => positions.push({ w: word, p }));
          positions.sort((a, b) => a.p - b.p);
          abstract = positions.map(x => x.w).join(' ');
        }
      }
    } catch (_) {}

    // Altmetric (public, sem chave)
    let altmetric_score: number | null = null;
    let altmetric_url: string | null = null;
    try {
      const r = await fetch(`https://api.altmetric.com/v1/doi/${encodeURIComponent(cleanDoi)}`);
      if (r.ok) {
        const a = await r.json();
        altmetric_score = a.score ?? null;
        altmetric_url = a.details_url ?? null;
      }
    } catch (_) {}

    const update: Record<string, unknown> = {
      openalex_id,
      citations_count,
      altmetric_score,
      altmetric_url,
      enriched_at: new Date().toISOString(),
    };
    if (authors.length) update.authors = authors;
    if (abstract) update.abstract = abstract;

    const { error } = await supabase.from('research_publications').update(update).eq('id', publication_id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, ...update }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
