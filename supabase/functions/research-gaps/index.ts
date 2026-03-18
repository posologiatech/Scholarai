import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";
import { trackUsage } from "../_shared/usage-tracker.ts";

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
    const { query, papers, locale = 'en' } = await req.json();

    if (!query || !papers || papers.length === 0) {
      return new Response(JSON.stringify({ error: 'Query and papers required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const papersSummary = papers.slice(0, 15).map((p: any, i: number) =>
      `[${i + 1}] "${p.title}" (${p.authors?.slice(0, 3).join(', ')}, ${p.year || 'n.d.'}). ${p.abstract || ''}`
    ).join('\n\n');

    const systemPrompt = locale === 'pt'
      ? `Você é um analista de lacunas de pesquisa. Com base nos artigos científicos fornecidos, identifique lacunas de pesquisa ainda não respondidas.

Retorne EXATAMENTE um JSON válido com esta estrutura (sem markdown, sem \`\`\`):
{
  "gaps": [
    {
      "title": "Título curto da lacuna (max 80 caracteres)",
      "description": "Descrição detalhada da lacuna identificada (2-3 frases)",
      "evidence": "Qual evidência dos artigos aponta para esta lacuna",
      "suggestions": ["Sugestão de pesquisa 1", "Sugestão 2", "Sugestão 3"],
      "relevance": "high" | "medium"
    }
  ]
}

Identifique entre 3 e 5 lacunas. Priorize lacunas com alta relevância clínica ou científica.`
      : `You are a research gap analyst. Based on the scientific papers provided, identify unanswered research gaps.

Return EXACTLY valid JSON with this structure (no markdown, no \`\`\`):
{
  "gaps": [
    {
      "title": "Short gap title (max 80 chars)",
      "description": "Detailed description of the identified gap (2-3 sentences)",
      "evidence": "What evidence from the papers points to this gap",
      "suggestions": ["Research suggestion 1", "Suggestion 2", "Suggestion 3"],
      "relevance": "high" | "medium"
    }
  ]
}

Identify 3 to 5 gaps. Prioritize gaps with high clinical or scientific relevance.`;

    const response = await callAI({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Research question: "${query}"\n\nPapers:\n\n${papersSummary}` },
      ],
      stream: false,
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
      throw new Error('AI error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Clean potential markdown wrapping
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let gaps;
    try {
      gaps = JSON.parse(cleaned);
    } catch {
      gaps = { gaps: [] };
    }

    trackUsage(auth.userId, "research_gaps").catch(e => console.error("usage error:", e));

    return new Response(JSON.stringify(gaps), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('research-gaps error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
