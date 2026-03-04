import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI, callEmbeddings } from "../_shared/ai-caller.ts";
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
    const { query, papers, column_name, custom_prompt, locale = 'en', stream = false, full_texts = {} } = await req.json();

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
        ? `Você é um assistente de pesquisa científica especializado em extração de dados.\nSua tarefa é ler o texto de artigos científicos e extrair a informação solicitada.\n\n[REGRAS]\n1. Use TODAS as informações disponíveis: texto completo, abstract, metadados (journal, autores, ano, DOI).\n2. Seja conciso (1-3 frases por paper).\n3. Quando a informação está EXPLÍCITA no texto, extraia diretamente.\n4. Quando a informação pode ser INFERIDA razoavelmente do contexto (ex: tipo de estudo inferido pela metodologia descrita, população inferida pelo contexto), forneça a inferência seguida de "(inferido do abstract)" ou "(inferido do contexto)".\n5. Use "Não mencionado" APENAS quando não há NENHUMA pista ou indicação no texto — nem direta nem indireta.\n6. Metadados como journal, autores e ano podem ajudar a inferir informações (ex: um artigo no "Journal of Clinical Trials" provavelmente é um ensaio clínico).\n7. Extraia a frase mais relevante no campo citation_context.\n8. Responda APENAS usando a função fornecida.\n\n${cp ? `INSTRUÇÃO ESPECÍFICA: ${cp}` : ''}`
        : `You are a scientific research assistant specialized in data extraction.\nYour task is to read paper text and extract the requested information.\n\n[RULES]\n1. Use ALL available information: full text, abstract, metadata (journal, authors, year, DOI).\n2. Be concise (1-3 sentences per paper).\n3. When information is EXPLICIT in text, extract directly.\n4. When information can be REASONABLY INFERRED from context (e.g., study type from methodology, population from context), provide the inference followed by "(inferred from abstract)" or "(inferred from context)".\n5. Use "Not mentioned" ONLY when there is NO clue or indication in the text — neither direct nor indirect.\n6. Metadata like journal, authors, and year can help infer information (e.g., a paper in "Journal of Clinical Trials" is likely a clinical trial).\n7. Extract the most relevant sentence in citation_context.\n8. Respond ONLY using the provided function.\n\n${cp ? `USER INSTRUCTION: ${cp}` : ''}`;
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

    const getContextForPapers = async (papersToSearch: any[]): Promise<Map<string, string>> => {
      const contextMap = new Map<string, string>();
      
      // Use full_texts directly when available (bypasses broken embeddings)
      for (const paper of papersToSearch) {
        if (full_texts[paper.id]) {
          // Truncate to ~15k chars per paper to fit in context window
          contextMap.set(paper.id, full_texts[paper.id].slice(0, 15000));
        }
      }
      
      // For papers without full text, try semantic search (if embeddings exist)
      const papersWithoutFullText = papersToSearch.filter((p: any) => !contextMap.has(p.id));
      if (papersWithoutFullText.length > 0) {
        try {
          const questionText = custom_prompt || column_name;
          const embResponse = await callEmbeddings(questionText);
          if (embResponse.ok) {
            const embData = await embResponse.json();
            const questionEmbedding = embData.data?.[0]?.embedding;
            if (questionEmbedding) {
              const results = await Promise.allSettled(papersWithoutFullText.map(async (paper: any) => {
                const { data: chunks } = await supabase.rpc('match_paper_chunks', {
                  query_embedding: questionEmbedding, match_threshold: 0.2, match_count: 5, filter_paper_id: paper.id,
                });
                if (chunks && chunks.length > 0) return { id: paper.id, text: chunks.map((c: any) => c.chunk_text).join('\n\n') };
                return null;
              }));
              for (const r of results) {
                if (r.status === 'fulfilled' && r.value) contextMap.set(r.value.id, r.value.text);
              }
            }
          }
        } catch (err) {
          console.error('Semantic search failed (non-blocking):', err);
        }
      }
      
      return contextMap;
    };

    const buildPaperSummary = (batch: any[], contextMap: Map<string, string>) => {
      return batch.map((p: any) => {
        const originalIdx = papers.findIndex((op: any) => op.id === p.id);
        const contextText = contextMap.get(p.id);
        
        // Determine if we have full text content
        const hasFullText = contextText && contextText.length > 2000;
        
        let textContent: string;
        if (hasFullText) {
          textContent = `[FULL TEXT AVAILABLE - Extract data directly]\n${contextText}`;
        } else if (contextText) {
          textContent = `Semantic chunks:\n${contextText}\n\nAbstract: ${p.abstract || 'No abstract available.'}`;
        } else {
          textContent = `Abstract: ${p.abstract || 'No abstract available.'}`;
        }
        
        // Build rich metadata section
        const authorsList = Array.isArray(p.authors) ? p.authors.join(', ') : '';
        const metadataParts = [
          authorsList ? `Authors: ${authorsList}` : null,
          p.year ? `Year: ${p.year}` : null,
          p.journal ? `Journal: ${p.journal}` : null,
          p.doi ? `DOI: ${p.doi}` : null,
        ].filter(Boolean).join(' | ');
        
        return `Paper ${originalIdx}: "${p.title}"\n${metadataParts ? `[${metadataParts}]` : ''}\n${textContent}`;
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
      if (toolCall?.function?.arguments) {
        return JSON.parse(toolCall.function.arguments);
      }

      // Fallback: try parsing JSON from plain text content
      const text = data.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
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
            const contextMap = await getContextForPapers(papersToExtract);
            const batchSize = 10;
            const batches: any[][] = [];
            for (let i = 0; i < papersToExtract.length; i += batchSize) batches.push(papersToExtract.slice(i, i + batchSize));

            const batchPromises = batches.map(async (batch) => {
              const papersSummary = buildPaperSummary(batch, contextMap);
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
      const contextMap = await getContextForPapers(papersToExtract);
      const batchSize = 10;
      const batches: any[][] = [];
      for (let i = 0; i < papersToExtract.length; i += batchSize) batches.push(papersToExtract.slice(i, i + batchSize));

      const batchResults = await Promise.all(batches.map(async (batch) => {
        const papersSummary = buildPaperSummary(batch, contextMap);
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

    // Ensure one extraction row per requested paper (prevents "completed but empty" UI)
    const extractedIndexes = new Set(extractions.map((e) => e.paper_index));
    for (let i = 0; i < papers.length; i++) {
      if (!extractedIndexes.has(i)) {
        extractions.push({
          paper_index: i,
          value: locale === 'pt' ? 'Não mencionado' : 'Not mentioned',
          citation_context: undefined,
          from_cache: false,
        });
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
