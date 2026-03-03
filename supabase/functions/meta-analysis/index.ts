import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Statistical helper functions ───

function cohensD(m1: number, sd1: number, n1: number, m2: number, sd2: number, n2: number) {
  const pooledSD = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2));
  if (pooledSD === 0) return { d: 0, se: 0, ci_lower: 0, ci_upper: 0 };
  const d = (m1 - m2) / pooledSD;
  const se = Math.sqrt((n1 + n2) / (n1 * n2) + (d * d) / (2 * (n1 + n2)));
  return { d, se, ci_lower: d - 1.96 * se, ci_upper: d + 1.96 * se };
}

function oddsRatio(a: number, b: number, c: number, d: number) {
  // a=events_exp, b=nonevents_exp, c=events_ctrl, d=nonevents_ctrl
  const or = (a * d) / (b * c || 1);
  const lnOR = Math.log(or || 0.001);
  const seLnOR = Math.sqrt(1 / (a || 1) + 1 / (b || 1) + 1 / (c || 1) + 1 / (d || 1));
  return {
    or,
    lnOR,
    se: seLnOR,
    ci_lower: Math.exp(lnOR - 1.96 * seLnOR),
    ci_upper: Math.exp(lnOR + 1.96 * seLnOR),
  };
}

function riskRatio(a: number, n1: number, c: number, n2: number) {
  const p1 = a / (n1 || 1);
  const p2 = c / (n2 || 1);
  const rr = p1 / (p2 || 0.001);
  const lnRR = Math.log(rr || 0.001);
  const seLnRR = Math.sqrt((1 - p1) / (a || 1) + (1 - p2) / (c || 1));
  return {
    rr,
    lnRR,
    se: seLnRR,
    ci_lower: Math.exp(lnRR - 1.96 * seLnRR),
    ci_upper: Math.exp(lnRR + 1.96 * seLnRR),
  };
}

function fixedEffectsMeta(effects: number[], ses: number[]) {
  const weights = ses.map(se => 1 / (se * se || 0.0001));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pooled = weights.reduce((sum, w, i) => sum + w * effects[i], 0) / (totalW || 1);
  const pooledSE = Math.sqrt(1 / (totalW || 1));

  // Q statistic
  const Q = weights.reduce((sum, w, i) => sum + w * Math.pow(effects[i] - pooled, 2), 0);
  const df = effects.length - 1;
  const pQ = df > 0 ? 1 - chiSquareCDF(Q, df) : 1;

  // I²
  const I2 = df > 0 ? Math.max(0, ((Q - df) / Q) * 100) : 0;

  // Tau² (DerSimonian-Laird)
  const C = totalW - weights.reduce((s, w) => s + w * w, 0) / totalW;
  const tau2 = Math.max(0, (Q - df) / (C || 1));

  // Random effects
  const reWeights = ses.map(se => 1 / (se * se + tau2 || 0.0001));
  const reTotalW = reWeights.reduce((a, b) => a + b, 0);
  const rePooled = reWeights.reduce((sum, w, i) => sum + w * effects[i], 0) / (reTotalW || 1);
  const rePooledSE = Math.sqrt(1 / (reTotalW || 1));

  return {
    fixed: { pooled, se: pooledSE, ci_lower: pooled - 1.96 * pooledSE, ci_upper: pooled + 1.96 * pooledSE },
    random: { pooled: rePooled, se: rePooledSE, ci_lower: rePooled - 1.96 * rePooledSE, ci_upper: rePooled + 1.96 * rePooledSE },
    heterogeneity: { Q, df, pQ, I2, tau2 },
    weights,
    reWeights,
  };
}

function chiSquareCDF(x: number, k: number): number {
  // Approximate chi-square CDF using regularized gamma function
  if (x <= 0) return 0;
  const a = k / 2;
  const z = x / 2;
  let sum = 0;
  let term = Math.exp(-z) * Math.pow(z, a) / gamma(a + 1);
  for (let n = 0; n < 200; n++) {
    sum += term;
    term *= z / (a + n + 1);
    if (Math.abs(term) < 1e-12) break;
  }
  return sum;
}

function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, studies, effectType, language } = await req.json();

    if (action === "calculate") {
      const results = studies.map((s: any, i: number) => {
        let effect: any;
        if (effectType === "cohens_d") {
          effect = cohensD(s.mean1, s.sd1, s.n1, s.mean2, s.sd2, s.n2);
          return { ...s, index: i, effect: effect.d, se: effect.se, ci_lower: effect.ci_lower, ci_upper: effect.ci_upper };
        } else if (effectType === "odds_ratio") {
          effect = oddsRatio(s.events1, s.n1 - s.events1, s.events2, s.n2 - s.events2);
          return { ...s, index: i, effect: effect.lnOR, or: effect.or, se: effect.se, ci_lower: effect.ci_lower, ci_upper: effect.ci_upper };
        } else if (effectType === "risk_ratio") {
          effect = riskRatio(s.events1, s.n1, s.events2, s.n2);
          return { ...s, index: i, effect: effect.lnRR, rr: effect.rr, se: effect.se, ci_lower: effect.ci_lower, ci_upper: effect.ci_upper };
        }
        return s;
      });

      const effects = results.map((r: any) => r.effect);
      const ses = results.map((r: any) => r.se);
      const meta = fixedEffectsMeta(effects, ses);

      // For OR/RR, convert pooled back to natural scale
      let pooledDisplay = meta.random.pooled;
      let pooledCILower = meta.random.ci_lower;
      let pooledCIUpper = meta.random.ci_upper;
      if (effectType === "odds_ratio" || effectType === "risk_ratio") {
        pooledDisplay = Math.exp(meta.random.pooled);
        pooledCILower = Math.exp(meta.random.ci_lower);
        pooledCIUpper = Math.exp(meta.random.ci_upper);
      }

      return new Response(JSON.stringify({
        studies: results,
        meta: {
          ...meta,
          pooledDisplay,
          pooledCILower,
          pooledCIUpper,
        },
        effectType,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "interpret") {
      const lang = language || "pt";
      const prompt = `You are a biostatistician. Interpret the following meta-analysis results in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.

Effect type: ${effectType}
Number of studies: ${studies.length}
Pooled effect (random): ${studies.pooledDisplay} (95% CI: ${studies.pooledCILower} - ${studies.pooledCIUpper})
Heterogeneity: I² = ${studies.I2}%, Q = ${studies.Q} (p = ${studies.pQ}), τ² = ${studies.tau2}

Provide:
1. Interpretation of the pooled effect
2. Clinical significance assessment
3. Heterogeneity interpretation (low/moderate/high)
4. Publication bias risk assessment
5. Limitations and recommendations`;

      const aiResp = await callAI({
        messages: [
          { role: "system", content: "You are an expert biostatistician writing meta-analysis interpretations for academic papers." },
          { role: "user", content: prompt },
        ],
        stream: true,
      });

      return new Response(aiResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("meta-analysis error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
