import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, papers, locale = 'en' } = await req.json();

    if (!query || !papers || !Array.isArray(papers) || papers.length === 0) {
      return new Response(JSON.stringify({ error: 'Query and papers are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send full abstracts for better synthesis
    const papersSummary = papers.slice(0, 15).map((p: any, i: number) => {
      return `[${i + 1}] "${p.title}" (${p.authors?.slice(0, 4).join(', ')}${p.authors?.length > 4 ? ' et al.' : ''}, ${p.year || 'n.d.'}). ${p.abstract || 'No abstract available.'}`;
    }).join('\n\n');

    const systemPrompt = locale === 'pt'
      ? `Você é um assistente de pesquisa acadêmica especializado em sínteses de literatura. Analise detalhadamente os artigos científicos abaixo para responder à pergunta do usuário.

Sua síntese deve ser EXTENSA e DETALHADA (mínimo 6-8 parágrafos):
1. **Introdução**: Contextualize o tema e a pergunta de pesquisa (1 parágrafo)
2. **Principais achados**: Descreva os resultados mais relevantes dos artigos, agrupando por subtemas quando apropriado (2-3 parágrafos)
3. **Metodologias**: Comente brevemente as abordagens metodológicas utilizadas (1 parágrafo)
4. **Convergências e divergências**: Identifique pontos de consenso e controvérsias entre os estudos (1 parágrafo)
5. **Lacunas e limitações**: Aponte limitações dos estudos e lacunas na literatura (1 parágrafo)
6. **Conclusão**: Sintetize as implicações práticas e direções futuras (1 parágrafo)

Cite os artigos por número [1], [2] etc. ao longo do texto. Use linguagem acadêmica mas acessível. Responda em português.`
      : `You are an academic research assistant specialized in literature synthesis. Analyze the scientific papers below in detail to answer the user's question.

Your synthesis must be EXTENSIVE and DETAILED (minimum 6-8 paragraphs):
1. **Introduction**: Contextualize the topic and research question (1 paragraph)
2. **Key findings**: Describe the most relevant results, grouping by subtopics when appropriate (2-3 paragraphs)
3. **Methodologies**: Briefly comment on the methodological approaches used (1 paragraph)
4. **Agreements and disagreements**: Identify points of consensus and controversies among studies (1 paragraph)
5. **Gaps and limitations**: Point out study limitations and literature gaps (1 paragraph)
6. **Conclusion**: Summarize practical implications and future directions (1 paragraph)

Cite papers by number [1], [2] etc. throughout. Use academic but accessible language. Answer in English.`;

    const response = await callAI({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Research question: "${query}"\n\nPapers found (${papers.length} total):\n\n${papersSummary}` },
      ],
      stream: true,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add funds.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (err) {
    console.error('synthesize error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
