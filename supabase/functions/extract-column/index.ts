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
    const { query, papers, column_name, custom_prompt, locale = 'en' } = await req.json();

    if (!query || !papers || !Array.isArray(papers) || papers.length === 0 || !column_name) {
      return new Response(JSON.stringify({ error: 'query, papers, and column_name are required' }), {
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

    // Step 1: Check cache for each paper
    const paperIds = papers.map((p: any) => p.id).filter(Boolean);
    const { data: cachedResults } = await supabase
      .from('extraction_cache')
      .select('paper_id, extracted_value, citation_context')
      .eq('column_name', column_name)
      .in('paper_id', paperIds);

    const cacheMap = new Map<string, { value: string; citation: string | null }>();
    (cachedResults || []).forEach((r: any) => {
      cacheMap.set(r.paper_id, { value: r.extracted_value, citation: r.citation_context });
    });

    // Step 2: Identify papers needing extraction
    const papersToExtract = papers.filter((p: any, idx: number) => {
      return p.id && !cacheMap.has(p.id);
    });

    const extractions: { paper_index: number; value: string; citation_context?: string; from_cache?: boolean }[] = [];

    // Add cached results
    papers.forEach((p: any, idx: number) => {
      if (p.id && cacheMap.has(p.id)) {
        const cached = cacheMap.get(p.id)!;
        extractions.push({
          paper_index: idx,
          value: cached.value,
          citation_context: cached.citation || undefined,
          from_cache: true,
        });
      }
    });

    // Step 3: For uncached papers, try semantic search for richer context
    if (papersToExtract.length > 0) {
      // Try to get embeddings for the column question to do semantic search
      let semanticContextMap = new Map<string, string>();

      try {
        // Generate embedding for the extraction question
        const questionText = custom_prompt || column_name;
        const embResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/text-embedding-004',
            input: questionText.slice(0, 8000),
          }),
        });

        if (embResponse.ok) {
          const embData = await embResponse.json();
          const questionEmbedding = embData.data?.[0]?.embedding;

          if (questionEmbedding) {
            // For each uncached paper, find the most relevant chunks
            await Promise.all(papersToExtract.map(async (paper: any) => {
              const { data: chunks } = await supabase.rpc('match_paper_chunks', {
                query_embedding: questionEmbedding,
                match_threshold: 0.3,
                match_count: 3,
                filter_paper_id: paper.id,
              });

              if (chunks && chunks.length > 0) {
                const context = chunks.map((c: any) => c.chunk_text).join('\n\n');
                semanticContextMap.set(paper.id, context);
              }
            }));
          }
        }
      } catch (err) {
        console.error('Semantic search failed (falling back to abstract):', err);
      }

      // Step 4: Build prompt with enriched context and call LLM
      const papersSummary = papersToExtract.map((p: any) => {
        const originalIdx = papers.findIndex((op: any) => op.id === p.id);
        const semanticContext = semanticContextMap.get(p.id);
        const textContent = semanticContext
          ? `Semantic chunks:\n${semanticContext}\n\nAbstract: ${p.abstract || 'No abstract available.'}`
          : `Abstract: ${p.abstract || 'No abstract available.'}`;

        return `Paper ${originalIdx}: "${p.title}" (${p.authors?.slice(0, 3).join(', ')}${p.authors?.length > 3 ? ' et al.' : ''}, ${p.year || 'n.d.'}). ${textContent}`;
      }).join('\n\n');

      const extractionTarget = custom_prompt
        ? `Column: "${column_name}"\nCustom instruction: ${custom_prompt}`
        : `Column: "${column_name}"`;

      const systemPrompt = locale === 'pt'
        ? `Você é um assistente de extração de dados acadêmicos. Para cada paper, extraia a informação correspondente à coluna solicitada em relação à pergunta de pesquisa. Seja conciso (1-3 frases por paper). Se o paper não tiver informações suficientes, indique "Informação não disponível". Use asteriscos (*) para marcar citações inline. Responda APENAS usando a função fornecida. IMPORTANTE: Para cada extração, inclua o trecho exato do texto original de onde você extraiu a informação no campo citation_context.

${custom_prompt ? `INSTRUÇÃO ESPECÍFICA DO USUÁRIO: ${custom_prompt}` : ''}`
        : `You are an academic data extraction assistant. For each paper, extract information for the requested column relative to the research question. Be concise (1-3 sentences per paper). If the paper has insufficient information, indicate "Information not available". Use asterisks (*) for inline citations. Respond ONLY using the provided function. IMPORTANT: For each extraction, include the exact text excerpt from the original where you extracted the information in the citation_context field.

${custom_prompt ? `USER SPECIFIC INSTRUCTION: ${custom_prompt}` : ''}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Research question: "${query}"\n\n${extractionTarget}\n\nPapers:\n\n${papersSummary}` },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'extract_column_data',
                description: 'Return extracted data for each paper with citation context',
                parameters: {
                  type: 'object',
                  properties: {
                    extractions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          paper_index: { type: 'number' },
                          value: { type: 'string' },
                          citation_context: { type: 'string', description: 'The exact text excerpt from the source that supports this extraction' },
                        },
                        required: ['paper_index', 'value'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['extractions'],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: 'function', function: { name: 'extract_column_data' } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const t = await response.text();
        console.error('AI gateway error:', response.status, t);
        return new Response(JSON.stringify({ error: 'AI error' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const result = JSON.parse(toolCall.function.arguments);
        const newExtractions = result.extractions || [];

        // Save to cache and add to results
        for (const ext of newExtractions) {
          const paper = papers[ext.paper_index];
          if (paper?.id) {
            // Save to cache (upsert)
            await supabase
              .from('extraction_cache')
              .upsert({
                paper_id: paper.id,
                column_name: column_name,
                column_prompt: custom_prompt || null,
                extracted_value: ext.value,
                citation_context: ext.citation_context || null,
              }, { onConflict: 'paper_id,column_name' });
          }

          extractions.push({
            paper_index: ext.paper_index,
            value: ext.value,
            citation_context: ext.citation_context || undefined,
            from_cache: false,
          });
        }
      }
    }

    // Sort by paper_index
    extractions.sort((a, b) => a.paper_index - b.paper_index);

    return new Response(JSON.stringify({ extractions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('extract error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
