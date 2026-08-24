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
    const { question, papers, criteria } = await req.json();

    if (!question || !papers?.length || !criteria?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    // Process papers in batches of 10 for efficiency
    for (let i = 0; i < papers.length; i += 10) {
      const batch = papers.slice(i, i + 10);

      const criteriaDesc = criteria
        .map((c: any) => `- ${c.id} (${c.name}): ${c.description}`)
        .join("\n");

      const papersDesc = batch
        .map((p: any, idx: number) => `Paper ${idx + 1} [ID: ${p.id}]:\nTitle: ${p.title}\nAbstract: ${p.abstract || "No abstract available"}`)
        .join("\n\n");

      const systemPrompt = `You are a systematic review screening assistant following the INCLUSIVE screening principle (sensitivity over specificity). Your goal is to KEEP papers unless they are CLEARLY irrelevant.

CRITICAL RULES:
1. When in doubt, INCLUDE the paper (answer "yes" or "maybe", NEVER "no")
2. Papers with missing or empty abstracts ("No abstract available") should receive recommendation "maybe" with inclusionScore >= 0.5. Judge ONLY by the title.
3. Only mark a criterion as "no" if the title/abstract EXPLICITLY contradicts it
4. Lack of information is NOT a reason to exclude — assume relevance unless proven otherwise
5. Only recommend "exclude" when the paper is OBVIOUSLY and COMPLETELY unrelated to the research question (e.g., a paper about astrophysics in a medical review)

For each paper, provide:
1. An assessment for each criterion: "yes", "no", or "maybe" with a brief explanation IN PORTUGUESE (pt-BR)
2. An overall inclusion score from 0.0 to 1.0 (bias toward higher scores — use 0.5+ for uncertain cases)
3. A recommendation: "include" (score >= 0.7), "maybe" (score 0.3-0.7), or "exclude" (score < 0.3, only for clearly irrelevant papers)

IMPORTANT: All explanations MUST be in Portuguese (pt-BR). The answer field must remain "yes", "no", or "maybe" in English.

Return a JSON array where each element has:
{
  "paperId": "the paper ID",
  "criteria": { "criterion_id": { "answer": "yes|no|maybe", "explanation": "explicação breve em português" } },
  "inclusionScore": 0.0-1.0,
  "recommendation": "include|exclude|maybe"
}`;

      const response = await callAI({
        _userId: auth.userId,
        _promptType: "systematic_review",
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Research question: "${question}"

Screening criteria:
${criteriaDesc}

Papers to evaluate:
${papersDesc}

Return the evaluation as a JSON array.`,
          },
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

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error screening papers:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
