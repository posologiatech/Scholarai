import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI, callEmbeddings } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, papers, column_name, custom_prompt, locale = 'en', stream = false } = await req.json();

    if (!query || !papers || !Array.isArray(papers) || papers.length === 0 || !column_name) {
      return new Response(JSON.stringify({ error: 'query, papers, and column_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Check cache
    const paperIds = papers.map((p: any) => p.id).filter(Boolean);
    const { data: cachedResults } = await supabase
      .from('extraction_cache').select('paper_id, extracted_value, citation_context')
      .eq('column_name', column_name).in('paper_id', paperIds);

    const cacheMap = new Map<string, { value: string; citation: string | null }>();
    (cachedResults || []).forEach((r: any) => {
      cacheMap.set(r.paper_id, { value: r.extracted_value, citation: r.citation_context });
    });

    const summaryKeywords = ['summary', 'resumo', 'overview', 'visão geral', 'síntese', 'synopsis'];
    const isSynthesisColumn = summaryKeywords.some(k => column_name.toLowerCase().includes(k));

    const buildSystemPrompt = (lc: string, cp?: string) => {
      if (isSynthesisColumn) {
        return lc === 'pt'
          ? `Você é um assistente de pesquisa científica preciso.\nSua tarefa é ler o texto de artigos científicos e gerar um breve resumo do conteúdo principal.\n\n[REGRAS]\n1. Baseie seu resumo APENAS no texto fornecido.\n2. Seja conciso (2-4 frases por paper).\n3. Se o texto estiver vazio, retorne "Sem texto disponível".\n4. Use o campo citation_context para incluir a frase mais representativa.\n5. Responda APENAS usando a função fornecida.\n\n${cp ? `INSTRUÇÃO ESPECÍFICA: ${cp}` : ''}`
          : `You are a precise scientific research assistant.\nYour task is to read paper text and generate a brief summary.\n\n[RULES]\n1. Base summary ONLY on provided text.\n2. Be concise (2-4 sentences per paper).\n3. If text is empty, return "No text available".\n4. Use citation_context for the most representative sentence.\n5. Respond ONLY using the provided function.\n\n${cp ? `USER INSTRUCTION: ${cp}` : ''}`;
      }
      return lc === 'pt'
        ? `Você é um assistente de pesquisa científica altamente preciso e rigoroso.\nSua tarefa é ler o texto de artigos científicos e extrair uma informação específica solicitada.\n\n[REGRAS]\n1. Baseie sua resposta APENAS no texto fornecido.\n2. Seja extremamente conciso (1-3 frases por paper).\n3. Se a informação NÃO estiver no texto, retorne "Não mencionado".\n4. Extraia a frase EXATA que comprova a resposta no campo citation_context.\n5. Responda APENAS usando a função fornecida.\n\n${cp ? `INSTRUÇÃO ESPECÍFICA: ${cp}` : ''}`
        : `You are a highly precise scientific research assistant.\nYour task is to extract specific information from paper text.\n\n[RULES]\n1. Base answer ONLY on provided text.\n2. Be extremely concise (1-3 sentences per paper).\n3. If info is NOT in text, return "Not mentioned".\n4. Extract the EXACT quote proving your answer in citation_context.\n5. Respond ONLY using the provided function.\n\n${cp ? `USER INSTRUCTION: ${cp}` : ''}`;
    };

    const toolsDef = [{
      type: 'function' as const,
      function: {
        name: 'extract_column_data',
        description: 'Return extracted data for each paper.',
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
                  citation_context: { type: 'string' },
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

    const getSemanticContext = async (papersToSearch: any[]): Promise<Map<string, string>> => {
      const semanticContextMap = new Map<string, string>();
      try {
        const questionText = custom_prompt || column_name;
        const embResponse = await callEmbeddings(questionText);
        if (embResponse.ok) {
          const embData = await embResponse.json();
          const questionEmbedding = embData.data?.[0]?.embedding;
          if (questionEmbedding) {
            const results = await Promise.allSettled(papersToSearch.map(async (paper: any) => {
              const { data: chunks } = await supabase.rpc('match_paper_chunks', {
                query_embedding: questionEmbedding, match_threshold: 0.3, match_count: 3, filter_paper_id: paper.id,
              });
              if (chunks && chunks.length > 0) return { id: paper.id, text: chunks.map((c: any) => c.chunk_text).join('\n\n') };
              return null;
            }));
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) semanticContextMap.set(r.value.id, r.value.text);
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
      const response = await callAI({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: buildSystemPrompt(locale, custom_prompt) },
          { role: 'user', content: `Research question: "${query}"\n\n${extractionTarget}\n\nPapers:\n\n${papersSummary}` },
        ],
        tools: toolsDef,
        tool_choice: { type: 'function', function: { name: 'extract_column_data' } },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return null;
      return JSON.parse(toolCall.function.arguments);
    };

    // Streaming path
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          const send = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

          for (let idx = 0; idx < papers.length; idx++) {
            const p = papers[idx];
            if (p.id && cacheMap.has(p.id)) {
              const cached = cacheMap.get(p.id)!;
              send({ paper_index: idx, value: cached.value, citation_context: cached.citation || undefined, from_cache: true });
            }
          }

          const papersToExtract = papers.filter((p: any) => p.id && !cacheMap.has(p.id));
          if (papersToExtract.length > 0) {
            const semanticContextMap = await getSemanticContext(papersToExtract);
            const batchSize = 10;
            const batches: any[][] = [];
            for (let i = 0; i < papersToExtract.length; i += batchSize) batches.push(papersToExtract.slice(i, i + batchSize));

            const batchPromises = batches.map(async (batch) => {
              const papersSummary = buildPaperSummary(batch, semanticContextMap);
              try {
                const result = await callLLM(papersSummary);
                if (result) {
                  for (const ext of (result.extractions || [])) {
                    const paper = papers[ext.paper_index];
                    if (paper?.id) {
                      supabase.from('extraction_cache').upsert({
                        paper_id: paper.id, column_name, column_prompt: custom_prompt || null,
                        extracted_value: ext.value, citation_context: ext.citation_context || null,
                      }, { onConflict: 'paper_id,column_name' }).then(() => {});
                    }
                    send({ paper_index: ext.paper_index, value: ext.value, citation_context: ext.citation_context || undefined, from_cache: false });
                  }
                }
              } catch (err) { console.error('Batch extraction error:', err); }
            });
            await Promise.all(batchPromises);
          }
          send({ done: true });
          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    // Non-streaming path
    const papersToExtract = papers.filter((p: any) => p.id && !cacheMap.has(p.id));
    const extractions: any[] = [];

    papers.forEach((p: any, idx: number) => {
      if (p.id && cacheMap.has(p.id)) {
        const cached = cacheMap.get(p.id)!;
        extractions.push({ paper_index: idx, value: cached.value, citation_context: cached.citation || undefined, from_cache: true });
      }
    });

    if (papersToExtract.length > 0) {
      const semanticContextMap = await getSemanticContext(papersToExtract);
      const batchSize = 10;
      const batches: any[][] = [];
      for (let i = 0; i < papersToExtract.length; i += batchSize) batches.push(papersToExtract.slice(i, i + batchSize));

      const batchResults = await Promise.all(batches.map(async (batch) => {
        const papersSummary = buildPaperSummary(batch, semanticContextMap);
        return callLLM(papersSummary);
      }));

      for (const result of batchResults) {
        if (!result) continue;
        for (const ext of (result.extractions || [])) {
          const paper = papers[ext.paper_index];
          if (paper?.id) {
            supabase.from('extraction_cache').upsert({
              paper_id: paper.id, column_name, column_prompt: custom_prompt || null,
              extracted_value: ext.value, citation_context: ext.citation_context || null,
            }, { onConflict: 'paper_id,column_name' }).then(() => {});
          }
          extractions.push({ paper_index: ext.paper_index, value: ext.value, citation_context: ext.citation_context || undefined, from_cache: false });
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
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
