import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { paper_id, paper_title, papers } = await req.json();
    const papersToClassify = papers || (paper_id ? [{ id: paper_id, title: paper_title }] : []);

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
      const { data: existing } = await supabase
        .from('citation_classifications').select('id').eq('paper_id', paper.id).limit(1);
      if (existing && existing.length > 0) continue;

      // Try to get text from chunks first
      const { data: chunks } = await supabase
        .from('paper_chunks').select('chunk_text, paper_id, paper_title')
        .eq('paper_id', paper.id).order('chunk_index');

      let fullText = '';

      if (chunks && chunks.length > 0) {
        fullText = chunks.map(c => c.chunk_text).join('\n\n');
      } else {
        // Fallback: use abstract from papers table or from request body
        const { data: paperRow } = await supabase
          .from('papers').select('abstract, title, doi')
          .eq('external_id', paper.id).maybeSingle();

        const abstract = paperRow?.abstract || paper.abstract || '';
        const doi = paperRow?.doi || paper.doi || '';

        if (!abstract && !doi) {
          console.log(`No text available for paper ${paper.id}, skipping`);
          continue;
        }

        // Try fetching full text via Europe PMC if DOI available
        if (doi) {
          try {
            const pmcResp = await fetch(
              `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&resultType=core&format=json`
            );
            if (pmcResp.ok) {
              const pmcData = await pmcResp.json();
              const result = pmcData?.resultList?.result?.[0];
              if (result?.fullTextUrl) {
                // Try fetching the text version
                try {
                  const ftResp = await fetch(result.fullTextUrl);
                  if (ftResp.ok) {
                    const ftText = await ftResp.text();
                    if (ftText.length > 500) {
                      fullText = ftText.replace(/<[^>]*>/g, ' ').slice(0, 50000);
                    }
                  }
                } catch { /* ignore */ }
              }
            }
          } catch { /* ignore */ }
        }

        // If still no full text, use abstract
        if (!fullText) {
          fullText = `Title: ${paper.title}\n\nAbstract: ${abstract}`;
        }
      }

      const response = await callAI({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a citation classifier for scientific papers. 
Analyze the text of a scientific paper and identify references to other works.
For each citation found, classify the context as:
- "supporting": The citation supports or agrees with the referenced work
- "contrasting": The citation contradicts, questions, or presents opposing findings
- "mentioning": The citation simply mentions the referenced work without clear support or opposition

Additionally, determine the SECTION of the paper where the citation appears:
- "Introduction", "Methods", "Results", "Discussion", "Conclusion", "Other"

Extract the exact sentence where the citation appears as the citation_context.`,
          },
          {
            role: 'user',
            content: `Analyze the following paper text and classify all citations found.\n\nPaper: "${paper.title}" (ID: ${paper.id})\n\nText:\n${fullText.slice(0, 15000)}`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'classify_citations',
            description: 'Return classified citations found in the paper text',
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
                    additionalProperties: false,
                  },
                },
              },
              required: ['citations'],
              additionalProperties: false,
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
        const record = {
          paper_id: paper.id,
          cited_paper_id: citation.cited_paper_id,
          classification: citation.classification,
          citation_context: citation.citation_context,
          confidence: citation.confidence || 0.8,
          section: citation.section || 'Other',
        };
        await supabase.from('citation_classifications')
          .upsert(record, { onConflict: 'paper_id,cited_paper_id,classification' });
        allClassifications.push(record);
      }
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
