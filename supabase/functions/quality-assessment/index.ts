import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CHECKLISTS: Record<string, { name: string; domains: { id: string; name: string; description: string }[] }> = {
  casp_rct: {
    name: "CASP RCT Checklist",
    domains: [
      { id: "q1", name: "Focused question", description: "Did the study address a clearly focused research question?" },
      { id: "q2", name: "Randomization", description: "Was the assignment of participants to interventions randomized?" },
      { id: "q3", name: "Allocation concealment", description: "Were all participants who entered the study accounted for at its conclusion?" },
      { id: "q4", name: "Blinding", description: "Were participants, investigators and outcome assessors blinded?" },
      { id: "q5", name: "Similar groups", description: "Were the groups similar at the start of the trial?" },
      { id: "q6", name: "Equal treatment", description: "Aside from the experimental intervention, were the groups treated equally?" },
      { id: "q7", name: "Treatment effect", description: "How large was the treatment effect?" },
      { id: "q8", name: "Precision", description: "How precise was the estimate of the treatment effect?" },
      { id: "q9", name: "Applicability", description: "Can the results be applied to the local population/context?" },
      { id: "q10", name: "Outcomes considered", description: "Were all clinically important outcomes considered?" },
      { id: "q11", name: "Benefits vs harms", description: "Are the benefits worth the harms and costs?" },
    ],
  },
  newcastle_ottawa: {
    name: "Newcastle-Ottawa Scale",
    domains: [
      { id: "s1", name: "Representativeness of exposed cohort", description: "Is the exposed cohort truly representative?" },
      { id: "s2", name: "Selection of non-exposed cohort", description: "Was the non-exposed cohort drawn from the same community?" },
      { id: "s3", name: "Ascertainment of exposure", description: "Was the exposure ascertained via secure record or structured interview?" },
      { id: "s4", name: "Outcome not present at start", description: "Was the outcome of interest not present at start of study?" },
      { id: "c1", name: "Comparability (main factor)", description: "Were cohorts comparable on the basis of design or analysis for the main confounding factor?" },
      { id: "c2", name: "Comparability (additional)", description: "Were cohorts comparable for additional confounding factors?" },
      { id: "o1", name: "Assessment of outcome", description: "Was the outcome assessed by independent blind assessment or record linkage?" },
      { id: "o2", name: "Follow-up length", description: "Was follow-up long enough for outcomes to occur?" },
      { id: "o3", name: "Adequacy of follow-up", description: "Was the follow-up of cohorts adequate (≥80% completion)?" },
    ],
  },
  jadad: {
    name: "Jadad Scale",
    domains: [
      { id: "j1", name: "Randomization described", description: "Was the study described as randomized?" },
      { id: "j2", name: "Randomization appropriate", description: "Was the method of randomization appropriate?" },
      { id: "j3", name: "Double-blind described", description: "Was the study described as double-blind?" },
      { id: "j4", name: "Blinding appropriate", description: "Was the method of blinding appropriate?" },
      { id: "j5", name: "Withdrawals described", description: "Was there a description of withdrawals and dropouts?" },
    ],
  },
  robins_i: {
    name: "ROBINS-I",
    domains: [
      { id: "d1", name: "Confounding", description: "Bias due to confounding" },
      { id: "d2", name: "Selection", description: "Bias in selection of participants into the study" },
      { id: "d3", name: "Classification", description: "Bias in classification of interventions" },
      { id: "d4", name: "Deviations", description: "Bias due to deviations from intended interventions" },
      { id: "d5", name: "Missing data", description: "Bias due to missing data" },
      { id: "d6", name: "Measurement", description: "Bias in measurement of outcomes" },
      { id: "d7", name: "Reporting", description: "Bias in selection of the reported result" },
    ],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { papers, checklist, question, locale } = await req.json();

    if (!papers?.length || !checklist) {
      return new Response(JSON.stringify({ error: "Missing papers or checklist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checklistConfig = CHECKLISTS[checklist];
    if (!checklistConfig) {
      return new Response(JSON.stringify({ error: `Unknown checklist: ${checklist}`, availableChecklists: Object.keys(CHECKLISTS) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const lang = locale === "pt" ? "Portuguese (pt-BR)" : "English";

    // Process papers in batches of 5
    for (let i = 0; i < papers.length; i += 5) {
      const batch = papers.slice(i, i + 5);

      const domainsDesc = checklistConfig.domains
        .map((d) => `- ${d.id} (${d.name}): ${d.description}`)
        .join("\n");

      const papersDesc = batch
        .map((p: any, idx: number) => `Paper ${idx + 1} [ID: ${p.id}]:\nTitle: ${p.title}\nAuthors: ${(p.authors || []).join(", ")}\nYear: ${p.year || "N/A"}\nAbstract: ${p.abstract || "No abstract"}\nJournal: ${p.journal || "N/A"}`)
        .join("\n\n---\n\n");

      const systemPrompt = `You are a methodological quality assessment expert. Evaluate each paper using the ${checklistConfig.name} checklist.

Research question context: "${question || "Not specified"}"

For each paper and each domain, provide:
- rating: "yes", "no", "unclear", or "not_applicable"  
- For ROBINS-I: "low", "moderate", "serious", "critical", or "no_information"
- justification: brief explanation in ${lang}

Also provide an overall quality score:
- For CASP: count of "yes" answers out of total
- For NOS: star count (0-9)
- For Jadad: score (0-5) 
- For ROBINS-I: overall risk of bias judgment

Return JSON array:
[{
  "paperId": "id",
  "checklist": "${checklist}",
  "domains": { "domain_id": { "rating": "...", "justification": "..." } },
  "overallScore": number or string,
  "overallJudgment": "high_quality" | "moderate_quality" | "low_quality",
  "summary": "brief quality summary in ${lang}"
}]`;

      const response = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${checklistConfig.name} domains:\n${domainsDesc}\n\nPapers to evaluate:\n${papersDesc}\n\nReturn JSON array.`,
          },
        ],
        temperature: 0.2,
      });

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results.push(...JSON.parse(jsonMatch[0]));
      }
    }

    return new Response(JSON.stringify({ results, checklist: checklistConfig }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Quality assessment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
