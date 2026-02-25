const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, references } = await req.json();

    if (!text && (!references || !Array.isArray(references))) {
      return new Response(JSON.stringify({ error: 'text or references array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Extract references from text if not provided
    let refsToCheck = references || [];

    if (text && !references) {
      const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });

      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const result = JSON.parse(toolCall.function.arguments);
          refsToCheck = result.references || [];
        }
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
        status: 'ok',
        issues: [],
      };

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

      // Check via CrossRef for retraction notices (if DOI available)
      if (ref.doi) {
        try {
          const crResponse = await fetch(`https://api.crossref.org/works/${ref.doi}`, {
            headers: { 'User-Agent': 'ScholarAI/1.0 (mailto:contact@scholarai.com)' },
          });
          if (crResponse.ok) {
            const crData = await crResponse.json();
            const updateTo = crData.message?.['update-to'];
            if (updateTo) {
              const retraction = updateTo.find((u: any) => u.label === 'Retraction' || u.type === 'retraction');
              if (retraction) {
                refResult.status = 'retracted';
                refResult.issues.push({
                  type: 'retracted',
                  message: 'This paper has been RETRACTED',
                  doi: retraction.DOI,
                });
              }
            }
          }
        } catch (e) {
          console.error('CrossRef check failed for DOI:', ref.doi, e);
        }
      }

      checkedRefs.push(refResult);
    }

    const summary = {
      total: checkedRefs.length,
      ok: checkedRefs.filter(r => r.status === 'ok').length,
      warning: checkedRefs.filter(r => r.status === 'warning').length,
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
