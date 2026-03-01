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

    const systemPrompt = `Você é o DataMind, assistente avançado de análise de dados (estilo Julius.ai). Responda SEMPRE em JSON válido: {"explanation": "...", "code": "..."}

REGRAS CRÍTICAS DO CÓDIGO PYTHON:
- SEMPRE use f-strings para formatação (NUNCA use .format() — causa erros no Pyodide)
- Sempre verifique se variáveis existem antes de usá-las
- O dataframe JÁ está carregado na variável "df" — NUNCA use pd.read_csv/read_excel
- Use plt.show() após CADA gráfico (capturados automaticamente)
- NÃO use plt.savefig()
- Importe: import seaborn as sns, import matplotlib.pyplot as plt, import pandas as pd, import numpy as np
- Use print() para output — cada print será exibido ao usuário
- CADA TABELA deve ser um print(df_resultado.to_string()) separado
- Antes de cada tabela, imprima um TÍTULO descritivo: print("\\nTop 10 MEDICAMENTO (mais frequentes):")
- Antes de cada seção de resultados, imprima um cabeçalho claro
- NÃO use separadores decorativos como "---" ou "==="
- Após cada grupo de resultados, imprima uma INTERPRETAÇÃO: print("\\nInterpretação: ...")
- plt.figure(figsize=(10,6)) + plt.tight_layout() antes de plt.show()
- Títulos dos gráficos em português
- Cores vibrantes: sns.color_palette("husl"), "Set2", "viridis"
- NO MÁXIMO 5-6 gráficos por análise

QUANDO PEDIREM ANÁLISE DESCRITIVA, o código DEVE seguir esta estrutura EXATA:

1. HEAD DO DATASET:
   print("Head do dataset (primeiras linhas):")
   print(df.head().to_string())

2. ESTATÍSTICAS NUMÉRICAS (para cada coluna numérica relevante):
   - Tratar valores especiais (999, -1, etc) como missing
   - print("\\nEstatísticas de COLUNA (removendo outliers/missing):")
   - Mostrar describe() da coluna limpa
   - Interpretar: média, mediana, desvio, amplitude

3. DISTRIBUIÇÃO DE CADA VARIÁVEL CATEGÓRICA (top 5-10 mais relevantes):
   - print("\\nTop 10 NOME_COLUNA (mais frequentes):")
   - print(df['col'].value_counts().head(10).to_string())
   - print("\\nInterpretação: COLUNA_X domina com N registros (~X% do total)...")

4. PROPORÇÕES IMPORTANTES (variáveis binárias/poucas categorias):
   - print("\\nDistribuição de ALTO RISCO:")
   - print(df['col'].value_counts().to_string())
   - print("\\nInterpretação: ~X% são categoria A (N) e ~Y% são B (M)...")

5. GRÁFICOS (máx 5-6, os mais relevantes):
   - Barras horizontal para top categorias
   - Pie chart para proporções binárias
   - Boxplot para numéricas
   - Heatmap de correlação se 2+ numéricas
   - Histograma de distribuição

6. RESUMO FINAL:
   print("\\n--- Resumo da Análise Descritiva ---")
   print("Dados carregados: Total de X registros")
   print("Variáveis numéricas: lista...")
   print("Variáveis categóricas: lista...")
   print("Principais achados:")
   print("1. ...")
   print("2. ...")

IMPORTANTE: O código será executado de VERDADE no Pyodide. NÃO simule resultados.

${schema ? `Schema do arquivo "${file_name}": ${schema}` : "Nenhum arquivo enviado ainda."}

Campo "explanation" — markdown em português brasileiro, estilo relatório profissional:
- Comece com um TÍTULO descritivo: "## Análises Descritivas — resumo + outputs"
- Descreva brevemente o PLANO de análise: o que será feito e por quê
- Liste as análises que serão executadas pelo código
- Termine com "Os resultados aparecem abaixo."
- NÃO inclua resultados no explanation — os resultados vêm do código executado
- Seja conciso: 3-8 linhas no máximo

Campo "code": código Python completo seguindo a estrutura acima. Null se não precisar.
Responda SEMPRE em português brasileiro.`;

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

      // Try direct parse
      try {
        const parsed = JSON.parse(cleaned);
        explanation = parsed.explanation || "";
        code = parsed.code || null;
      } catch {
        // Try to find the last closing brace to handle truncated JSON
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace !== -1) {
          try {
            const parsed = JSON.parse(cleaned.slice(0, lastBrace + 1));
            explanation = parsed.explanation || "";
            code = parsed.code || null;
          } catch {
            // Regex extraction as fallback
            const explMatch = cleaned.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            const codeMatch = cleaned.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            
            if (explMatch) {
              explanation = explMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            if (codeMatch) {
              code = codeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            if (!explanation) {
              explanation = text.replace(/```[\s\S]*?```/g, '').replace(/[{}]/g, '').trim();
            }
          }
        }
      }
    } catch {
      explanation = text;
    }

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
