import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROB2_DOMAINS = [
  { id: "D1", name: "Randomization process", description: "Was the allocation sequence random? Was the allocation sequence concealed? Were there baseline imbalances?" },
  { id: "D2", name: "Deviations from intended interventions", description: "Were participants aware of assignment? Were there deviations from intended interventions? Was an appropriate analysis used?" },
  { id: "D3", name: "Missing outcome data", description: "Were outcome data available for all participants? Could missingness depend on the outcome?" },
  { id: "D4", name: "Measurement of the outcome", description: "Was the outcome assessor blinded? Could assessment have been influenced by knowledge of intervention?" },
  { id: "D5", name: "Selection of the reported result", description: "Were multiple outcome measurements? Were multiple analyses? Was the result selected from multiple?" },
];

const ROBINS_I_DOMAINS = [
  { id: "D1", name: "Confounding", description: "Were important confounders measured and controlled for?" },
  { id: "D2", name: "Selection of participants", description: "Was selection into the study related to both intervention and outcome?" },
  { id: "D3", name: "Classification of interventions", description: "Was intervention status well defined and classified correctly?" },
  { id: "D4", name: "Deviations from intended interventions", description: "Were there deviations from intended interventions?" },
  { id: "D5", name: "Missing data", description: "Were outcome data reasonably complete?" },
  { id: "D6", name: "Measurement of outcomes", description: "Was outcome measurement objective and unbiased?" },
  { id: "D7", name: "Selection of the reported result", description: "Was the reported result pre-specified?" },
];

const NOS_DOMAINS = [
  { id: "S1", name: "Representativeness of exposed cohort", description: "How representative is the exposed cohort of the average in the community?" },
  { id: "S2", name: "Selection of non-exposed cohort", description: "Where was the non-exposed cohort drawn from?" },
  { id: "S3", name: "Ascertainment of exposure", description: "How was the exposure ascertained?" },
  { id: "S4", name: "Outcome not present at start", description: "Was it demonstrated that the outcome was not present at start of study?" },
  { id: "C1", name: "Comparability (main factor)", description: "Were cohorts comparable on the basis of design or analysis for the most important factor?" },
  { id: "C2", name: "Comparability (additional)", description: "Were cohorts comparable for any additional factor?" },
  { id: "O1", name: "Assessment of outcome", description: "How was the outcome assessed?" },
  { id: "O2", name: "Follow-up length", description: "Was follow-up long enough for outcomes to occur?" },
  { id: "O3", name: "Adequacy of follow-up", description: "Were losses to follow-up adequate?" },
];

function getFrameworkDomains(framework: string) {
  switch (framework) {
    case "rob2": return ROB2_DOMAINS;
    case "robins-i": return ROBINS_I_DOMAINS;
    case "nos": return NOS_DOMAINS;
    default: return ROB2_DOMAINS;
  }
}

function getJudgmentScale(framework: string) {
  if (framework === "nos") return "Star (⭐) or No Star for each domain. Total score out of 9 stars.";
  return "Low risk, Some concerns, High risk, or No information for each domain. Overall judgment: Low risk / Some concerns / High risk.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { action, papers, framework, stream } = await req.json();

    if (action === "get_framework_info") {
      const domains = getFrameworkDomains(framework);
      return new Response(JSON.stringify({ domains, scale: getJudgmentScale(framework) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assess") {
      const domains = getFrameworkDomains(framework);
      const frameworkName = framework === "rob2" ? "RoB 2 (Cochrane)" : framework === "robins-i" ? "ROBINS-I" : "Newcastle-Ottawa Scale (NOS)";
      const scale = getJudgmentScale(framework);

      const paperDescriptions = (papers || []).map((p: any, i: number) =>
        `Study ${i + 1}: "${p.title}" by ${Array.isArray(p.authors) ? p.authors.slice(0, 3).join(", ") : p.authors || "Unknown"}${p.year ? ` (${p.year})` : ""}${p.abstract ? `\nAbstract: ${p.abstract}` : ""}`
      ).join("\n\n");

      const domainList = domains.map(d => `- ${d.id}: ${d.name} — ${d.description}`).join("\n");

      const systemPrompt = `You are an expert methodologist specializing in systematic reviews and risk of bias assessment. You assess study quality using the ${frameworkName} framework.

DOMAINS TO ASSESS:
${domainList}

JUDGMENT SCALE: ${scale}

You MUST return a valid JSON object with this structure:
{
  "assessments": [
    {
      "study_index": 0,
      "study_title": "...",
      "domains": [
        {
          "domain_id": "D1",
          "domain_name": "...",
          "judgment": "Low risk" | "Some concerns" | "High risk" | "No information" (or "Star" | "No Star" for NOS),
          "rationale": "Brief justification for this judgment"
        }
      ],
      "overall_judgment": "Low risk" | "Some concerns" | "High risk" (or total stars "7/9" for NOS),
      "overall_rationale": "Brief overall assessment summary"
    }
  ]
}

Be conservative — if information is insufficient, mark as "Some concerns" or "No information". Base assessments solely on what can be inferred from the title, abstract, and any provided details.`;

      if (stream) {
        const aiRes = await callAI({
          _userId: auth.userId,
          _promptType: "risk_of_bias",
          model: "google/gemini-3-flash-preview",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Assess the following studies using ${frameworkName}:\n\n${paperDescriptions}` },
          ],
        });

        return new Response(aiRes.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }

      const aiRes = await callAI({
        _userId: auth.userId,
        _promptType: "risk_of_bias",
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Assess the following studies using ${frameworkName}:\n\n${paperDescriptions}` },
        ],
      });

      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || "";

      // Extract JSON from response
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { assessments: [] };
      } catch {
        parsed = { assessments: [], raw: content };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("risk-of-bias error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
