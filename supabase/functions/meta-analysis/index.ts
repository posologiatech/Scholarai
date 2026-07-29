import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkPlanLimit, planLimitExceededResponse } from "../_shared/plan-limits.ts";

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

// ─── Shared regression / distribution helpers for subgroup, meta-regression and publication bias ───

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// p-values below use the normal approximation to the t-distribution (z-test), which is
// standard practice for the sample sizes typical of a systematic review meta-analysis but
// gets conservative for very small k (< ~10 studies) — cross-check borderline results
// against dedicated software (e.g. R's metafor) before relying on them for publication.
function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Weighted least squares regression of y on a single predictor x, weights w. */
function weightedLinearRegression(x: number[], y: number[], w: number[]) {
  const n = x.length;
  const sw = w.reduce((a, b) => a + b, 0) || 1e-9;
  const wx = x.reduce((s, xi, i) => s + w[i] * xi, 0) / sw;
  const wy = y.reduce((s, yi, i) => s + w[i] * yi, 0) / sw;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += w[i] * (x[i] - wx) * (x[i] - wx);
    sxy += w[i] * (x[i] - wx) * (y[i] - wy);
  }
  const slope = sxy / (sxx || 1e-9);
  const intercept = wy - slope * wx;
  let ssResid = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * x[i];
    ssResid += w[i] * (y[i] - pred) * (y[i] - pred);
  }
  const df = Math.max(0, n - 2);
  const sigma2 = df > 0 ? ssResid / df : 0;
  const seSlope = Math.sqrt(sigma2 / (sxx || 1e-9));
  const seIntercept = Math.sqrt(sigma2 * (1 / sw + (wx * wx) / (sxx || 1e-9)));
  return { intercept, slope, seIntercept, seSlope, df, ssResid };
}

/** Egger's regression test for funnel plot asymmetry (unweighted OLS of SND on precision). */
function eggersTest(effects: number[], ses: number[]) {
  const precision = ses.map((se) => 1 / (se || 0.0001));
  const snd = effects.map((e, i) => e / (ses[i] || 0.0001));
  const unitWeights = effects.map(() => 1);
  const reg = weightedLinearRegression(precision, snd, unitWeights);
  const t = reg.intercept / (reg.seIntercept || 1e-9);
  const p = 2 * (1 - normalCDF(Math.abs(t)));
  return { intercept: reg.intercept, se: reg.seIntercept, t, df: reg.df, p };
}

/** Weighted (inverse-variance) meta-regression on a single continuous/coded moderator. */
function metaRegression(effects: number[], ses: number[], moderators: number[]) {
  const weights = ses.map((se) => 1 / (se * se || 0.0001));
  const reg = weightedLinearRegression(moderators, effects, weights);
  const z = reg.slope / (reg.seSlope || 1e-9);
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return {
    intercept: reg.intercept,
    slope: reg.slope,
    seSlope: reg.seSlope,
    z,
    p,
    df: reg.df,
    residualQ: reg.ssResid,
  };
}

/** Between/within-subgroup heterogeneity split (analog to RevMan's subgroup analysis). */
function subgroupAnalysis(studies: { effect: number; se: number; subgroup: string }[]) {
  const groups: Record<string, { effect: number; se: number }[]> = {};
  for (const s of studies) {
    if (!s.subgroup) continue;
    (groups[s.subgroup] ||= []).push({ effect: s.effect, se: s.se });
  }
  const groupNames = Object.keys(groups);
  const perGroup = groupNames.map((name) => {
    const g = groups[name];
    const meta = fixedEffectsMeta(g.map((x) => x.effect), g.map((x) => x.se));
    return { subgroup: name, n: g.length, ...meta };
  });
  const allEffects = studies.map((s) => s.effect);
  const allSes = studies.map((s) => s.se);
  const totalMeta = fixedEffectsMeta(allEffects, allSes);
  const QWithinSum = perGroup.reduce((sum, g) => sum + g.heterogeneity.Q, 0);
  const QBetween = Math.max(0, totalMeta.heterogeneity.Q - QWithinSum);
  const dfBetween = groupNames.length - 1;
  const pBetween = dfBetween > 0 ? 1 - chiSquareCDF(QBetween, dfBetween) : 1;
  return { groups: perGroup, QBetween, dfBetween, pBetween, QWithinSum, totalQ: totalMeta.heterogeneity.Q };
}

