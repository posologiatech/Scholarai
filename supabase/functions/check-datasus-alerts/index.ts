import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* Capital geocodes for state-level InfoDengue queries */
const STATE_CAPITAL_GEOCODE: Record<string, string> = {
  "12": "1200401", "27": "2704302", "16": "1600303", "13": "1302603",
  "29": "2927408", "23": "2304400", "53": "5300108", "32": "3205309",
  "52": "5208707", "21": "2111300", "51": "5103403", "50": "5002704",
  "31": "3106200", "15": "1501402", "25": "2507507", "41": "4106902",
  "26": "2611606", "22": "2211001", "33": "3304557", "24": "2408102",
  "43": "4314902", "11": "1100205", "14": "1400100", "42": "4205407",
  "35": "3550308", "28": "2800308", "17": "1721000",
};

const STATE_IBGE_TO_NAME: Record<string, string> = {
  "12": "Acre", "27": "Alagoas", "16": "Amapá", "13": "Amazonas",
  "29": "Bahia", "23": "Ceará", "53": "Distrito Federal", "32": "Espírito Santo",
  "52": "Goiás", "21": "Maranhão", "51": "Mato Grosso", "50": "Mato Grosso do Sul",
  "31": "Minas Gerais", "15": "Pará", "25": "Paraíba", "41": "Paraná",
  "26": "Pernambuco", "22": "Piauí", "33": "Rio de Janeiro", "24": "Rio Grande do Norte",
  "43": "Rio Grande do Sul", "11": "Rondônia", "14": "Roraima", "42": "Santa Catarina",
  "35": "São Paulo", "28": "Sergipe", "17": "Tocantins",
};

function mapDiseaseToInfoDengue(disease: string): string | null {
  const d = disease.toLowerCase();
  if (d.includes("dengue")) return "dengue";
  if (d.includes("chikungunya") || d.includes("chik")) return "chikungunya";
  if (d.includes("zika")) return "zika";
  return null;
}

interface WeeklyData {
  SE: number;
  casos_est: number;
  casos: number;
  nivel: number;
}

async function fetchRecentWeeks(geocode: string, disease: string, weeksBack: number): Promise<WeeklyData[]> {
  const now = new Date();
  const year = now.getFullYear();
  try {
    const url = `https://info.dengue.mat.br/api/alertcity?geocode=${geocode}&disease=${disease}&format=json&ew_start=1&ew_end=52&ey_start=${year - 1}&ey_end=${year}`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    // Sort by SE descending and take last N weeks
    const sorted = data.sort((a: any, b: any) => b.SE - a.SE);
    return sorted.slice(0, weeksBack).map((r: any) => ({
      SE: r.SE,
      casos_est: Math.round(r.casos_est || 0),
      casos: r.casos || 0,
      nivel: r.nivel || 0,
    }));
  } catch {
    return [];
  }
}

function computeZScore(recentValues: number[], historicalMean: number, historicalStd: number): number {
  if (historicalStd === 0) return 0;
  const currentMean = recentValues.reduce((s, v) => s + v, 0) / recentValues.length;
  return (currentMean - historicalMean) / historicalStd;
}

function determineAlertLevel(zScore: number, threshold: number): string {
  if (zScore >= threshold * 1.5) return "red";
  if (zScore >= threshold) return "orange";
  if (zScore >= threshold * 0.5) return "yellow";
  return "green";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all active alerts
    const { data: alerts, error: alertsErr } = await supabase
      .from("datasus_alerts")
      .select("*")
      .eq("is_active", true);

    if (alertsErr) throw alertsErr;
    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalChecked = 0;
    let totalAlerts = 0;

    for (const alert of alerts) {
      const infoDengueDisease = mapDiseaseToInfoDengue(alert.disease);
      if (!infoDengueDisease) continue; // Only arboviruses supported for now

      const stateCodes: string[] = alert.state_codes || [];
      if (stateCodes.length === 0) continue;

      for (const stateCode of stateCodes) {
        const geocode = STATE_CAPITAL_GEOCODE[stateCode];
        if (!geocode) continue;
        const stateName = STATE_IBGE_TO_NAME[stateCode] || stateCode;

        const recentWeeks = await fetchRecentWeeks(geocode, infoDengueDisease, 52);
        if (recentWeeks.length < 8) continue;

        // Split: last 4 weeks vs historical (rest)
        const last4 = recentWeeks.slice(0, 4).map(w => w.casos_est);
        const historical = recentWeeks.slice(4).map(w => w.casos_est);

        const histMean = historical.reduce((s, v) => s + v, 0) / historical.length;
        const histStd = Math.sqrt(
          historical.reduce((s, v) => s + (v - histMean) ** 2, 0) / historical.length
        );

        const zScore = computeZScore(last4, histMean, histStd);
        const alertLevel = determineAlertLevel(zScore, alert.threshold_std_dev);

        totalChecked++;

        if (alertLevel !== "green") {
          const currentMean = last4.reduce((s, v) => s + v, 0) / last4.length;
          const highestNivel = recentWeeks.slice(0, 4).reduce((max, w) => Math.max(max, w.nivel), 0);

          // Check if similar alert already exists in last 7 days
          const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
          const { data: existing } = await supabase
            .from("datasus_alert_results")
            .select("id")
            .eq("alert_id", alert.id)
            .eq("location", stateName)
            .gte("detected_at", weekAgo)
            .limit(1);

          if (existing && existing.length > 0) continue;

          const levelLabel = alertLevel === "red" ? "CRÍTICO" : alertLevel === "orange" ? "ALTO" : "MODERADO";

          await supabase.from("datasus_alert_results").insert({
            alert_id: alert.id,
            user_id: alert.user_id,
            alert_level: alertLevel,
            title: `⚠️ Alerta ${levelLabel}: ${alert.disease} em ${stateName}`,
            description: `Detectado aumento atípico de ${alert.disease} em ${stateName}. Média das últimas 4 semanas: ${Math.round(currentMean)} casos estimados (z-score: ${zScore.toFixed(2)}, média histórica: ${Math.round(histMean)}). Nível InfoDengue: ${highestNivel}.`,
            current_value: Math.round(currentMean),
            historical_mean: Math.round(histMean * 100) / 100,
            std_deviation: Math.round(histStd * 100) / 100,
            z_score: Math.round(zScore * 100) / 100,
            location: stateName,
            disease: alert.disease,
            period: `SE ${recentWeeks[3]?.SE || 0} – SE ${recentWeeks[0]?.SE || 0}`,
          });

          totalAlerts++;
        }
      }

      // Update last_checked_at
      await supabase
        .from("datasus_alerts")
        .update({ last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", alert.id);
    }

    return new Response(
      JSON.stringify({ checked: totalChecked, alerts_generated: totalAlerts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-datasus-alerts error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
