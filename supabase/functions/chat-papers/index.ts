import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
          // Get paper IDs from the papers array
          const paperIds = papers.map((p: any) => p.id).filter(Boolean);

          // Search for relevant chunks across all papers
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

          // Sort by similarity and take top chunks
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

    // Build papers context with abstracts
    const papersSummary = papers.slice(0, 15).map((p: any, i: number) => {
      return `[${i + 1}] "${p.title}" (${p.authors?.slice(0, 4).join(', ')}${p.authors?.length > 4 ? ' et al.' : ''}, ${p.year || 'n.d.'}).\nAbstract: ${p.abstract || 'No abstract available.'}\nJournal: ${p.journal || 'Unknown'}\nDOI: ${p.doi || 'N/A'}`;
    }).join('\n\n---\n\n');

    const systemPrompt = locale === 'pt'
      ? `Você é um assistente de pesquisa acadêmica avançado com acesso a busca semântica RAG. O usuário fez a pesquisa: "${query}". Abaixo estão os artigos encontrados com seus abstracts COMPLETOS, metadados, e trechos relevantes encontrados via busca semântica nos textos completos.

Suas respostas devem:
- Priorizar informações dos TRECHOS RELEVANTES (excerpts) quando disponíveis, pois contêm informações mais detalhadas do texto completo
- Complementar com os abstracts quando os trechos não cobrirem a pergunta
- Citar os artigos por número [1], [2] etc.
- Identificar padrões, convergências e divergências entre os estudos
- Ser detalhadas e acadêmicas mas acessíveis
- Quando mencionar dados específicos (números, resultados), indicar de qual paper vieram

Responda em português.

Artigos encontrados:
${papersSummary}${ragContext}`
      : `You are an advanced academic research assistant with RAG semantic search access. The user searched: "${query}". Below are the papers found with their FULL abstracts, metadata, and relevant excerpts found via semantic search in full texts.

Your responses should:
- Prioritize information from RELEVANT EXCERPTS when available, as they contain more detailed information from full texts
- Complement with abstracts when excerpts don't cover the question
- Cite papers by number [1], [2] etc.
- Identify patterns, agreements and disagreements among studies
- Be detailed and academic but accessible
- When mentioning specific data (numbers, results), indicate which paper they came from

Answer in English.

Papers found:
${papersSummary}${ragContext}`;

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

    // Return the stream directly
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
