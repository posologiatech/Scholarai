import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};
const RETRACTION_CHECK_MS = FREQUENCY_MS.daily;

async function runAlertCheck(supabase: any, supabaseUrl: string, alert: any) {
  const searchRes = await fetch(`${supabaseUrl}/functions/v1/search-papers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
    },
    body: JSON.stringify({
      query: alert.query,
      limit: 20,
      yearFrom: alert.filters?.yearFrom,
      yearTo: alert.filters?.yearTo,
      openAccess: alert.filters?.openAccess,
    }),
  });

  const searchData = await searchRes.json();
  const papers = searchData.papers || [];

  const { data: existing } = await supabase
    .from("alert_results")
    .select("paper_doi, paper_title")
    .eq("alert_id", alert.id);

  const existingSet = new Set(
    (existing || []).map((e: any) => e.paper_doi || e.paper_title)
  );

  const newPapers = papers.filter(
    (p: any) => !existingSet.has(p.doi || p.title)
  );

  if (newPapers.length > 0) {
    const rows = newPapers.map((p: any) => ({
      alert_id: alert.id,
      user_id: alert.user_id,
      paper_title: p.title,
      paper_authors: p.authors || [],
      paper_year: p.year,
      paper_doi: p.doi,
      paper_abstract: p.abstract,
      paper_url: p.url,
      paper_source: p.source,
    }));

    await supabase.from("alert_results").insert(rows);
  }

  await supabase
    .from("literature_alerts")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", alert.id);

  return { new_papers: newPapers.length, total_found: papers.length };
}

async function runRetractionCheck(doi: string) {
  const crRes = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { headers: { "User-Agent": "ArcaResearch/1.0 (mailto:contact@arca.dev)" } }
  );

  if (!crRes.ok) return { status: "unknown", message: "Could not check DOI" };

  const crData = await crRes.json();
  const work = crData.message;
  const updateInfo = work["update-to"] || [];
  const isRetracted = updateInfo.some(
    (u: any) => u.type === "retraction" || u.label === "Retraction"
  );
  const hasConcern = updateInfo.some(
    (u: any) =>
      u.type === "expression_of_concern" ||
      u.label === "Expression of Concern"
  );

  return {
    status: isRetracted ? "retracted" : hasConcern ? "concern" : "active",
    title: work.title?.[0],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...body } = await req.json();

    // ─── Manual check: search for new papers matching an alert ───
    if (action === "check_alert") {
      const { alert_id } = body;

      const { data: alert } = await supabase
        .from("literature_alerts")
        .select("*")
        .eq("id", alert_id)
        .single();

      if (!alert) throw new Error("Alert not found");

      const result = await runAlertCheck(supabase, supabaseUrl, alert);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Cron entry point: run every alert/retraction watch that is due ───
    // Invoked on a schedule (see supabase/migrations, cron job "check-alerts-scheduler"),
    // not from the frontend — this is what actually makes "frequency" mean something.
    if (action === "run_due_alerts") {
      const now = Date.now();

      const { data: activeAlerts } = await supabase
        .from("literature_alerts")
        .select("*")
        .eq("is_active", true);

      const dueAlerts = (activeAlerts || []).filter((a: any) => {
        const intervalMs = FREQUENCY_MS[a.frequency] ?? FREQUENCY_MS.weekly;
        if (!a.last_checked_at) return true;
        return now - new Date(a.last_checked_at).getTime() >= intervalMs;
      });

      let newPapersTotal = 0;
      for (const alert of dueAlerts) {
        try {
          const result = await runAlertCheck(supabase, supabaseUrl, alert);
          newPapersTotal += result.new_papers;
        } catch (e) {
          console.error(`run_due_alerts: failed for alert ${alert.id}:`, e);
        }
      }

      const { data: watches } = await supabase
        .from("retraction_watches")
        .select("*")
        .eq("status", "active");

      const dueWatches = (watches || []).filter((w: any) => {
        if (!w.last_checked_at) return true;
        return now - new Date(w.last_checked_at).getTime() >= RETRACTION_CHECK_MS;
      });

      let retractionsChanged = 0;
      for (const watch of dueWatches) {
        try {
          const result = await runRetractionCheck(watch.paper_doi);
          if (result.status !== "active" && result.status !== "unknown") retractionsChanged++;
          if (result.status !== "unknown") {
            await supabase
              .from("retraction_watches")
              .update({ status: result.status, last_checked_at: new Date().toISOString() })
              .eq("id", watch.id);
          }
        } catch (e) {
          console.error(`run_due_alerts: retraction check failed for ${watch.id}:`, e);
        }
      }

      return new Response(
        JSON.stringify({
          alerts_checked: dueAlerts.length,
          new_papers_total: newPapersTotal,
          retractions_checked: dueWatches.length,
          retractions_changed: retractionsChanged,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check retraction status via CrossRef ───
    if (action === "check_retraction") {
      const { doi } = body;
      const result = await runRetractionCheck(doi);
      return new Response(JSON.stringify({ ...result, doi }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Generate personalized feed summary ───
    if (action === "generate_feed") {
      const { user_id } = body;

      // Get recent unread results
      const { data: results } = await supabase
        .from("alert_results")
        .select("*, literature_alerts(query)")
        .eq("user_id", user_id)
        .eq("is_read", false)
        .order("found_at", { ascending: false })
        .limit(50);

      return new Response(
        JSON.stringify({ results: results || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("check-alerts error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
