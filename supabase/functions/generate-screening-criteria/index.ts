import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, mode } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Missing question" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isExtraction = mode === "extraction";

    const systemPrompt = isExtraction
      ? `You are a systematic review expert. Given a research question, suggest 5-8 data extraction fields that should be extracted from each included paper. Each field should have:
- id: a unique short identifier (lowercase, no spaces)
- name: a concise label for the field
- description: detailed instructions on what to extract and how

Return JSON array of objects with keys: id, name, description.
Focus on: study design, population characteristics, intervention/exposure details, outcome measures, key findings, sample size, and any domain-specific metrics.`
      : `You are a systematic review expert. Given a research question, suggest 5-8 screening criteria (inclusion/exclusion) that should be used to determine which papers are relevant. Each criterion should have:
- id: a unique short identifier (lowercase, no spaces)
- name: a concise label for the criterion
- description: detailed description of what the criterion evaluates

Return JSON array of objects with keys: id, name, description.
Focus on: population, intervention/exposure, outcome, study design, language, publication type.`;

    const response = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Research question: "${question}"\n\nGenerate the ${isExtraction ? "extraction fields" : "screening criteria"} as a JSON array.` },
      ],
      temperature: 0.3,
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "[]";

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const criteria = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ criteria }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating criteria:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
