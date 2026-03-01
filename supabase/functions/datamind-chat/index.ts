import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, schema, file_name, provider, model } = await req.json();

    const systemPrompt = `Você é o DataMind, um assistente especialista em análise de dados.
Quando o usuário faz uma pergunta sobre dados, você deve:
1. Explicar brevemente o que vai fazer
2. Gerar código Python usando pandas, matplotlib e/ou seaborn

Regras para o código Python:
- O arquivo CSV está disponível em '/tmp/data.csv' - use pd.read_csv('/tmp/data.csv')
- Para arquivos Excel (.xlsx, .xls), use pd.read_excel('/tmp/data.csv') — o arquivo já estará convertido
- Para gráficos, salve em '/tmp/chart.png' com plt.savefig('/tmp/chart.png', dpi=150, bbox_inches='tight')
- Use plt.style.use('seaborn-v0_8-darkgrid') para estilo visual
- Sempre inclua plt.close() após salvar
- Para output de texto, use print()
- Sempre use encoding utf-8 ao ler CSV

${schema ? `Schema do arquivo "${file_name}": ${schema}` : "Nenhum arquivo enviado ainda."}

Responda SEMPRE em formato JSON com dois campos:
{"explanation": "sua explicação em markdown", "code": "código python ou null"}

Se não houver necessidade de código, retorne code como null.
Responda sempre em português.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-8),
      { role: "user", content: message },
    ];

    // If a specific provider is requested, use it; otherwise let callAI auto-select
    let response: Response;

    if (provider === "lovable") {
      // Direct call to Lovable AI with specific model
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          model: model || "google/gemini-3-flash-preview",
          temperature: 0.3,
        }),
      });
    } else if (provider && model) {
      // Use callAI but override with explicit model
      response = await callAI({
        messages,
        model: model,
        temperature: 0.3,
        _forceProvider: provider,
      } as any);
    } else {
      response = await callAI({
        messages,
        model: "gpt-4o-mini",
        temperature: 0.3,
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let explanation = text;
    let code = null;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        explanation = parsed.explanation || text;
        code = parsed.code || null;
      }
    } catch {
      // If JSON parse fails, treat entire response as explanation
    }

    return new Response(JSON.stringify({ explanation, code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ explanation: "Erro ao processar sua solicitação.", code: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
