// Daily digest: aggregates yesterday's notifications per user and emails them.
// Can be invoked by pg_cron or manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) pull undigested notifications
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: notes } = await supabase
      .from("research_notifications")
      .select("id,user_id,project_id,type,title,body,link,created_at")
      .eq("digest_sent", false)
      .gte("created_at", since);

    if (!notes?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) group by user
    const byUser: Record<string, typeof notes> = {};
    for (const n of notes) (byUser[n.user_id] ??= []).push(n);

    let sent = 0;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    for (const [userId, items] of Object.entries(byUser)) {
      // Fetch user email
      const { data: u } = await supabase.auth.admin.getUserById(userId);
      const email = u?.user?.email;
      if (!email) continue;

      // Check global pref: any project pref disabling email_digest? we send if any project allows
      const projectIds = [...new Set(items.map(i => i.project_id).filter(Boolean))];
      const { data: prefs } = await supabase
        .from("research_notification_prefs")
        .select("project_id,email_digest,digest_frequency")
        .eq("user_id", userId)
        .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

      const allowed = items.filter(i => {
        if (!i.project_id) return true;
        const p = prefs?.find(pp => pp.project_id === i.project_id);
        if (!p) return true; // default = allow
        return p.email_digest && p.digest_frequency !== "off";
      });
      if (!allowed.length) continue;

      const html = `<h2>Resumo diário · ARCA Research</h2>
<p>${allowed.length} novidades nas últimas 24h:</p>
<ul>${allowed.map(i => `<li><strong>${i.title}</strong>${i.body ? ` — ${i.body}` : ""}</li>`).join("")}</ul>
<p style="color:#888;font-size:12px">Configure suas preferências em cada projeto.</p>`;

      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ARCA Research <notify@posologia.app>",
            to: email,
            subject: `Resumo diário · ${allowed.length} novidades`,
            html,
          }),
        }).catch(() => {});
      }

      await supabase.from("research_notifications").update({ digest_sent: true }).in("id", allowed.map(i => i.id));
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
