import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Citation Validation (Guarda Pretoriana) ─────────────────────────
function validateCitations(text: string, maxValidId: number): string {
  // Find all [N] patterns in the response
  const citationPattern = /\[(\d+)\]/g;
  let match;
  const invalidIds = new Set<number>();

  while ((match = citationPattern.exec(text)) !== null) {
    const id = parseInt(match[1]);
    if (id < 1 || id > maxValidId) {
      invalidIds.add(id);
    }
  }

  if (invalidIds.size === 0) return text;

  console.warn(`[chat-papers] HALLUCINATION DETECTED: Invalid citation IDs found: ${[...invalidIds].join(', ')}. Max valid: ${maxValidId}`);

  // Remove sentences containing invalid citations
  let cleaned = text;
  for (const invalidId of invalidIds) {
    // Remove the invalid citation marker but keep the sentence
    cleaned = cleaned.replace(new RegExp(`\\[${invalidId}\\]`, 'g'), '[?]');
  }

  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, papers, messages, locale = 'en' } = await req.json();

    if (!query || !papers || !Array.isArray(papers) || papers.length === 0 || !messages?.length) {
      return new Response(JSON.stringify({ error: 'Query, papers and messages are required' }), {
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

    // Get the latest user message for semantic search
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || query;

    // Try RAG: find relevant chunks via semantic search
    let ragContext = '';
    try {
      const embResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/text-embedding-004',
          input: lastUserMessage.slice(0, 8000),
        }),
      });

      if (embResponse.ok) {
        const embData = await embResponse.json();
        const questionEmbedding = embData.data?.[0]?.embedding;

        if (questionEmbedding) {
          const paperIds = papers.map((p: any) => p.id).filter(Boolean);

          const chunkPromises = paperIds.slice(0, 15).map((paperId: string) =>
            supabase.rpc('match_paper_chunks', {
              query_embedding: questionEmbedding,
              match_threshold: 0.3,
              match_count: 2,
              filter_paper_id: paperId,
            })
          );

          const chunkResults = await Promise.all(chunkPromises);
          const allChunks: any[] = [];

          chunkResults.forEach((result) => {
            if (result.data) {
              allChunks.push(...result.data);
            }
          });

          allChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
          const topChunks = allChunks.slice(0, 10);

          if (topChunks.length > 0) {
            ragContext = '\n\n--- RELEVANT TEXT EXCERPTS (from semantic search) ---\n\n' +
              topChunks.map((c: any, i: number) =>
                `[Excerpt ${i + 1} from "${c.paper_title}" | similarity: ${(c.similarity * 100).toFixed(0)}%]\n${c.chunk_text}`
              ).join('\n\n');

            console.log(`[chat-papers] RAG: Found ${topChunks.length} relevant chunks from ${new Set(topChunks.map((c: any) => c.paper_id)).size} papers`);
          }
        }
      }
    } catch (ragErr) {
      console.error('[chat-papers] RAG search failed (using abstracts only):', ragErr);
    }

    // Fetch scite classification data for papers that have it
    let sciteContext = '';
    try {
      const paperIds = papers.map((p: any) => p.id).filter(Boolean);
      const { data: classifications } = await supabase
        .from('citation_classifications')
        .select('paper_id, classification, citation_context, section')
        .in('paper_id', paperIds.slice(0, 15));

      if (classifications && classifications.length > 0) {
        const grouped: Record<string, any[]> = {};
        for (const c of classifications) {
          if (!grouped[c.paper_id]) grouped[c.paper_id] = [];
          grouped[c.paper_id].push(c);
        }

        sciteContext = '\n\n--- SCITE CITATION CLASSIFICATIONS ---\n\n';
        for (const [pid, cits] of Object.entries(grouped)) {
          const paper = papers.find((p: any) => p.id === pid);
          const sup = cits.filter((c: any) => c.classification === 'supporting').length;
          const con = cits.filter((c: any) => c.classification === 'contrasting').length;
          const men = cits.filter((c: any) => c.classification === 'mentioning').length;
          sciteContext += `Paper "${paper?.title || pid}": ${sup} supporting, ${con} contrasting, ${men} mentioning citations\n`;
        }
      }
    } catch (e) {
      console.error('[chat-papers] scite context fetch failed:', e);
    }

    const papersCount = Math.min(papers.length, 15);
    // Build papers context with abstracts
    const papersSummary = papers.slice(0, 15).map((p: any, i: number) => {
      return `[ID: ${i + 1}] "${p.title}" (${p.authors?.slice(0, 4).join(', ')}${p.authors?.length > 4 ? ' et al.' : ''}, ${p.year || 'n.d.'}).\nAbstract: ${p.abstract || 'No abstract available.'}\nJournal: ${p.journal || 'Unknown'}\nDOI: ${p.doi || 'N/A'}`;
    }).join('\n\n---\n\n');

    // Anti-hallucination prompt engineering
    const systemPrompt = locale === 'pt'
      ? `[INSTRUÇÕES DO SISTEMA]
Você é um assistente de pesquisa científica rigoroso, objetivo e imparcial, com acesso a busca semântica RAG.
O usuário fez a pesquisa: "${query}".
Sua ÚNICA função é responder à pergunta do usuário baseando-se ESTRITAMENTE e EXCLUSIVAMENTE nos "Contextos Fornecidos" abaixo.

[REGRAS CRÍTICAS - PENA DE FALHA SE DESCUMPRIDAS]
1. ANCORAGEM: Não use nenhum conhecimento prévio ou externo. Se a resposta não estiver nos contextos abaixo, diga EXATAMENTE: "Não encontrei evidências suficientes na literatura fornecida para responder a esta pergunta." Jamais tente adivinhar ou deduzir.
2. CITAÇÕES OBRIGATÓRIAS: Cada afirmação factual que você escrever DEVE terminar com a citação do artigo correspondente no formato [N]. Exemplo: "A substância aumentou a sobrevida em 20% [1]."
3. PROIBIDO INVENTAR FONTES: Você SÓ PODE usar os números de [ID] que aparecem explicitamente nos "Contextos Fornecidos" (de [1] a [${papersCount}]). NUNCA crie um ID novo.
4. CONFLITOS NA LITERATURA: Preste muita atenção às classificações scite. Se um contexto apoia uma ideia mas outro a contesta, você DEVE mencionar essa discordância cientificamente. Exemplo: "Enquanto estudos iniciais mostram eficácia [1], pesquisas mais recentes contestam esses achados [2]."
5. Priorize informações dos TRECHOS RELEVANTES (excerpts) quando disponíveis, pois contêm informações mais detalhadas do texto completo.
6. Quando mencionar dados específicos (números, resultados), indique de qual paper vieram.
7. Seja detalhado e acadêmico mas acessível.

Responda SEMPRE em português.

[CONTEXTOS FORNECIDOS]
${papersSummary}${ragContext}${sciteContext}`
      : `[SYSTEM INSTRUCTIONS]
You are a rigorous, objective, and impartial scientific research assistant with RAG semantic search access.
The user searched: "${query}".
Your ONLY function is to answer the user's question based STRICTLY and EXCLUSIVELY on the "Provided Contexts" below.

[CRITICAL RULES - FAILURE PENALTY IF VIOLATED]
1. ANCHORING: Do not use any prior or external knowledge. If the answer is not in the contexts below, say EXACTLY: "I did not find sufficient evidence in the provided literature to answer this question." Never guess or deduce.
2. MANDATORY CITATIONS: Every factual claim you write MUST end with the corresponding paper citation in format [N]. Example: "The substance increased survival by 20% [1]."
3. DO NOT INVENT SOURCES: You may ONLY use [ID] numbers that appear explicitly in "Provided Contexts" (from [1] to [${papersCount}]). NEVER create a new ID.
4. LITERATURE CONFLICTS: Pay close attention to scite classifications. If one context supports an idea but another contests it, you MUST mention this disagreement scientifically. Example: "While initial studies show efficacy [1], more recent research contests these findings [2]."
5. Prioritize information from RELEVANT EXCERPTS when available, as they contain more detailed information from full texts.
6. When mentioning specific data (numbers, results), indicate which paper they came from.
7. Be detailed and academic but accessible.

Always answer in English.

[PROVIDED CONTEXTS]
${papersSummary}${ragContext}${sciteContext}`;

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Stream the response
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: aiMessages,
        stream: true,
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
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For streaming, we pass through the stream but will validate on the client side
    // The client already has the paper IDs and can do client-side validation
    // For non-streaming validation, we'd buffer the full response here
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (err) {
    console.error('chat error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
