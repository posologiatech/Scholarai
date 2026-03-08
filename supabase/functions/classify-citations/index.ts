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

async function fetchCitingPapersFromOpenAlex(doi: string, externalId: string): Promise<CitingPaper[]> {
  const papers: CitingPaper[] = [];

  // Try OpenAlex first (best coverage)
  try {
    // Find the OpenAlex work ID
    let oaWorkId = '';
    if (doi) {
      const lookupResp = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`, {
        headers: { 'User-Agent': 'ArcaResearch/1.0 (mailto:contact@arca.research)' }
      });
      if (lookupResp.ok) {
        const work = await lookupResp.json();
        oaWorkId = work.id; // e.g. https://openalex.org/W12345
      }
    }

    if (!oaWorkId && externalId) {
      // Try by title search as fallback
      const searchResp = await fetch(`https://api.openalex.org/works?filter=openalex_id:${externalId}`, {
        headers: { 'User-Agent': 'ArcaResearch/1.0 (mailto:contact@arca.research)' }
      });
      if (searchResp.ok) {
        const data = await searchResp.json();
        if (data.results?.[0]?.id) oaWorkId = data.results[0].id;
      }
    }

    if (oaWorkId) {
      // Fetch ALL citing papers with pagination (OpenAlex max 200 per page)
      let cursor = '*';
      let hasMore = true;
      while (hasMore) {
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

        // Get next cursor
        const nextCursor = citesData.meta?.next_cursor;
        if (nextCursor && results.length === 200) {
          cursor = nextCursor;
        } else {
          hasMore = false;
        }
      }
      console.log(`OpenAlex: fetched ${papers.length} citing papers total`);
    }
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
      if (existing && existing.length > 0) continue;

      // Get DOI from DB if not provided
      let doi = paper.doi || '';
      if (!doi) {
        const { data: paperRow } = await supabase
          .from('papers').select('doi')
          .eq('external_id', paper.id).maybeSingle();
        doi = paperRow?.doi || '';
      }

      // Fetch citing papers from external APIs
      console.log(`Fetching citing papers for: ${paper.title} (DOI: ${doi})`);
      const citingPapers = await fetchCitingPapersFromOpenAlex(doi, paper.id);
      console.log(`Found ${citingPapers.length} citing papers`);

      if (citingPapers.length === 0) {
        // Fallback: try to classify from paper's own text (old approach)
        const { data: chunks } = await supabase
          .from('paper_chunks').select('chunk_text')
          .eq('paper_id', paper.id).order('chunk_index');

        let fullText = chunks?.map(c => c.chunk_text).join('\n\n') || '';
        if (!fullText) {
          fullText = `Title: ${paper.title}\n\nAbstract: ${paper.abstract || ''}`;
        }

        if (fullText.length < 100) continue;

        // Use old approach for papers without external citation data
        const response = await callAI({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'You are a citation classifier. Analyze the text and identify any references to other works. Classify each as supporting, contrasting, or mentioning.' },
            { role: 'user', content: `Analyze citations in:\n\n${fullText.slice(0, 15000)}` },
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'classify_citations',
              description: 'Return classified citations',
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
        });

        if (response.ok) {
          const data = await response.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const result = JSON.parse(toolCall.function.arguments);
            for (const c of (result.citations || [])) {
              const record = {
                paper_id: paper.id,
                cited_paper_id: c.cited_paper_id,
                classification: c.classification,
                citation_context: c.citation_context,
                confidence: c.confidence || 0.8,
                section: c.section || 'Other',
              };
              await supabase.from('citation_classifications').insert(record);
              allClassifications.push(record);
            }
          }
        }
        continue;
      }

      // Process citing papers in batches of 10 for AI classification
      const batchSize = 10;
      for (let i = 0; i < citingPapers.length; i += batchSize) {
        const batch = citingPapers.slice(i, i + batchSize);

        const batchText = batch.map((cp, idx) => {
          const authorStr = cp.authors?.join(', ') || 'Unknown authors';
          return `[${idx + 1}] "${cp.title}" (${authorStr}, ${cp.year || 'n.d.'})\nAbstract: ${cp.abstract || 'No abstract available'}`;
        }).join('\n\n---\n\n');

        const response = await callAI({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a citation context classifier for scientific papers.
You are given the TARGET paper: "${paper.title}"
And a list of papers that CITE the target paper.

For each citing paper, based on its abstract and title, classify HOW it cites the target paper:
- "supporting": The citing paper builds upon, validates, or agrees with the target paper's findings
- "contrasting": The citing paper challenges, contradicts, or presents opposing findings to the target paper
- "mentioning": The citing paper simply references the target paper without clear support or opposition

Also determine the likely section where the citation occurs based on context:
- "Introduction" (background/context), "Methods" (methodology reference), "Results" (comparison), "Discussion" (interpretation), "Conclusion", "Other"

Extract a brief context explaining the relationship.`,
            },
            {
              role: 'user',
              content: `Classify how each of the following papers cites the target paper "${paper.title}":\n\n${batchText}`,
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
                        cited_paper_id: { type: 'string', description: 'The index number [1], [2], etc. of the citing paper' },
                        classification: { type: 'string', enum: ['supporting', 'contrasting', 'mentioning'] },
                        citation_context: { type: 'string', description: 'Brief explanation of how this paper cites the target' },
                        confidence: { type: 'number', description: '0-1 confidence score' },
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
        });

        if (!response.ok) {
          console.error('AI classification failed:', response.status);
          continue;
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) continue;

        const result = JSON.parse(toolCall.function.arguments);
        const citations = result.citations || [];

        for (const citation of citations) {
          // Map the index back to the actual citing paper
          const idxMatch = citation.cited_paper_id.match(/\d+/);
          const idx = idxMatch ? parseInt(idxMatch[0]) - 1 : -1;
          const citingPaper = idx >= 0 && idx < batch.length ? batch[idx] : null;

          const record = {
            paper_id: paper.id,
            cited_paper_id: citingPaper?.id || citation.cited_paper_id,
            classification: citation.classification,
            citation_context: citation.citation_context,
            confidence: citation.confidence || 0.8,
            section: citation.section || 'Other',
          };
          await supabase.from('citation_classifications').insert(record);
          allClassifications.push(record);
        }
      }

      // Update paper citation counters
      const supporting = allClassifications.filter(c => c.paper_id === paper.id && c.classification === 'supporting').length;
      const contrasting = allClassifications.filter(c => c.paper_id === paper.id && c.classification === 'contrasting').length;
      const mentioning = allClassifications.filter(c => c.paper_id === paper.id && c.classification === 'mentioning').length;
      const total = supporting + contrasting + mentioning;

      await supabase.from('papers')
        .update({
          total_citations_received: total,
          total_supporting: supporting,
          total_contrasting: contrasting,
          total_mentioning: mentioning,
        })
        .eq('external_id', paper.id);
    }

    return new Response(JSON.stringify({ classifications: allClassifications, count: allClassifications.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('classify-citations error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
