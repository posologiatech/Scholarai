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

    const papersSummary = papers.slice(0, 15).map((p: any, i: number) => {
      return `[${i + 1}] "${p.title}" (${p.authors?.slice(0, 3).join(', ')}${p.authors?.length > 3 ? ' et al.' : ''}, ${p.year || 'n.d.'}). ${p.abstract ? p.abstract.slice(0, 400) + '...' : 'No abstract.'}`;
    }).join('\n\n');

    const systemPrompt = locale === 'pt'
      ? `Você é um assistente de pesquisa acadêmica. O usuário fez a pesquisa: "${query}". Abaixo estão os artigos encontrados. Responda às perguntas do usuário com base nesses artigos. Cite os artigos por número [1], [2] etc. Use linguagem acadêmica mas acessível. Responda em português.\n\nArtigos:\n${papersSummary}`
      : `You are an academic research assistant. The user searched: "${query}". Below are the papers found. Answer user questions based on these papers. Cite papers by number [1], [2] etc. Use academic but accessible language.\n\nPapers:\n${papersSummary}`;

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
