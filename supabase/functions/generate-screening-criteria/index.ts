import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

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
      : `You are a systematic review expert. Given a research question, suggest 3-5 broad screening criteria (inclusion/exclusion) to determine paper relevance. Keep criteria BROAD and THEMATIC — they should capture general topical relevance, not narrow methodological requirements.

Each criterion should have:
- id: a unique short identifier (lowercase, no spaces)
- name: a concise label for the criterion
- description: detailed description of what the criterion evaluates

IMPORTANT: Generate only 3 to 5 criteria. Focus on broad thematic relevance (e.g., "Related to the topic area", "Addresses the population of interest"). Do NOT create overly specific criteria that would exclude papers prematurely. The goal of initial screening is to be INCLUSIVE.

Return JSON array of objects with keys: id, name, description.`;

    const response = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Research question: "${question}"\n\nGenerate the ${isExtraction ? "extraction fields" : "screening criteria"} as a JSON array.` },
      ],
      temperature: 0.3,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI response error:", response.status, errText);
      throw new Error(`AI call failed with status ${response.status}`);
    }

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
