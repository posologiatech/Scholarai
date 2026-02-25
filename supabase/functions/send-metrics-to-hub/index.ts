import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hubServiceKey = Deno.env.get("HUB_SERVICE_KEY");
    const hubServiceId = Deno.env.get("HUB_SERVICE_ID");

    if (!hubServiceKey || !hubServiceId) {
      console.error("Missing HUB_SERVICE_KEY or HUB_SERVICE_ID");
      return new Response(JSON.stringify({ error: "Missing hub secrets" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Total users (from auth.users via user_approvals as proxy)
    const { count: totalUsers } = await supabase
      .from("user_approvals")
      .select("*", { count: "exact", head: true });

    // Active users in last 30 days (users who saved searches recently)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activeData } = await supabase
      .from("saved_searches")
      .select("user_id")
      .gte("created_at", thirtyDaysAgo);

    const activeUsers = new Set(activeData?.map((r) => r.user_id)).size;

    const body = {
      service_id: hubServiceId,
      total_users: totalUsers ?? 0,
      active_users: activeUsers,
      subscribers: 0,
      ai_requests: 0,
      ai_tokens_used: 0,
      ai_cost_usd: 0,
      revenue_usd: 0,
      mrr_usd: 0,
    };

    console.log("Sending metrics:", JSON.stringify(body));

    const res = await fetch(
      "https://slmnpcabhjsqithkmkxn.supabase.co/functions/v1/report-metrics",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-key": hubServiceKey,
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Hub error:", res.status, err);
      return new Response(JSON.stringify({ error: "Hub request failed", detail: err }), {
        status: 502,
      });
    }

    const result = await res.json();
    console.log("Metrics sent successfully:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error sending metrics:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
