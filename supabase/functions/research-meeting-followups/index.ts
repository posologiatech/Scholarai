import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { callAI } from "../_shared/ai-caller.ts";

const clip = (s: string | null | undefined, m = 600) => {
  if (!s) return "";
  return s.length > m ? s.slice(0, m) + "…" : s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuth(req, corsHeaders);
    if ("error" in auth) return auth.error;
    const { supabase } = auth;

    const { meeting_id } = await req.json() as { meeting_id: string };
    if (!meeting_id) {
      return new Response(JSON.stringify({ error: "meeting_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: meeting } = await supabase.from("research_meetings").select("*").eq("id", meeting_id).single();
    if (!meeting) {
      return new Response(JSON.stringify({ error: "meeting not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: project }, { data: agenda }, { data: recentTasks }] = await Promise.all([
      supabase.from("research_projects").select("title,description,objectives").eq("id", meeting.project_id).single(),
      supabase.from("research_meeting_agenda_items").select("title,notes").eq("meeting_id", meeting_id).order("position"),
      supabase.from("research_tasks").select("title,status,due_date").eq("project_id", meeting.project_id).neq("status", "done").limit(20),
    ]);

    const ctx: string[] = [];
    ctx.push(`PROJETO: ${project?.title}`);
    if (project?.description) ctx.push(`Descrição: ${clip(project.description, 400)}`);
    if (project?.objectives) ctx.push(`Objetivos: ${clip(project.objectives, 400)}`);
    ctx.push(`\nREUNIÃO: ${meeting.title} (${meeting.scheduled_at})`);
    if (meeting.agenda) ctx.push(`Pauta livre: ${clip(meeting.agenda, 800)}`);
    if (meeting.notes) ctx.push(`Notas/discussão:\n${clip(meeting.notes, 3000)}`);
    if (agenda?.length) {
      ctx.push(`\nPONTOS DE PAUTA:`);
      agenda.forEach((a: any, i: number) => {
        ctx.push(`${i + 1}. ${a.title}${a.notes ? ` — obs: ${clip(a.notes, 300)}` : ""}`);
      });
    }
    if (recentTasks?.length) {
      ctx.push(`\nTAREFAS ABERTAS DO PROJETO (não duplicar):`);
      recentTasks.forEach((t: any) => ctx.push(`- ${t.title} [${t.status}]`));
    }

    const today = new Date().toISOString().slice(0, 10);
    const system = `Você é um Chief of Staff sênior de pesquisa científica. Com base nas notas e pauta da reunião, gere encaminhamentos acionáveis (next steps), riscos identificados e decisões registradas.

REGRAS:
- ZERO fabricação. Use apenas o contexto.
- Prazos plausíveis (datas ISO YYYY-MM-DD), considerando hoje = ${today}.
- Não duplique tarefas já abertas.
- Português brasileiro, tom executivo, conciso.

Retorne JSON ESTRITO no formato:
{
  "followups": [{"title": "...", "due_date": "YYYY-MM-DD" | null, "priority": "low"|"medium"|"high"|"urgent"}],
  "risks": [{"title": "...", "severity": "low"|"medium"|"high"}],
  "decisions": ["..."]
}`;

    const res = await callAI({
      _userId: auth.userId,
      _promptType: "research_meeting_followups",
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: ctx.join("\n") },
      ],
      response_format: { type: "json_object" },
    } as any);

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso atingido." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: txt }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await res.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { followups: [], risks: [], decisions: [] }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
