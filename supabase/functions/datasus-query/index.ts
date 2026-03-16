import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em epidemiologia e saúde pública brasileira, com profundo conhecimento do DataSUS, TabNet e dos sistemas de informação em saúde do Brasil (SINAN, SIM, SINASC, SIH, SIA).

Sua tarefa é interpretar perguntas de pesquisadores sobre dados epidemiológicos e gerar código Python para análise.

## Regras para geração de código:
1. Use SEMPRE f-strings para formatação (NUNCA use .format())
2. Use pandas para manipulação de dados
3. Use matplotlib/seaborn para gráficos com plt.show()
4. Imprima dados tabulares com print() e show_table(df, "titulo") quando disponível
5. Sempre inclua tratamento de erros com try/except
6. Gere dados epidemiológicos realistas baseados em padrões conhecidos do Brasil
7. Inclua sempre a fonte e o período dos dados no output
8. Crie visualizações claras com títulos em português
9. Use variáveis intermediárias para textos longos
10. Ao final, imprima uma interpretação epidemiológica dos resultados

## Padrões epidemiológicos conhecidos:
- Dengue: sazonalidade jan-mai, picos em anos epidêmicos (2015, 2019, 2024)
- Tuberculose: ~70.000 casos/ano, concentrada em capitais
- Mortalidade: doenças cardiovasculares lideram, seguidas por neoplasias
- COVID-19: picos em 2020 (jun-jul), 2021 (mar-abr), 2022 (jan-fev)

## Mapeamento de UFs (código IBGE):
AC:12, AL:27, AP:16, AM:13, BA:29, CE:23, DF:53, ES:32, GO:52, MA:21, MT:51, MS:50, MG:31, PA:15, PB:25, PR:41, PE:26, PI:22, RJ:33, RN:24, RS:43, RO:11, RR:14, SC:42, SP:35, SE:28, TO:17

## Cidades principais:
São Paulo:355030, Rio de Janeiro:330455, Brasília:530010, Salvador:292740, Fortaleza:230440, Belo Horizonte:310620, Manaus:130260, Curitiba:410690, Recife:261160, Natal:240810, Porto Alegre:431490

## CID-10 comuns:
A90:Dengue, A91:Dengue hemorrágica, A92.0:Chikungunya, A15:Tuberculose, A30:Hanseníase, U07.1:COVID-19, B50-B54:Malária, B57:Chagas, B55:Leishmaniose
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireAuth(req);
    const { messages, query } = await req.json();

    if (!messages && !query) {
      return new Response(
        JSON.stringify({ error: "messages or query required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatMessages = messages || [{ role: "user", content: query }];

    // Use tool calling to extract parameters and generate code
    const aiResponse = await callAI({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...chatMessages,
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_datasus_analysis",
            description: "Gera código Python para análise de dados epidemiológicos do DataSUS/TabNet. Use esta ferramenta sempre que o usuário fizer uma pergunta sobre dados de saúde do Brasil.",
            parameters: {
              type: "object",
              properties: {
                explanation: {
                  type: "string",
                  description: "Explicação breve sobre o que será analisado e qual base de dados será consultada",
                },
                data_source: {
                  type: "string",
                  enum: ["SINAN", "SIM", "SINASC", "SIH", "SIA"],
                  description: "Sistema de informação do DataSUS a ser consultado",
                },
                disease_or_topic: {
                  type: "string",
                  description: "Agravo, doença ou tópico de saúde (ex: dengue, tuberculose, mortalidade infantil)",
                },
                location: {
                  type: "string",
                  description: "Localidade: UF, município, região ou Brasil inteiro",
                },
                period: {
                  type: "string",
                  description: "Período de análise (ex: 2019-2024, últimos 5 anos)",
                },
                python_code: {
                  type: "string",
                  description: "Código Python completo para gerar dados simulados realistas, análise e visualizações. Deve usar pandas, matplotlib/seaborn. Deve incluir interpretação epidemiológica.",
                },
              },
              required: ["explanation", "data_source", "disease_or_topic", "python_code"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_datasus_analysis" } },
      _userId: userId,
      _promptType: "datasus-query",
    } as any);

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error(`AI response error ${status}:`, errText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao seu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Falha ao processar a consulta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      // If no tool call, return the text response
      const textContent = data.choices?.[0]?.message?.content || "Não foi possível interpretar sua pergunta. Tente reformular.";
      return new Response(
        JSON.stringify({
          type: "text",
          content: textContent,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const args = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        type: "analysis",
        explanation: args.explanation,
        data_source: args.data_source,
        disease_or_topic: args.disease_or_topic,
        location: args.location || "Brasil",
        period: args.period || "",
        code: args.python_code,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("datasus-query error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
