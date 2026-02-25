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
    const { paper_id, paper_title, papers } = await req.json();

    // Can classify a single paper or batch
    const papersToClassify = papers || (paper_id ? [{ id: paper_id, title: paper_title }] : []);

    if (papersToClassify.length === 0) {
      return new Response(JSON.stringify({ error: 'paper_id or papers array required' }), {
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

    const allClassifications: any[] = [];

    for (const paper of papersToClassify) {
      // Check if already classified
      const { data: existing } = await supabase
        .from('citation_classifications')
        .select('id')
        .eq('paper_id', paper.id)
        .limit(1);

      if (existing && existing.length > 0) {
        continue; // Already classified
      }

      // Get all chunks for this paper that mention other papers
      const { data: chunks } = await supabase
        .from('paper_chunks')
        .select('chunk_text, paper_id, paper_title')
        .eq('paper_id', paper.id)
        .order('chunk_index');

      if (!chunks || chunks.length === 0) continue;

      const fullText = chunks.map(c => c.chunk_text).join('\n\n');

      // Use AI to find and classify citations in the text
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: `You are a citation classifier for scientific papers. 
Analyze the text of a scientific paper and identify references to other works.
For each citation found, classify the context as:
- "supporting": The citation supports or agrees with the referenced work
- "contrasting": The citation contradicts, questions, or presents opposing findings to the referenced work  
- "mentioning": The citation simply mentions the referenced work without clear support or opposition

Extract the exact sentence where the citation appears as the citation_context.
Use the cited work's identifier (author names, year, or any identifier you can find) as the cited_paper_id.
Be thorough but accurate. Only classify citations you can clearly identify in the text.`,
            },
            {
              role: 'user',
              content: `Analyze the following paper text and classify all citations found.

Paper: "${paper.title}" (ID: ${paper.id})

Text:
${fullText.slice(0, 15000)}`,
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
                        cited_paper_id: { type: 'string', description: 'Identifier of the cited work (author names + year or DOI)' },
                        classification: { type: 'string', enum: ['supporting', 'contrasting', 'mentioning'] },
                        citation_context: { type: 'string', description: 'The exact sentence where this citation appears' },
                        confidence: { type: 'number', description: 'Confidence score 0-1' },
                      },
                      required: ['cited_paper_id', 'classification', 'citation_context'],
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
        }),
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

      // Save to database
      for (const citation of citations) {
        const record = {
          paper_id: paper.id,
          cited_paper_id: citation.cited_paper_id,
          classification: citation.classification,
          citation_context: citation.citation_context,
          confidence: citation.confidence || 0.8,
        };

        await supabase
          .from('citation_classifications')
          .upsert(record, { onConflict: 'paper_id,cited_paper_id,classification' });

        allClassifications.push(record);
      }
    }

    return new Response(JSON.stringify({
      classifications: allClassifications,
      count: allClassifications.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('classify-citations error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
