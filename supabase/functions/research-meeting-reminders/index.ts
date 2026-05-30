// Scans upcoming meetings and creates in-app notifications for project members.
// Meant to be invoked by pg_cron (e.g. every 30 min).
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

    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // next 24h

    // Upcoming meetings not yet reminded
    const { data: meetings, error } = await supabase
      .from("research_meetings")
      .select("id,project_id,title,scheduled_at,reminder_sent_at")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", horizon.toISOString())
      .is("reminder_sent_at", null);

    if (error) throw error;
    if (!meetings?.length) {
      return new Response(JSON.stringify({ ok: true, reminded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let reminded = 0;
    for (const m of meetings) {
      // Project members (accepted) + owner
      const { data: members } = await supabase
        .from("research_project_members")
        .select("user_id")
        .eq("project_id", m.project_id)
        .eq("accepted", true);

      const { data: proj } = await supabase
        .from("research_projects")
        .select("owner_id")
        .eq("id", m.project_id)
        .single();

      const userIds = new Set<string>();
      (members || []).forEach((x: any) => x.user_id && userIds.add(x.user_id));
      if (proj?.owner_id) userIds.add(proj.owner_id);
      if (!userIds.size) continue;

      const when = new Date(m.scheduled_at).toLocaleString("pt-BR");
      const notes = [...userIds].map((uid) => ({
        user_id: uid,
        project_id: m.project_id,
        type: "meeting_reminder",
        title: `Reunião em breve: ${m.title}`,
        body: `Agendada para ${when}.`,
        link: `/research/${m.project_id}?tab=meetings`,
      }));

      await supabase.from("research_notifications").insert(notes);
      await supabase.from("research_meetings").update({ reminder_sent_at: now.toISOString() }).eq("id", m.id);
      reminded++;
    }

    return new Response(JSON.stringify({ ok: true, reminded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
