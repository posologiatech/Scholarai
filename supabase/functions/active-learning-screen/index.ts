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
    const { question, criteria, manualDecisions, remainingPapers } = await req.json();

    if (!question || !remainingPapers?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build few-shot examples from manual decisions
    const includedExamples = manualDecisions
      ?.filter((d: any) => d.decision === "include")
      ?.slice(0, 10)
      ?.map((d: any) => `- INCLUDED: "${d.title}" (${d.abstract?.slice(0, 150) || "no abstract"})`)
      ?.join("\n") || "";

    const excludedExamples = manualDecisions
      ?.filter((d: any) => d.decision === "exclude")
      ?.slice(0, 10)
      ?.map((d: any) => `- EXCLUDED: "${d.title}" (${d.abstract?.slice(0, 150) || "no abstract"})`)
      ?.join("\n") || "";

    const criteriaDesc = (criteria || [])
      .map((c: any) => `- ${c.name}: ${c.description}`)
      .join("\n");

    const results = [];

    // Process in batches of 15
    for (let i = 0; i < remainingPapers.length; i += 15) {
      const batch = remainingPapers.slice(i, i + 15);

      const papersDesc = batch
        .map((p: any, idx: number) => `Paper ${idx + 1} [ID: ${p.id}]:\nTitle: ${p.title}\nAbstract: ${p.abstract || "No abstract available"}`)
        .join("\n\n");

      const systemPrompt = `You are an Active Learning screening assistant for systematic reviews. You have learned from the reviewer's manual decisions to predict which remaining papers should be included or excluded.

RESEARCH QUESTION: "${question}"

${criteriaDesc ? `SCREENING CRITERIA:\n${criteriaDesc}\n` : ""}
REVIEWER'S MANUAL DECISIONS (learn from these patterns):
${includedExamples ? `\nINCLUDED papers:\n${includedExamples}` : "\nNo included examples yet."}
${excludedExamples ? `\nEXCLUDED papers:\n${excludedExamples}` : "\nNo excluded examples yet."}

Based on the reviewer's inclusion/exclusion patterns, predict the relevance of each remaining paper. Assign a priority score from 0.0 to 1.0 where:
- 1.0 = very likely to be included (matches patterns of included papers)
- 0.5 = uncertain
- 0.0 = very likely to be excluded (matches patterns of excluded papers)

Return a JSON array with:
{
  "paperId": "the paper ID",
  "priorityScore": 0.0-1.0,
  "prediction": "include" | "exclude" | "maybe",
  "reasoning": "brief explanation in Portuguese of why this matches included/excluded patterns"
}`;

      const response = await callAI({
        _userId: auth.userId,
        _promptType: "systematic_review",
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Rank these papers by predicted relevance:\n\n${papersDesc}\n\nReturn JSON array.` },
        ],
        temperature: 0.2,
      });

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const batchResults = JSON.parse(jsonMatch[0]);
        results.push(...batchResults);
      }
    }

    // Sort by priority score descending
    results.sort((a: any, b: any) => (b.priorityScore || 0) - (a.priorityScore || 0));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Active learning error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
