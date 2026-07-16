// Sends emails to project members when a schedule item starts, and when it's 7 days from ending.
// Meant to be invoked by pg_cron daily.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "ScholarAI <no-reply@tbl.posologia.app>";
const APP_URL = "https://scholarai.posologia.app";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Resend failed [${res.status}]: ${t}`);
  }
}

function renderStartEmail(project: string, title: string, endDate: string | null) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 12px;font-size:18px">Etapa do cronograma iniciada</h2>
      <p style="margin:0 0 8px">A etapa <strong>${title}</strong> do projeto <strong>${project}</strong> começa hoje.</p>
      ${endDate ? `<p style="margin:0 0 16px;color:#475569;font-size:14px">Prazo final: ${endDate}</p>` : ""}
      <a href="${APP_URL}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Abrir projeto</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">ScholarAI — lembrete automático</p>
    </div>`;
}

function renderEndSoonEmail(project: string, title: string, endDate: string) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 12px;font-size:18px">Etapa termina em 1 semana</h2>
      <p style="margin:0 0 8px">A etapa <strong>${title}</strong> do projeto <strong>${project}</strong> deve ser finalizada em <strong>${endDate}</strong>.</p>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">Falta 1 semana para o prazo final.</p>
      <a href="${APP_URL}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Abrir projeto</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">ScholarAI — lembrete automático</p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = ymd(today);
    const in7Days = new Date(today.getTime() + 7 * 86400000);
    const in7Str = ymd(in7Days);

    // Items that start today (not yet reminded)
    const { data: starting, error: e1 } = await supabase
      .from("research_schedule_items")
      .select("id,project_id,title,start_date,end_date,assignee_id,assignee_ids")
      .eq("start_date", todayStr)
      .is("start_reminder_sent_at", null);
    if (e1) throw e1;

    // Items ending exactly in 7 days (not yet reminded)
    const { data: ending, error: e2 } = await supabase
      .from("research_schedule_items")
      .select("id,project_id,title,start_date,end_date,assignee_id,assignee_ids")
      .eq("end_date", in7Str)
      .is("end_reminder_sent_at", null);
    if (e2) throw e2;

    let sent = 0;

    const processItem = async (
      item: any,
      kind: "start" | "end_soon",
    ) => {
      // Determine recipients: assignee_ids first, then assignee_id, else all project members
      const ids: string[] =
        (item.assignee_ids && item.assignee_ids.length ? item.assignee_ids : (item.assignee_id ? [item.assignee_id] : []));

      let userIds: string[] = [];
      if (ids.length) {
        userIds = ids;
      } else {
        const { data: members } = await supabase
          .from("research_project_members")
          .select("user_id")
          .eq("project_id", item.project_id)
          .eq("accepted", true);
        const { data: proj } = await supabase
          .from("research_projects")
          .select("owner_id,title")
          .eq("id", item.project_id)
          .single();
        const set = new Set<string>();
        (members || []).forEach((m: any) => m.user_id && set.add(m.user_id));
        if (proj?.owner_id) set.add(proj.owner_id);
        userIds = [...set];
      }

      if (!userIds.length) return;

      const { data: proj } = await supabase
        .from("research_projects")
        .select("title")
        .eq("id", item.project_id)
        .single();
      const projectTitle = proj?.title || "Projeto";

      const { data: approvals } = await supabase
        .from("user_approvals")
        .select("user_id,email")
        .in("user_id", userIds);

      const subject = kind === "start"
        ? `Cronograma: "${item.title}" começa hoje`
        : `Cronograma: "${item.title}" termina em 1 semana`;
      const html = kind === "start"
        ? renderStartEmail(projectTitle, item.title, item.end_date)
        : renderEndSoonEmail(projectTitle, item.title, item.end_date);

      // Send email + in-app notification
      const notifs: any[] = [];
      for (const a of approvals || []) {
        if (a.email) await sendEmail(a.email, subject, html);
        notifs.push({
          user_id: a.user_id,
          project_id: item.project_id,
          type: kind === "start" ? "schedule_start" : "schedule_end_soon",
          title: subject,
          body: kind === "start"
            ? `A etapa começou hoje.`
            : `Faltam 7 dias para o término (${item.end_date}).`,
          link: `/research/${item.project_id}?tab=schedule`,
        });
      }
      if (notifs.length) await supabase.from("research_notifications").insert(notifs);

      const patch = kind === "start"
        ? { start_reminder_sent_at: new Date().toISOString() }
        : { end_reminder_sent_at: new Date().toISOString() };
      await supabase.from("research_schedule_items").update(patch).eq("id", item.id);
      sent += approvals?.length || 0;
    };

    for (const it of starting || []) await processItem(it, "start");
    for (const it of ending || []) await processItem(it, "end_soon");

    return new Response(
      JSON.stringify({ ok: true, starting: starting?.length || 0, ending: ending?.length || 0, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
