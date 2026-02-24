const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, papers, column_name, locale = 'en' } = await req.json();

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

    const papersSummary = papers.slice(0, 15).map((p: any, i: number) => {
      return `Paper ${i}: "${p.title}" (${p.authors?.slice(0, 3).join(', ')}${p.authors?.length > 3 ? ' et al.' : ''}, ${p.year || 'n.d.'}). Abstract: ${p.abstract ? p.abstract.slice(0, 500) : 'No abstract.'}`;
    }).join('\n\n');

    const systemPrompt = locale === 'pt'
      ? `Você é um assistente de extração de dados acadêmicos. Para cada paper, extraia a informação correspondente à coluna "${column_name}" em relação à pergunta de pesquisa. Seja conciso (1-3 frases por paper). Use asteriscos (*) para marcar citações inline. Responda APENAS usando a função fornecida.`
      : `You are an academic data extraction assistant. For each paper, extract information for the column "${column_name}" relative to the research question. Be concise (1-3 sentences per paper). Use asterisks (*) for inline citations. Respond ONLY using the provided function.`;

    const paperIndices = papers.slice(0, 15).map((_: any, i: number) => i);

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
          { role: 'user', content: `Research question: "${query}"\n\nColumn to extract: "${column_name}"\n\nPapers:\n\n${papersSummary}` },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_column_data',
              description: 'Return extracted data for each paper',
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
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: 'No extraction returned' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
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
