import { requireAuth } from "../_shared/auth.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Normalized word-overlap similarity (Jaccard over lowercased tokens, punctuation stripped).
// Cheap and dependency-free, but enough to tell "same paper, different formatting" apart
// from "different paper" or "AI hallucinated a plausible-sounding but nonexistent title".
function titleSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const setA = tokenize(a || '');
  const setB = tokenize(b || '');
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / Math.min(setA.size, setB.size);
}

// Search CrossRef's bibliographic index for a real work matching this reference's
// title/authors. Returns the best match's DOI+title if confident, otherwise null.
async function findRealMatch(ref: any): Promise<{ doi: string; title: string } | null> {
  const query = `${ref.title || ''} ${ref.authors || ''}`.trim();
  if (!query) return null;
  try {
    const res = await fetch(
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=3`,
      { headers: { 'User-Agent': 'ScholarAI/1.0 (mailto:contact@scholarai.com)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.message?.items || [];
    for (const item of items) {
      const itemTitle = item.title?.[0] || '';
      if (ref.title && titleSimilarity(ref.title, itemTitle) >= 0.6) {
        return { doi: item.DOI, title: itemTitle };
      }
    }
    return null;
  } catch (e) {
    console.error('CrossRef bibliographic search failed:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { text, references } = await req.json();

    if (!text && (!references || !Array.isArray(references))) {
      return new Response(JSON.stringify({ error: 'text or references array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Extract references from text if not provided
    let refsToCheck = references || [];

    if (text && !references) {
      try {
        const extractResponse = await callAI({
          _userId: auth.userId,
          _promptType: "check_references",
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a reference extractor for scientific manuscripts. Extract all bibliographic references from the text provided. For each reference, extract the authors, year, title, and DOI if available.`,
            },
            {
              role: 'user',
              content: `Extract all references from this manuscript text:\n\n${text.slice(0, 30000)}`,
            },
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'extract_references',
              description: 'Return all references found in the manuscript',
              parameters: {
                type: 'object',
                properties: {
                  references: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        authors: { type: 'string' },
                        year: { type: 'string' },
                        title: { type: 'string' },
                        doi: { type: 'string' },
                        raw_text: { type: 'string', description: 'The full reference text as it appears' },
                      },
                      required: ['raw_text'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['references'],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: 'function', function: { name: 'extract_references' } },
        } as any);

        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const result = JSON.parse(toolCall.function.arguments);
            refsToCheck = result.references || [];
          }
        }
      } catch (aiErr) {
        console.error('Reference extraction AI call failed:', aiErr);
      }
    }

    if (refsToCheck.length === 0) {
      return new Response(JSON.stringify({ references: [], message: 'No references found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Check each reference for retractions/contestations
    // First try CrossRef/Retraction Watch via DOI
    const checkedRefs: any[] = [];

    for (const ref of refsToCheck) {
      const refResult: any = {
        ...ref,
        status: 'unverified',
        issues: [],
      };

      let existsVerified = false;
      let isRetracted = false;

      // Check if we have citation data in our database
      if (ref.title) {
        const { data: chunks } = await supabase
          .from('paper_chunks')
          .select('paper_id')
          .ilike('paper_title', `%${ref.title.slice(0, 50)}%`)
          .limit(1);

        if (chunks && chunks.length > 0) {
          const paperId = chunks[0].paper_id;

          // Check citation classifications
          const { data: classifications } = await supabase
            .from('citation_classifications')
            .select('classification, citation_context')
            .eq('cited_paper_id', paperId);

          if (classifications && classifications.length > 0) {
            const contrasting = classifications.filter(c => c.classification === 'contrasting');
            const supporting = classifications.filter(c => c.classification === 'supporting');

            if (contrasting.length > supporting.length && contrasting.length >= 3) {
              refResult.status = 'warning';
              refResult.issues.push({
                type: 'heavily_contested',
                message: `This paper has been contested by ${contrasting.length} other studies`,
                contexts: contrasting.slice(0, 3).map(c => c.citation_context),
              });
            }

            refResult.citation_stats = {
              supporting: supporting.length,
              contrasting: contrasting.length,
              mentioning: classifications.filter(c => c.classification === 'mentioning').length,
            };
          }
        }
      }

      // Resolve the DOI at CrossRef — this is what actually confirms the paper exists,
      // not just that a DOI-shaped string was attached to it. A DOI that fails to
      // resolve, or resolves to a different paper than the one cited, is exactly the
      // AI-hallucination pattern this check exists to catch.
      if (ref.doi) {
        try {
          const crResponse = await fetch(`https://api.crossref.org/works/${encodeURIComponent(ref.doi)}`, {
            headers: { 'User-Agent': 'ScholarAI/1.0 (mailto:contact@scholarai.com)' },
          });
          if (crResponse.ok) {
            const crData = await crResponse.json();
            const work = crData.message;
            const resolvedTitle = work?.title?.[0] || '';

            if (ref.title && resolvedTitle && titleSimilarity(ref.title, resolvedTitle) < 0.4) {
              refResult.issues.push({
                type: 'doi_title_mismatch',
                message: `O DOI informado resolve para um título diferente ("${resolvedTitle}") do citado ("${ref.title}") — DOI trocado ou referência incorreta.`,
              });
            } else {
              existsVerified = true;
            }

            const updateTo = work?.['update-to'];
            if (updateTo) {
              const retraction = updateTo.find((u: any) => u.label === 'Retraction' || u.type === 'retraction');
              if (retraction) {
                isRetracted = true;
                refResult.issues.push({
                  type: 'retracted',
                  message: 'This paper has been RETRACTED',
                  doi: retraction.DOI,
                });
              }
            }
          } else if (crResponse.status === 404) {
            refResult.issues.push({
              type: 'doi_not_found',
              message: `O DOI "${ref.doi}" não foi encontrado no Crossref — pode ser inválido ou inventado.`,
            });
          }
        } catch (e) {
          console.error('CrossRef check failed for DOI:', ref.doi, e);
        }
      }

      // No DOI, or the DOI didn't check out — try to find a real matching work by
      // title/authors before giving up. Only a confident title match counts as verified;
      // silence or a failed lookup must never default back to "ok".
      if (!existsVerified && ref.title) {
        const match = await findRealMatch(ref);
        if (match) {
          existsVerified = true;
          refResult.matched_doi = match.doi;
        }
      }

      if (isRetracted) {
        refResult.status = 'retracted';
      } else if (!existsVerified) {
        refResult.status = 'unverified';
        refResult.issues.push({
          type: 'not_found',
          message: 'Não foi possível confirmar que esta referência existe em bases bibliográficas reais (CrossRef). Pode ser uma citação inventada pela IA — verifique manualmente antes de submeter.',
        });
      } else if (refResult.issues.length > 0) {
        refResult.status = 'warning';
      } else {
        refResult.status = 'ok';
      }

      checkedRefs.push(refResult);
    }

    const summary = {
      total: checkedRefs.length,
      ok: checkedRefs.filter(r => r.status === 'ok').length,
      warning: checkedRefs.filter(r => r.status === 'warning').length,
      unverified: checkedRefs.filter(r => r.status === 'unverified').length,
      retracted: checkedRefs.filter(r => r.status === 'retracted').length,
    };

    return new Response(JSON.stringify({ references: checkedRefs, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('check-references error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
