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
    const { query, papers, column_name, custom_prompt, locale = 'en', stream = false } = await req.json();

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

    // If streaming, use SSE
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          const send = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          // Send cached results immediately
          for (let idx = 0; idx < papers.length; idx++) {
            const p = papers[idx];
            if (p.id && cacheMap.has(p.id)) {
              const cached = cacheMap.get(p.id)!;
              send({
                paper_index: idx,
                value: cached.value,
                citation_context: cached.citation || undefined,
                from_cache: true,
              });
            }
          }

          // Identify papers needing extraction
          const papersToExtract = papers.filter((p: any) => p.id && !cacheMap.has(p.id));

          if (papersToExtract.length > 0) {
            // Get semantic context
            const semanticContextMap = new Map<string, string>();
            try {
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
                  await Promise.all(papersToExtract.map(async (paper: any) => {
                    const { data: chunks } = await supabase.rpc('match_paper_chunks', {
                      query_embedding: questionEmbedding,
                      match_threshold: 0.3,
                      match_count: 3,
                      filter_paper_id: paper.id,
                    });
                    if (chunks && chunks.length > 0) {
                      semanticContextMap.set(paper.id, chunks.map((c: any) => c.chunk_text).join('\n\n'));
                    }
                  }));
                }
              }
            } catch (err) {
              console.error('Semantic search failed:', err);
            }

            // Process papers in small batches for streaming
            const batchSize = 3;
            for (let i = 0; i < papersToExtract.length; i += batchSize) {
              const batch = papersToExtract.slice(i, i + batchSize);

              const papersSummary = batch.map((p: any) => {
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
                ? `Você é um assistente de pesquisa científica altamente preciso e rigoroso.
Sua tarefa é ler o texto de artigos científicos e extrair uma informação específica solicitada pelo usuário.

[REGRAS E RESTRIÇÕES]
1. Baseie sua resposta APENAS no texto fornecido. NÃO use conhecimento externo.
2. Seja extremamente conciso (1-3 frases por paper).
3. Se a informação solicitada NÃO estiver explicitamente no texto, você DEVE retornar "Não mencionado" como valor. Jamais tente deduzir ou inventar.
4. Para cada resposta encontrada, você DEVE extrair a frase EXATA (quote) do texto original que comprova a sua resposta no campo citation_context.
5. Responda APENAS usando a função fornecida.

${custom_prompt ? `INSTRUÇÃO ESPECÍFICA DO USUÁRIO: ${custom_prompt}` : ''}`
                : `You are a highly precise and rigorous scientific research assistant.
Your task is to read the text of scientific papers and extract specific information requested by the user.

[RULES AND CONSTRAINTS]
1. Base your answer ONLY on the provided text. Do NOT use external knowledge.
2. Be extremely concise (1-3 sentences per paper).
3. If the requested information is NOT explicitly in the text, you MUST return "Not mentioned" as the value. Never try to deduce or invent.
4. For each answer found, you MUST extract the EXACT quote from the original text that proves your answer in the citation_context field.
5. Respond ONLY using the provided function.

${custom_prompt ? `USER SPECIFIC INSTRUCTION: ${custom_prompt}` : ''}`;

              try {
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
                    tools: [{
                      type: 'function',
                      function: {
                        name: 'extract_column_data',
                        description: 'Return extracted data for each paper. Use "Not mentioned" / "Não mencionado" when information is not found. Always include the exact quote from source text.',
                        parameters: {
                          type: 'object',
                          properties: {
                            extractions: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  paper_index: { type: 'number', description: 'Index of the paper' },
                                  value: { type: 'string', description: 'Extracted info or "Not mentioned"/"Não mencionado" if not found' },
                                  citation_context: { type: 'string', description: 'EXACT quote from source text proving the answer, or null if not mentioned' },
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
                    }],
                    tool_choice: { type: 'function', function: { name: 'extract_column_data' } },
                  }),
                });

                if (response.ok) {
                  const data = await response.json();
                  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
                  if (toolCall) {
                    const result = JSON.parse(toolCall.function.arguments);
                    for (const ext of (result.extractions || [])) {
                      const paper = papers[ext.paper_index];
                      if (paper?.id) {
                        // Cache
                        await supabase.from('extraction_cache').upsert({
                          paper_id: paper.id,
                          column_name,
                          column_prompt: custom_prompt || null,
                          extracted_value: ext.value,
                          citation_context: ext.citation_context || null,
                        }, { onConflict: 'paper_id,column_name' });
                      }
                      // Stream to client
                      send({
                        paper_index: ext.paper_index,
                        value: ext.value,
                        citation_context: ext.citation_context || undefined,
                        from_cache: false,
                      });
                    }
                  }
                }
              } catch (err) {
                console.error('Batch extraction error:', err);
              }
            }
          }

          send({ done: true });
          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming path (original behavior)
    const papersToExtract = papers.filter((p: any) => p.id && !cacheMap.has(p.id));
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

    if (papersToExtract.length > 0) {
      let semanticContextMap = new Map<string, string>();
      try {
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
            await Promise.all(papersToExtract.map(async (paper: any) => {
              const { data: chunks } = await supabase.rpc('match_paper_chunks', {
                query_embedding: questionEmbedding,
                match_threshold: 0.3,
                match_count: 3,
                filter_paper_id: paper.id,
              });
              if (chunks && chunks.length > 0) {
                semanticContextMap.set(paper.id, chunks.map((c: any) => c.chunk_text).join('\n\n'));
              }
            }));
          }
        }
      } catch (err) {
        console.error('Semantic search failed (falling back to abstract):', err);
      }

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
        ? `Você é um assistente de pesquisa científica altamente preciso e rigoroso.
Sua tarefa é ler o texto de artigos científicos e extrair uma informação específica solicitada pelo usuário.

[REGRAS E RESTRIÇÕES]
1. Baseie sua resposta APENAS no texto fornecido. NÃO use conhecimento externo.
2. Seja extremamente conciso (1-3 frases por paper).
3. Se a informação solicitada NÃO estiver explicitamente no texto, você DEVE retornar "Não mencionado" como valor. Jamais tente deduzir ou inventar.
4. Para cada resposta encontrada, você DEVE extrair a frase EXATA (quote) do texto original que comprova a sua resposta no campo citation_context.
5. Responda APENAS usando a função fornecida.

${custom_prompt ? `INSTRUÇÃO ESPECÍFICA DO USUÁRIO: ${custom_prompt}` : ''}`
        : `You are a highly precise and rigorous scientific research assistant.
Your task is to read the text of scientific papers and extract specific information requested by the user.

[RULES AND CONSTRAINTS]
1. Base your answer ONLY on the provided text. Do NOT use external knowledge.
2. Be extremely concise (1-3 sentences per paper).
3. If the requested information is NOT explicitly in the text, you MUST return "Not mentioned" as the value. Never try to deduce or invent.
4. For each answer found, you MUST extract the EXACT quote from the original text that proves your answer in the citation_context field.
5. Respond ONLY using the provided function.

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
          tools: [{
            type: 'function',
            function: {
              name: 'extract_column_data',
              description: 'Return extracted data for each paper. Use "Not mentioned" / "Não mencionado" when information is not found. Always include the exact quote from source text.',
              parameters: {
                type: 'object',
                properties: {
                  extractions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        paper_index: { type: 'number', description: 'Index of the paper' },
                        value: { type: 'string', description: 'Extracted info or "Not mentioned"/"Não mencionado" if not found' },
                        citation_context: { type: 'string', description: 'EXACT quote from source text proving the answer, or null if not mentioned' },
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
          }],
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
        for (const ext of (result.extractions || [])) {
          const paper = papers[ext.paper_index];
          if (paper?.id) {
            await supabase.from('extraction_cache').upsert({
              paper_id: paper.id,
              column_name,
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
