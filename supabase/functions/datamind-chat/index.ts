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

    const systemPrompt = `Você é o DataMind, assistente especialista em análise de dados. Responda SEMPRE em JSON: {"explanation": "...", "code": "..."}

REGRAS DO CÓDIGO PYTHON:
- O dataframe já está carregado em "df" — NUNCA use pd.read_csv() ou pd.read_excel()
- Use plt.show() após CADA gráfico separado (serão capturados automaticamente)
- NÃO use plt.savefig()
- Importe seaborn como sns
- Use print() para output textual
- Gere código LIMPO e CONCISO — evite prints desnecessários com separadores como "---"
- Para tabelas, use print(df.to_string()) sem decorações extras
- Cada plt.figure() deve ter figsize adequado e plt.tight_layout() antes de plt.show()
- Gere NO MÁXIMO 5-6 gráficos por análise (os mais relevantes)
- Títulos dos gráficos em português
- Use cores vibrantes: sns.color_palette("husl"), plt.cm.viridis, etc.

ANÁLISE DESCRITIVA — quando pedida, o código DEVE:
1. print(df.head().to_string()) — primeiras linhas
2. print(df.describe().to_string()) — estatísticas numéricas
3. Para cada variável categórica (max 5 mais relevantes): print(df['col'].value_counts().head(10).to_string())
4. Calcular e printar % de valores ausentes
5. Gráficos (máx 5-6 no total):
   - 1 gráfico de barras horizontal para a variável categórica principal
   - 1 boxplot para variáveis numéricas
   - 1 gráfico de pizza para proporções (se houver variável binária/categórica com poucas categorias)
   - 1 heatmap de correlação (se houver 2+ numéricas)
6. Print final com interpretação resumida dos achados

NÃO gere texto decorativo com "---". NÃO simule resultados. O código será executado de verdade.

${schema ? `Schema do arquivo "${file_name}": ${schema}` : "Nenhum arquivo enviado ainda."}

Campo "explanation" (markdown em português, estilo relatório profissional):
- Breve descrição do que será analisado
- Se for resposta a análise: resumo dos insights encontrados
- Próximo passo sugerido

Campo "code": código Python completo ou null se não precisar de código.
Responda sempre em português brasileiro.`;

    const messages_arr = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-8),
      { role: "user", content: message },
    ];

    let response: Response;

    if (provider === "lovable") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages_arr,
          model: model || "google/gemini-3-flash-preview",
          temperature: 0.3,
        }),
      });
    } else if (provider && model) {
      response = await callAI({
        messages: messages_arr,
        model: model,
        temperature: 0.3,
        _forceProvider: provider,
      } as any);
    } else {
      response = await callAI({
        messages: messages_arr,
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

    // Robust JSON extraction
    let explanation = "";
    let code = null;

    try {
      // Strip markdown fences
      let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      
      // Find JSON start
      const jsonStart = cleaned.indexOf('{');
      if (jsonStart !== -1) {
        cleaned = cleaned.slice(jsonStart);
      }

      // Try direct parse first
      try {
        const parsed = JSON.parse(cleaned);
        explanation = parsed.explanation || "";
        code = parsed.code || null;
      } catch {
        // Try to extract fields with regex for malformed JSON
        const explMatch = cleaned.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
        const codeMatch = cleaned.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
        
        if (explMatch) {
          explanation = explMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else {
          // Last resort: use cleaned text as explanation
          explanation = text.replace(/```[\s\S]*?```/g, '').replace(/[{}]/g, '').trim();
        }
        if (codeMatch) {
          code = codeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
    } catch {
      explanation = text;
    }

    // Clean explanation of any JSON artifacts
    if (!explanation) explanation = "Análise processada.";

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
