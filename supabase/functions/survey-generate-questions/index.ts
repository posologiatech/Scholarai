import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const { research_objective, existing_questions, question_count, language } = await req.json();

    if (!research_objective) {
      return new Response(
        JSON.stringify({ error: "research_objective is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const count = question_count || 5;
    const lang = language || "en";

    const systemPrompt = `You are an expert academic survey methodologist. You specialize in creating validated, psychometrically sound survey instruments for research purposes.

When generating questions, follow these principles:
- Use clear, unambiguous language appropriate for academic research
- Avoid double-barreled questions
- Include a mix of question types for comprehensive data collection
- Consider validated scales (e.g., Likert) when appropriate
- Include demographic and control variables when relevant
- Ensure questions are neutral and avoid leading language

You MUST respond using the suggest_questions tool.`;

    const userPrompt = `Research objective: ${research_objective}

${existing_questions?.length ? `Existing questions in the survey:\n${existing_questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}\n\nGenerate ${count} NEW questions that complement the existing ones without duplication.` : `Generate ${count} well-structured survey questions for this research objective.`}

Language: ${lang === "pt" ? "Brazilian Portuguese" : "English"}

For each question, specify the most appropriate question type from: multiple_choice, text_entry, matrix_table, slider, rank_order, constant_sum.

For multiple_choice, include 3-6 answer choices.
For matrix_table, include 2-4 row statements and appropriate Likert scale columns.
For slider, specify appropriate min/max values.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_questions",
          description: "Return suggested survey questions with their configuration",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_text: { type: "string", description: "The question text" },
                    question_type: {
                      type: "string",
                      enum: ["multiple_choice", "text_entry", "matrix_table", "slider", "rank_order", "constant_sum"],
                    },
                    description: { type: "string", description: "Optional helper text for the respondent" },
                    is_required: { type: "boolean" },
                    choices: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          value: { type: "string" },
                        },
                        required: ["text", "value"],
                        additionalProperties: false,
                      },
                      description: "For multiple_choice, rank_order, constant_sum",
                    },
                    matrix_rows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { text: { type: "string" } },
                        required: ["text"],
                        additionalProperties: false,
                      },
                      description: "For matrix_table: statement rows",
                    },
                    matrix_columns: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { text: { type: "string" } },
                        required: ["text"],
                        additionalProperties: false,
                      },
                      description: "For matrix_table: scale columns",
                    },
                    settings: {
                      type: "object",
                      description: "Type-specific settings (min, max, step for slider, multiline for text_entry, total for constant_sum)",
                    },
                  },
                  required: ["question_text", "question_type", "is_required"],
                  additionalProperties: false,
                },
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      },
    ];

    // Use callAI which tries the admin's configured external providers, in priority order
    const response = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "suggest_questions" } },
      _userId: userId,
      _promptType: "survey-generate-questions",
    } as any);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI error:", status, errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "No questions generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generated = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(generated),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("survey-generate-questions error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
