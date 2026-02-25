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

    // Detect if the column is a synthesis/summary type vs factual extraction
    const summaryKeywords = ['summary', 'resumo', 'overview', 'visão geral', 'síntese', 'synopsis'];
    const isSynthesisColumn = summaryKeywords.some(k => column_name.toLowerCase().includes(k));

    const buildSystemPrompt = (lc: string, cp?: string) => {
      if (isSynthesisColumn) {
        return lc === 'pt'
          ? `Você é um assistente de pesquisa científica preciso.
Sua tarefa é ler o texto de artigos científicos e gerar um breve resumo do conteúdo principal.

[REGRAS]
1. Baseie seu resumo APENAS no texto fornecido. NÃO use conhecimento externo.
2. Seja conciso (2-4 frases por paper). Capture o objetivo, método principal e conclusão.
3. Se o texto estiver vazio ou indisponível, retorne "Sem texto disponível".
4. Use o campo citation_context para incluir a frase mais representativa do texto.
5. Responda APENAS usando a função fornecida.

${cp ? `INSTRUÇÃO ESPECÍFICA DO USUÁRIO: ${cp}` : ''}`
          : `You are a precise scientific research assistant.
Your task is to read the text of scientific papers and generate a brief summary of their main content.

[RULES]
1. Base your summary ONLY on the provided text. Do NOT use external knowledge.
2. Be concise (2-4 sentences per paper). Capture the objective, main method, and conclusion.
3. If the text is empty or unavailable, return "No text available".
4. Use the citation_context field to include the most representative sentence from the text.
5. Respond ONLY using the provided function.

${cp ? `USER SPECIFIC INSTRUCTION: ${cp}` : ''}`;
      }

      return lc === 'pt'
        ? `Você é um assistente de pesquisa científica altamente preciso e rigoroso.
Sua tarefa é ler o texto de artigos científicos e extrair uma informação específica solicitada pelo usuário.

[REGRAS E RESTRIÇÕES]
1. Baseie sua resposta APENAS no texto fornecido. NÃO use conhecimento externo.
2. Seja extremamente conciso (1-3 frases por paper).
3. Se a informação solicitada NÃO estiver explicitamente no texto, você DEVE retornar "Não mencionado" como valor. Jamais tente deduzir ou inventar.
4. Para cada resposta encontrada, você DEVE extrair a frase EXATA (quote) do texto original que comprova a sua resposta no campo citation_context.
5. Responda APENAS usando a função fornecida.

${cp ? `INSTRUÇÃO ESPECÍFICA DO USUÁRIO: ${cp}` : ''}`
        : `You are a highly precise and rigorous scientific research assistant.
Your task is to read the text of scientific papers and extract specific information requested by the user.

[RULES AND CONSTRAINTS]
1. Base your answer ONLY on the provided text. Do NOT use external knowledge.
2. Be extremely concise (1-3 sentences per paper).
3. If the requested information is NOT explicitly in the text, you MUST return "Not mentioned" as the value. Never try to deduce or invent.
4. For each answer found, you MUST extract the EXACT quote from the original text that proves your answer in the citation_context field.
5. Respond ONLY using the provided function.

${cp ? `USER SPECIFIC INSTRUCTION: ${cp}` : ''}`;
    };

    const toolsDef = [{
      type: 'function' as const,
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
    }];

    // Try to get semantic context but with a short timeout - don't block if embeddings aren't ready
    const getSemanticContext = async (papersToSearch: any[]): Promise<Map<string, string>> => {
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
            // Run all chunk searches in parallel
            const results = await Promise.allSettled(papersToSearch.map(async (paper: any) => {
              const { data: chunks } = await supabase.rpc('match_paper_chunks', {
                query_embedding: questionEmbedding,
                match_threshold: 0.3,
                match_count: 3,
                filter_paper_id: paper.id,
              });
              if (chunks && chunks.length > 0) {
                return { id: paper.id, text: chunks.map((c: any) => c.chunk_text).join('\n\n') };
              }
              return null;
            }));
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) {
                semanticContextMap.set(r.value.id, r.value.text);
              }
            }
          }
        }
      } catch (err) {
        console.error('Semantic search failed:', err);
      }
      return semanticContextMap;
    };

    const buildPaperSummary = (batch: any[], semanticContextMap: Map<string, string>) => {
      return batch.map((p: any) => {
        const originalIdx = papers.findIndex((op: any) => op.id === p.id);
        const semanticContext = semanticContextMap.get(p.id);
        const textContent = semanticContext
          ? `Semantic chunks:\n${semanticContext}\n\nAbstract: ${p.abstract || 'No abstract available.'}`
          : `Abstract: ${p.abstract || 'No abstract available.'}`;
        return `Paper ${originalIdx}: "${p.title}" (${p.authors?.slice(0, 3).join(', ')}${p.authors?.length > 3 ? ' et al.' : ''}, ${p.year || 'n.d.'}). ${textContent}`;
      }).join('\n\n');
    };

    const extractionTarget = custom_prompt
      ? `Column: "${column_name}"\nCustom instruction: ${custom_prompt}`
      : `Column: "${column_name}"`;

    const callLLM = async (papersSummary: string) => {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: buildSystemPrompt(locale, custom_prompt) },
            { role: 'user', content: `Research question: "${query}"\n\n${extractionTarget}\n\nPapers:\n\n${papersSummary}` },
          ],
          tools: toolsDef,
          tool_choice: { type: 'function', function: { name: 'extract_column_data' } },
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return null;
      return JSON.parse(toolCall.function.arguments);
    };

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
            // Get semantic context in parallel (non-blocking)
            const semanticContextMap = await getSemanticContext(papersToExtract);

            // OPTIMIZATION: Send ALL papers in ONE LLM call (up to ~20 papers)
            // If more than 10, split into 2 parallel batches
            const batchSize = 10;
            const batches: any[][] = [];
            for (let i = 0; i < papersToExtract.length; i += batchSize) {
              batches.push(papersToExtract.slice(i, i + batchSize));
            }

            // Run ALL batches in parallel
            const batchPromises = batches.map(async (batch) => {
              const papersSummary = buildPaperSummary(batch, semanticContextMap);
              try {
                const result = await callLLM(papersSummary);
                if (result) {
                  for (const ext of (result.extractions || [])) {
                    const paper = papers[ext.paper_index];
                    if (paper?.id) {
                      // Fire-and-forget cache write (don't await)
                      supabase.from('extraction_cache').upsert({
                        paper_id: paper.id,
                        column_name,
                        column_prompt: custom_prompt || null,
                        extracted_value: ext.value,
                        citation_context: ext.citation_context || null,
                      }, { onConflict: 'paper_id,column_name' }).then(() => {});
                    }
                    // Stream to client immediately
                    send({
                      paper_index: ext.paper_index,
                      value: ext.value,
                      citation_context: ext.citation_context || undefined,
                      from_cache: false,
                    });
                  }
                }
              } catch (err) {
                console.error('Batch extraction error:', err);
              }
            });

            await Promise.all(batchPromises);
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

    // Non-streaming path
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
      const semanticContextMap = await getSemanticContext(papersToExtract);

      // Process all at once (or 2 parallel batches for large sets)
      const batchSize = 10;
      const batches: any[][] = [];
      for (let i = 0; i < papersToExtract.length; i += batchSize) {
        batches.push(papersToExtract.slice(i, i + batchSize));
      }

      const batchResults = await Promise.all(batches.map(async (batch) => {
        const papersSummary = buildPaperSummary(batch, semanticContextMap);
        return callLLM(papersSummary);
      }));

      for (const result of batchResults) {
        if (!result) continue;
        for (const ext of (result.extractions || [])) {
          const paper = papers[ext.paper_index];
          if (paper?.id) {
            // Fire-and-forget cache
            supabase.from('extraction_cache').upsert({
              paper_id: paper.id,
              column_name,
              column_prompt: custom_prompt || null,
              extracted_value: ext.value,
              citation_context: ext.citation_context || null,
            }, { onConflict: 'paper_id,column_name' }).then(() => {});
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
    console.error('extract-column error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