/**
 * Duval & Tweedie (2000) non-parametric trim-and-fill, L0 estimator, iterated to
 * convergence. Simplified single-moderator implementation — treat as a screening tool,
 * not a substitute for dedicated software (e.g. R's metafor::trimfill) on borderline cases.
 */
function trimAndFill(effects: number[], ses: number[]) {
  if (effects.length < 3) return { k0: 0, adjustedPooled: null, imputed: [] as { effect: number; se: number }[] };

  let currentEffects = effects.slice();
  let currentSes = ses.slice();
  let theta = fixedEffectsMeta(effects, ses).random.pooled;
  let k0 = 0;
  let trimPositiveSide = true;

  for (let iter = 0; iter < 10; iter++) {
    const k = currentEffects.length;
    if (k < 3) break;
    const centered = currentEffects.map((e) => e - theta);
    const ranked = centered
      .map((d, i) => ({ i, abs: Math.abs(d), sign: Math.sign(d) }))
      .sort((a, b) => a.abs - b.abs)
      .map((x, idx) => ({ ...x, rank: idx + 1 }));
    const srPlus = ranked.filter((x) => x.sign > 0).reduce((s, x) => s + x.rank, 0);
    const expected = (k * (k + 1)) / 4;
    const l0raw = (4 * srPlus - k * (k + 1)) / (2 * k - 1);
    const newK0 = Math.max(0, Math.round(l0raw));
    trimPositiveSide = srPlus > expected;

    if (newK0 === k0 && iter > 0) break;
    k0 = newK0;
    if (k0 === 0) break;

    const order = currentEffects
      .map((e, i) => i)
      .sort((a, b) => (trimPositiveSide ? currentEffects[b] - currentEffects[a] : currentEffects[a] - currentEffects[b]));
    const trimCount = Math.min(k0, Math.max(0, k - 2));
    if (trimCount === 0) break;
    const trimSet = new Set(order.slice(0, trimCount));
    const keptEffects: number[] = [];
    const keptSes: number[] = [];
    for (let i = 0; i < k; i++) {
      if (!trimSet.has(i)) {
        keptEffects.push(currentEffects[i]);
        keptSes.push(currentSes[i]);
      }
    }
    if (keptEffects.length < 2) break;
    theta = fixedEffectsMeta(keptEffects, keptSes).random.pooled;
    currentEffects = keptEffects;
    currentSes = keptSes;
  }

  if (k0 === 0) return { k0: 0, adjustedPooled: null, imputed: [] as { effect: number; se: number }[] };

  const withDeviation = effects.map((e, i) => ({ effect: e, se: ses[i] }));
  const extremeSorted = withDeviation
    .slice()
    .sort((a, b) => (trimPositiveSide ? b.effect - a.effect : a.effect - b.effect));
  const toMirror = extremeSorted.slice(0, Math.min(k0, effects.length));
  const imputed = toMirror.map((x) => ({ effect: 2 * theta - x.effect, se: x.se }));

  const filledEffects = [...effects, ...imputed.map((x) => x.effect)];
  const filledSes = [...ses, ...imputed.map((x) => x.se)];
  const adjusted = fixedEffectsMeta(filledEffects, filledSes);

  return { k0, adjustedPooled: adjusted.random, imputed };
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

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  if (!(await checkPlanLimit(auth.supabase, auth.userId, "meta_analysis"))) {
    return planLimitExceededResponse(corsHeaders, "meta_analysis");
  }

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

      // Publication bias: Egger's regression test + trim-and-fill, whenever there are
      // enough studies for the regression to be meaningful.
      let publicationBias = null;
      if (effects.length >= 3) {
        publicationBias = {
          egger: eggersTest(effects, ses),
          trimAndFill: trimAndFill(effects, ses),
        };
      }

      // Subgroup analysis: only runs when at least one study was tagged with a subgroup label.
      let subgroupResult = null;
      if (results.some((r: any) => r.subgroup)) {
        subgroupResult = subgroupAnalysis(
          results.filter((r: any) => r.subgroup).map((r: any) => ({ effect: r.effect, se: r.se, subgroup: r.subgroup })),
        );
      }

      // Meta-regression: only runs when every study carries a numeric moderator value.
      let metaRegressionResult = null;
      if (results.length >= 3 && results.every((r: any) => typeof r.moderator === "number" && !Number.isNaN(r.moderator))) {
        metaRegressionResult = metaRegression(effects, ses, results.map((r: any) => r.moderator));
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
        publicationBias,
        subgroupResult,
        metaRegressionResult,
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
