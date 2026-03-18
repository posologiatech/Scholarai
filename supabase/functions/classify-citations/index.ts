import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CitingPaper {
  id: string;
  title: string;
  abstract?: string;
  year?: number;
  authors?: string[];
}

interface ParsedCitation {
  cited_paper_id: string;
  classification: string;
  citation_context: string;
  confidence: number;
  section: string;
}

async function fetchCitingPapersFromOpenAlex(doi: string, externalId: string): Promise<CitingPaper[]> {
  const papers: CitingPaper[] = [];

  try {
    let oaWorkId = '';
    if (doi) {
      const lookupResp = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`, {
        headers: { 'User-Agent': 'ArcaResearch/1.0 (mailto:contact@arca.research)' }
      });
      if (lookupResp.ok) {
        const work = await lookupResp.json();
        oaWorkId = work.id;
      }
    }

    if (!oaWorkId && externalId) {
      const searchResp = await fetch(`https://api.openalex.org/works?filter=openalex_id:${externalId}`, {
        headers: { 'User-Agent': 'ArcaResearch/1.0 (mailto:contact@arca.research)' }
      });
      if (searchResp.ok) {
        const data = await searchResp.json();
        if (data.results?.[0]?.id) oaWorkId = data.results[0].id;
      }
    }

    if (oaWorkId) {
      let cursor = '*';
      let hasMore = true;
      const maxPages = 5; // Cap at 1000 citing papers
      let page = 0;
      while (hasMore && page < maxPages) {
        page++;
        const citesResp = await fetch(
          `https://api.openalex.org/works?filter=cites:${oaWorkId}&per_page=200&cursor=${cursor}&sort=cited_by_count:desc`,
          { headers: { 'User-Agent': 'ArcaResearch/1.0 (mailto:contact@arca.research)' } }
        );
        if (!citesResp.ok) break;
        
        const citesData = await citesResp.json();
        const results = citesData.results || [];
        if (results.length === 0) break;

        for (const work of results) {
          papers.push({
            id: work.id?.replace('https://openalex.org/', '') || work.doi || `oa-${Math.random()}`,
            title: work.title || 'Unknown',
            abstract: work.abstract_inverted_index
              ? reconstructAbstract(work.abstract_inverted_index)
              : undefined,
            year: work.publication_year,
            authors: work.authorships?.map((a: any) => a.author?.display_name).filter(Boolean).slice(0, 3),
          });
        }

        const nextCursor = citesData.meta?.next_cursor;
        if (nextCursor && results.length === 200) {
          cursor = nextCursor;
        } else {
          hasMore = false;
        }
      }
      console.log(`OpenAlex: fetched ${papers.length} citing papers total`);
    }
  } catch (err) {
    console.error('OpenAlex fetch error:', err);
  }

  // Fallback: Semantic Scholar
  if (papers.length === 0 && (doi || externalId)) {
    try {
      const paperId = doi ? `DOI:${doi}` : externalId;
      const ssResp = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}/citations?fields=title,abstract,year,authors&limit=1000`
      );
      if (ssResp.ok) {
        const ssData = await ssResp.json();
        for (const item of (ssData.data || [])) {
          const cp = item.citingPaper;
          if (!cp?.title) continue;
          papers.push({
            id: cp.paperId || `ss-${Math.random()}`,
            title: cp.title,
            abstract: cp.abstract || undefined,
            year: cp.year,
            authors: cp.authors?.map((a: any) => a.name).slice(0, 3),
          });
        }
      }
    } catch (err) {
      console.error('Semantic Scholar fetch error:', err);
    }
  }

  return papers;
}

function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of (positions as number[])) {
      words.push([word, pos]);
    }
  }
  words.sort((a, b) => a[1] - b[1]);
  return words.map(w => w[0]).join(' ');
}

/**
 * Extract citations from AI response - tries tool_calls first, then JSON from content
 */
function extractCitationsFromResponse(data: any): ParsedCitation[] {
  // Try tool_calls first (preferred)
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const result = JSON.parse(toolCall.function.arguments);
      if (result.citations?.length) {
        console.log(`[classify] Extracted ${result.citations.length} citations via tool_calls`);
        return result.citations;
      }
    } catch (e) {
      console.error('[classify] Failed to parse tool_calls arguments:', e);
    }
  }

  // Fallback: try parsing JSON from message content
  const content = data.choices?.[0]?.message?.content;
  if (content) {
    console.log('[classify] No tool_calls, trying content fallback. Content preview:', content.slice(0, 200));
    
    // Try to find JSON array in content
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[classify] Extracted ${parsed.length} citations from content JSON`);
          return parsed;
        }
      } catch { /* ignore */ }
    }

    // Try to find JSON object with citations key
    const objMatch = content.match(/\{[\s\S]*"citations"[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed.citations?.length) {
          console.log(`[classify] Extracted ${parsed.citations.length} citations from content object`);
          return parsed.citations;
        }
      } catch { /* ignore */ }
    }
  }

  console.warn('[classify] Could not extract citations from response. Keys:', Object.keys(data.choices?.[0]?.message || {}));
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { paper_id, paper_title, paper_abstract, paper_doi, papers } = await req.json();
    const papersToClassify = papers || (paper_id ? [{ id: paper_id, title: paper_title, abstract: paper_abstract, doi: paper_doi }] : []);

    if (papersToClassify.length === 0) {
      return new Response(JSON.stringify({ error: 'paper_id or papers array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const allClassifications: any[] = [];

    for (const paper of papersToClassify) {
      // Check if already classified
      const { data: existing } = await supabase
        .from('citation_classifications').select('id').eq('paper_id', paper.id).limit(1);
      if (existing && existing.length > 0) {
        console.log(`[classify] Paper ${paper.id} already classified, skipping`);
        continue;
      }

      // Get DOI from DB if not provided
      let doi = paper.doi || '';
      if (!doi) {
        const { data: paperRow } = await supabase
          .from('papers').select('doi')
          .eq('external_id', paper.id).maybeSingle();
        doi = paperRow?.doi || '';
      }

      // Fetch citing papers from external APIs
      console.log(`[classify] Fetching citing papers for: ${paper.title} (DOI: ${doi})`);
      const citingPapers = await fetchCitingPapersFromOpenAlex(doi, paper.id);
      console.log(`[classify] Found ${citingPapers.length} citing papers`);

      if (citingPapers.length === 0) {
        // Fallback: try to classify from paper's own text
        const { data: chunks } = await supabase
          .from('paper_chunks').select('chunk_text')
          .eq('paper_id', paper.id).order('chunk_index');

        let fullText = chunks?.map(c => c.chunk_text).join('\n\n') || '';
        if (!fullText) {
          fullText = `Title: ${paper.title}\n\nAbstract: ${paper.abstract || ''}`;
        }

        if (fullText.length < 100) {
          console.log(`[classify] Text too short for ${paper.id}, skipping`);
          continue;
        }

        console.log(`[classify] Using text-based classification for ${paper.id}`);
        const response = await callAI({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: `You are a citation classifier. Analyze the text and identify any references to other works. Classify each as supporting, contrasting, or mentioning. Return a JSON object with a "citations" array.` },
            { role: 'user', content: `Analyze citations in:\n\n${fullText.slice(0, 15000)}\n\nReturn JSON: {"citations": [{"cited_paper_id": "...", "classification": "supporting|contrasting|mentioning", "citation_context": "...", "confidence": 0.8, "section": "Introduction|Methods|Results|Discussion|Conclusion|Other"}]}` },
          ],
          temperature: 0.2,
        });

        if (response.ok) {
          const data = await response.json();
          const citations = extractCitationsFromResponse(data);
          for (const c of citations) {
            const record = {
              paper_id: paper.id,
              cited_paper_id: c.cited_paper_id || 'unknown',
              classification: c.classification,
              citation_context: c.citation_context || '',
              confidence: c.confidence || 0.8,
              section: c.section || 'Other',
            };
            const { error: insertErr } = await supabase.from('citation_classifications').insert(record);
            if (insertErr) {
              console.error('[classify] Insert error:', insertErr);
            } else {
              allClassifications.push(record);
            }
          }
        } else {
          console.error(`[classify] AI call failed for text-based: ${response.status}`);
        }
        continue;
      }

      // Process citing papers in batches of 10 for AI classification
      const batchSize = 10;
      for (let i = 0; i < citingPapers.length; i += batchSize) {
        const batch = citingPapers.slice(i, i + batchSize);
        console.log(`[classify] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(citingPapers.length / batchSize)} (${batch.length} papers)`);

        const batchText = batch.map((cp, idx) => {
          const authorStr = cp.authors?.join(', ') || 'Unknown authors';
          return `[${idx + 1}] "${cp.title}" (${authorStr}, ${cp.year || 'n.d.'})\nAbstract: ${(cp.abstract || 'No abstract available').slice(0, 500)}`;
        }).join('\n\n---\n\n');

        const systemPrompt = `You are a citation context classifier for scientific papers.
You are given the TARGET paper: "${paper.title}"
And a list of papers that CITE the target paper.

For each citing paper, based on its abstract and title, classify HOW it cites the target paper:
- "supporting": builds upon, validates, or agrees with the target paper's findings
- "contrasting": challenges, contradicts, or presents opposing findings
- "mentioning": simply references without clear support or opposition

Also determine the likely section: "Introduction", "Methods", "Results", "Discussion", "Conclusion", or "Other".

Return a JSON object with a "citations" array containing objects with: cited_paper_id (the index like "1", "2"), classification, citation_context, confidence (0-1), section.`;

        let response: Response;
        try {
          response = await callAI({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Classify how each paper cites "${paper.title}":\n\n${batchText}\n\nReturn JSON: {"citations": [{"cited_paper_id": "1", "classification": "supporting|contrasting|mentioning", "citation_context": "brief explanation", "confidence": 0.8, "section": "Introduction"}]}`,
              },
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'classify_citations',
                description: 'Return classified citations for each citing paper',
                parameters: {
                  type: 'object',
                  properties: {
                    citations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          cited_paper_id: { type: 'string' },
                          classification: { type: 'string', enum: ['supporting', 'contrasting', 'mentioning'] },
                          citation_context: { type: 'string' },
                          confidence: { type: 'number' },
                          section: { type: 'string', enum: ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'Other'] },
                        },
                        required: ['cited_paper_id', 'classification', 'citation_context', 'section'],
                      },
                    },
                  },
                  required: ['citations'],
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'classify_citations' } },
            temperature: 0.2,
          });
        } catch (err) {
          console.error(`[classify] AI call error for batch ${Math.floor(i / batchSize) + 1}:`, err);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error(`[classify] AI response not ok: ${response.status} - ${errText.slice(0, 200)}`);
          continue;
        }

        const data = await response.json();
        const citations = extractCitationsFromResponse(data);

        if (citations.length === 0) {
          console.warn(`[classify] No citations extracted for batch ${Math.floor(i / batchSize) + 1}`);
          continue;
        }

        for (const citation of citations) {
          const idxMatch = (citation.cited_paper_id || '').match(/\d+/);
          const idx = idxMatch ? parseInt(idxMatch[0]) - 1 : -1;
          const citingPaper = idx >= 0 && idx < batch.length ? batch[idx] : null;

          const classification = ['supporting', 'contrasting', 'mentioning'].includes(citation.classification)
            ? citation.classification
            : 'mentioning';

          const record = {
            paper_id: paper.id,
            cited_paper_id: citingPaper?.id || citation.cited_paper_id || 'unknown',
            classification,
            citation_context: citation.citation_context || '',
            confidence: typeof citation.confidence === 'number' ? citation.confidence : 0.8,
            section: citation.section || 'Other',
          };
          const { error: insertErr } = await supabase.from('citation_classifications').insert(record);
          if (insertErr) {
            console.error('[classify] Insert error:', insertErr);
          } else {
            allClassifications.push(record);
          }
        }

        console.log(`[classify] Batch ${Math.floor(i / batchSize) + 1} done: ${citations.length} citations classified`);
      }

      // Update paper citation counters
      const supporting = allClassifications.filter(c => c.paper_id === paper.id && c.classification === 'supporting').length;
      const contrasting = allClassifications.filter(c => c.paper_id === paper.id && c.classification === 'contrasting').length;
      const mentioning = allClassifications.filter(c => c.paper_id === paper.id && c.classification === 'mentioning').length;
      const total = supporting + contrasting + mentioning;

      console.log(`[classify] Paper ${paper.id} totals: ${total} (S:${supporting} C:${contrasting} M:${mentioning})`);

      await supabase.from('papers')
        .update({
          total_citations_received: total,
          total_supporting: supporting,
          total_contrasting: contrasting,
          total_mentioning: mentioning,
        })
        .eq('external_id', paper.id);
    }

    console.log(`[classify] Done. Total classifications: ${allClassifications.length}`);
    return new Response(JSON.stringify({ classifications: allClassifications, count: allClassifications.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[classify] Fatal error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});