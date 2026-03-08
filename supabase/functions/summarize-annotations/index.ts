import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { annotations, locale } = await req.json();

    if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No annotations provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const annotationTexts = annotations
      .map(
        (a: any, i: number) =>
          `[${i + 1}] ${a.paper_title ? `Paper: "${a.paper_title}" — ` : ""}${a.content}`
      )
      .join("\n\n");

    const systemPrompt =
      locale === "pt"
        ? `Você é um assistente de pesquisa acadêmica. Seu trabalho é resumir anotações de pesquisa de forma clara, estruturada e acadêmica. 
Produza um resumo coeso que identifique os temas principais, conexões entre as anotações e insights-chave. 
Use linguagem formal e acadêmica. Formate o resumo com subtítulos quando apropriado.
Responda SEMPRE em português brasileiro.`
        : `You are an academic research assistant. Your job is to summarize research annotations in a clear, structured, and academic manner.
Produce a cohesive summary that identifies main themes, connections between annotations, and key insights.
Use formal academic language. Format the summary with subheadings when appropriate.
Always respond in English.`;

    const response = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            locale === "pt"
              ? `Resuma as seguintes ${annotations.length} anotações de pesquisa de um workspace acadêmico:\n\n${annotationTexts}`
              : `Summarize the following ${annotations.length} research annotations from an academic workspace:\n\n${annotationTexts}`,
        },
      ],
      _promptType: "workspace-summary",
    } as any);

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI response error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI summarization failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("summarize-annotations error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
