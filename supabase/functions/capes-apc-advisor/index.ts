import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CAPES_CATALOG = `
ACORDOS TRANSFORMATIVOS CAPES - EDITORAS E ESCOPOS:

1. SPRINGER NATURE (1.738 periódicos híbridos, 435 instituições)
   Escopo: Multidisciplinar - Ciências Biológicas, Exatas, Engenharias, Saúde, Sociais, Humanas
   Inclui Nature Portfolio, BMC, periódicos Springer

2. ELSEVIER (1.619 periódicos híbridos - Freedom Collection, 434 instituições)
   Escopo: Multidisciplinar - Saúde, Engenharias, Biológicas, Exatas, Agrárias
   Inclui Lancet, Cell, periódicos Elsevier

3. ACM - Association for Computing Machinery (434 instituições)
   Escopo: Ciência da Computação, TI, Engenharia de Software, IA, Sistemas de Informação

4. ROYAL SOCIETY PUBLISHING (10 periódicos, 260 instituições)
   Escopo: Ciências Biológicas, Exatas, Física, Matemática, Química, Engenharias
   Proceedings of the Royal Society A & B, Philosophical Transactions

5. WILEY (periódicos híbridos ilimitados, 434 instituições)
   Escopo: Multidisciplinar - Saúde, Engenharias, Biológicas, Sociais, Humanas

6. IEEE - Institute of Electrical and Electronics Engineers (434 instituições)
   Escopo: Engenharia Elétrica/Eletrônica, Computação, Telecomunicações, Automação, Energia
   Inclui IEEE Access (100% acesso aberto)

7. ACS - American Chemical Society (434 instituições)
   Escopo: Química, Bioquímica, Engenharia Química, Ciência dos Materiais, Farmacologia, Ciências Ambientais
   Inclui JACS, ACS Nano
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { action, articleContent, articleTopic, publisher, language } = await req.json();
    const lang = language || "pt";

    if (action === "suggest_journals") {
      const systemPrompt = `You are an expert academic publishing advisor specializing in CAPES transformative agreements for Brazilian researchers.
You write in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.
Given the researcher's article topic/content, analyze which CAPES agreement publishers best match the article's scope.
Return your analysis as a structured response.`;

      const userPrompt = `Analyze this article and suggest the best CAPES agreement publishers for submission.

CAPES AGREEMENTS CATALOG:
${CAPES_CATALOG}

ARTICLE TOPIC/CONTENT:
${articleTopic || ""}
${articleContent ? `\n\nARTICLE TEXT (excerpt):\n${(articleContent || "").slice(0, 8000)}` : ""}

For each matching publisher, provide:
1. Publisher name and why it matches
2. Specific journal suggestions within that publisher (if possible based on the article scope)
3. Match score (high/medium/low)
4. Key considerations for submission

Rank from best to least match. Only include publishers with at least medium relevance.`;

      const aiResponse = await callAI({
        _userId: auth.userId,
        _promptType: "capes_apc_advisor",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_publishers",
              description: "Return ranked publisher suggestions for the article",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        publisherId: { type: "string", description: "Publisher ID: springer-nature, elsevier, acm, rsp, wiley, ieee, acs" },
                        publisherName: { type: "string" },
                        matchScore: { type: "string", enum: ["high", "medium", "low"] },
                        reasoning: { type: "string", description: "Why this publisher matches the article scope" },
                        suggestedJournals: {
                          type: "array",
                          items: { type: "string" },
                          description: "Specific journal name suggestions within this publisher"
                        },
                        considerations: { type: "string", description: "Key considerations for submission to this publisher" },
                      },
                      required: ["publisherId", "publisherName", "matchScore", "reasoning"],
                    },
                  },
                  articleSummary: { type: "string", description: "Brief summary of the article's main topic and field" },
                },
                required: ["suggestions", "articleSummary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_publishers" } },
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", errText);
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResponse.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const result = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_submission_guidelines") {
      const systemPrompt = `You are an expert academic publishing advisor. 
You write in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.
Provide detailed submission guidelines for a specific publisher under the CAPES transformative agreement.`;

      const userPrompt = `Provide detailed submission guidelines for publishing with ${publisher} under the CAPES agreement.

Include:
1. Step-by-step submission process
2. Typical formatting requirements (article structure, references, figures, word limits)
3. Required documents for submission
4. CAPES-specific requirements (ORCID, institutional affiliation, Portaria 120/2024)
5. How to request APC payment through CAPES
6. Common mistakes to avoid
7. Typical review timeline

${articleContent ? `\nThe researcher is writing about:\n${(articleContent || "").slice(0, 3000)}` : ""}

Be specific and practical. Include actionable steps.`;

      const aiResponse = await callAI({
        _userId: auth.userId,
        _promptType: "capes_apc_advisor",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", errText);
        return new Response(JSON.stringify({ error: "AI generation failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("capes-apc-advisor error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
