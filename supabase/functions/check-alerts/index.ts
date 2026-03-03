import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      const { alert_id, user_id } = body;

      const { data: alert } = await supabase
        .from("literature_alerts")
        .select("*")
        .eq("id", alert_id)
        .single();

      if (!alert) throw new Error("Alert not found");

      // Call the existing search-papers function
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

      // Filter out papers already in alert_results
      const { data: existing } = await supabase
        .from("alert_results")
        .select("paper_doi, paper_title")
        .eq("alert_id", alert_id);

      const existingSet = new Set(
        (existing || []).map((e: any) => e.paper_doi || e.paper_title)
      );

      const newPapers = papers.filter(
        (p: any) => !existingSet.has(p.doi || p.title)
      );

      if (newPapers.length > 0) {
        const rows = newPapers.map((p: any) => ({
          alert_id,
          user_id,
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

      // Update last_checked_at
      await supabase
        .from("literature_alerts")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", alert_id);

      return new Response(
        JSON.stringify({ new_papers: newPapers.length, total_found: papers.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check retraction status via CrossRef ───
    if (action === "check_retraction") {
      const { doi } = body;
      // Use CrossRef API to check retraction
      const crRes = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        { headers: { "User-Agent": "ArcaResearch/1.0 (mailto:contact@arca.dev)" } }
      );

      if (!crRes.ok) {
        return new Response(
          JSON.stringify({ status: "unknown", message: "Could not check DOI" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      const status = isRetracted ? "retracted" : hasConcern ? "concern" : "active";

      return new Response(
        JSON.stringify({ status, doi, title: work.title?.[0] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
