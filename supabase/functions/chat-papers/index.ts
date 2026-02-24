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

    // Send FULL abstracts - don't truncate
    const papersSummary = papers.slice(0, 15).map((p: any, i: number) => {
      return `[${i + 1}] "${p.title}" (${p.authors?.slice(0, 4).join(', ')}${p.authors?.length > 4 ? ' et al.' : ''}, ${p.year || 'n.d.'}).\nAbstract: ${p.abstract || 'No abstract available.'}\nJournal: ${p.journal || 'Unknown'}\nDOI: ${p.doi || 'N/A'}`;
    }).join('\n\n---\n\n');

    const systemPrompt = locale === 'pt'
      ? `Você é um assistente de pesquisa acadêmica avançado. O usuário fez a pesquisa: "${query}". Abaixo estão os artigos encontrados com seus abstracts COMPLETOS e metadados.

Suas respostas devem:
- Ser baseadas no conteúdo COMPLETO dos abstracts, não apenas nos títulos ou resumos curtos
- Analisar detalhadamente metodologias, resultados e conclusões mencionados nos abstracts
- Citar os artigos por número [1], [2] etc.
- Identificar padrões, convergências e divergências entre os estudos
- Ser detalhadas e acadêmicas mas acessíveis
- Quando o usuário perguntar sobre algo específico, buscar a informação em TODOS os papers relevantes

Responda em português.

Artigos encontrados:
${papersSummary}`
      : `You are an advanced academic research assistant. The user searched: "${query}". Below are the papers found with their FULL abstracts and metadata.

Your responses should:
- Be based on the COMPLETE content of abstracts, not just titles or short summaries
- Analyze methodologies, results and conclusions mentioned in abstracts in detail
- Cite papers by number [1], [2] etc.
- Identify patterns, agreements and disagreements among studies
- Be detailed and academic but accessible
- When the user asks about something specific, search for information across ALL relevant papers

Answer in English.

Papers found:
${papersSummary}`;

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: aiMessages,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI error' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('chat error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
