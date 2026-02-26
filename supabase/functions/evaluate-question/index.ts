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
    const { question, locale = 'en' } = await req.json();

    if (!question || typeof question !== 'string' || question.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Question too short' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = locale === 'pt'
      ? `Você é um especialista em metodologia de pesquisa. Avalie a qualidade de uma pergunta de pesquisa acadêmica e sugira elementos PICO/FINER que estejam faltando. Responda APENAS usando a função fornecida.`
      : `You are a research methodology expert. Evaluate the quality of an academic research question and suggest missing PICO/FINER elements. Respond ONLY using the provided function.`;

    const response = await callAI({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Evaluate this research question: "${question}"` },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'evaluate_question',
            description: 'Evaluate a research question and suggest improvements',
            parameters: {
              type: 'object',
              properties: {
                quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
                message: { type: 'string', description: locale === 'pt' ? 'Mensagem curta (1 frase) sobre a qualidade da pergunta' : 'Short message (1 sentence) about the question quality' },
                missing_elements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string', description: locale === 'pt' ? 'Nome curto do elemento faltante (ex: População, Intervenção, Comparação, Desfecho, Tempo)' : 'Short name of the missing element (e.g. Population, Intervention, Comparison, Outcome, Time)' },
                      rewritten_question: { type: 'string', description: locale === 'pt' ? 'A pergunta original COMPLETA reescrita incorporando este elemento faltante de forma natural. NÃO escreva orientações ou instruções — escreva a pergunta final melhorada pronta para uso.' : 'The COMPLETE original question rewritten naturally incorporating this missing element. Do NOT write guidance or instructions — write the final improved question ready to use.' },
                    },
                    required: ['label', 'rewritten_question'],
                    additionalProperties: false,
                  },
                },
                suggested_columns: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { name: { type: 'string' }, description: { type: 'string' } },
                    required: ['name', 'description'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['quality', 'message', 'missing_elements', 'suggested_columns'],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'evaluate_question' } },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const t = await response.text();
      console.error('AI error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: 'No evaluation returned' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const evaluation = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('evaluate error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
