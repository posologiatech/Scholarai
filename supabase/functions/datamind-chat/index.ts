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

    const systemPrompt = `Você é o DataMind, um assistente especialista em análise de dados estatísticos de nível profissional, similar ao Julius.ai.

Quando o usuário envia um arquivo e pede análise, você deve gerar código Python COMPLETO e PROFISSIONAL que:

1. **Análise Exploratória Completa** (quando pedida):
   - Mostre df.head() com print()
   - Mostre df.describe() para variáveis numéricas
   - Mostre value_counts() para CADA variável categórica relevante (top 10 de cada)
   - Calcule e mostre a porcentagem de valores ausentes por coluna
   - Gere gráficos: barras horizontais para categorias, histogramas para numéricas, boxplots, gráfico de pizza para proporções
   - Adicione títulos claros em português em TODOS os gráficos
   - Use plt.tight_layout() e plt.show() após CADA gráfico separado
   - Ao final, faça um print() com interpretação/resumo dos achados principais

2. **Qualidade dos Gráficos**:
   - Use figsize adequado (10,6 para barras, 8,8 para pizza, 12,5 para heatmap)
   - Use paleta de cores vibrante: plt.cm.viridis, sns.color_palette("husl"), etc
   - Adicione labels nos eixos em português
   - Adicione anotações com valores quando relevante
   - Cada plt.show() DEVE ser chamado separadamente para cada figura

3. **Output Estruturado**:
   - Separe seções com print("\\n--- TÍTULO DA SEÇÃO ---")
   - Para cada tabela, use print(df_resultado.to_string()) para saída formatada
   - Inclua interpretação textual após cada análise
   - No final, print() um resumo com os insights mais importantes

4. **Código Robusto**:
   - Sempre trate exceções com try/except
   - Verifique se colunas existem antes de usar
   - Use encoding adequado para caracteres especiais

Regras para o código Python:
- O dataframe já está carregado na variável "df" (NÃO use pd.read_csv ou pd.read_excel)
- Para gráficos, use plt.show() ao final de CADA gráfico — serão capturados automaticamente
- NÃO use plt.savefig() — o sistema captura via plt.show()
- Use seaborn (import seaborn as sns) para gráficos mais bonitos
- Para output de texto, use print()
- Inclua comentários em português

REGRAS CRÍTICAS:
- NÃO inclua "saída simulada" ou output simulado
- NÃO inclua referências markdown a imagens ![texto](path)
- NÃO simule resultados — o código será executado de verdade
- Na explicação, diga o que a análise VAI fazer, não o que mostra
- Gere BASTANTE output: múltiplas tabelas, múltiplos gráficos, interpretações textuais

${schema ? `Schema do arquivo "${file_name}": ${schema}` : "Nenhum arquivo enviado ainda."}

Responda SEMPRE em formato JSON com dois campos:
{"explanation": "markdown estruturado em seções", "code": "código python completo ou null"}

Formato OBRIGATÓRIO do campo "explanation" (em português, bem organizado, estilo relatório):
1) **Características do Dataset**
2) **Análises Estatísticas Recomendadas** (com numeração por bloco: Descritiva, Associação, Comparativa, Temporal, Multivariada)
3) **Observações Importantes**
4) **Próximo Passo Recomendado** (uma sugestão sequencial baseada no que já foi analisado)

Se não houver necessidade de código, retorne code como null.
Responda sempre em português brasileiro.`;

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

    // Parse JSON response - robust extraction
    let explanation = text;
    let code = null;

    try {
      // Strip markdown code fences if present
      let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      
      // Try to find JSON with "explanation" key
      const jsonStart = cleaned.indexOf('{"explanation"');
      if (jsonStart !== -1) {
        cleaned = cleaned.slice(jsonStart);
      }
      
      // Parse - handle nested code with braces by finding the matching structure
      // First try direct parse
      try {
        const parsed = JSON.parse(cleaned);
        explanation = parsed.explanation || text;
        code = parsed.code || null;
      } catch {
        // Try extracting explanation and code separately with regex
        const explMatch = cleaned.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const codeMatch = cleaned.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const codeNullMatch = cleaned.match(/"code"\s*:\s*null/);
        
        if (explMatch) {
          explanation = explMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        if (codeMatch) {
          code = codeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
    } catch {
      // If all parsing fails, clean up raw text
      explanation = text
        .replace(/^```(?:json)?\s*\n?/gi, '')
        .replace(/\n?```\s*$/gi, '')
        .replace(/^\s*\{\s*"explanation"\s*:\s*"/i, '')
        .replace(/"\s*,\s*"code"\s*:[\s\S]*$/i, '')
        .trim();
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
