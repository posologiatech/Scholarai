import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";

type Msg = { role: "user" | "assistant" | "system"; content: string };

const MAX_CTX = 18000;

function clip(s: string | null | undefined, max = 600): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if ("error" in auth) return auth.error;
    const { supabase } = auth;

    const { project_id, messages, locale } = await req.json();
    if (!project_id || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "project_id and messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather full project context (RLS scopes to project members)
    const [
      { data: project },
      { data: members },
      { data: tasks },
      { data: meetings },
      { data: agendas },
      { data: schedule },
      { data: refs },
      { data: ideas },
    ] = await Promise.all([
      supabase.from("research_projects").select("*").eq("id", project_id).single(),
      supabase.from("research_project_members").select("full_name,role,invited_email").eq("project_id", project_id),
      supabase.from("research_tasks").select("title,description,status,priority,due_date").eq("project_id", project_id).order("created_at"),
      supabase.from("research_meetings").select("id,title,scheduled_at,location,summary").eq("project_id", project_id).order("scheduled_at", { ascending: false }).limit(20),
      supabase.from("research_meeting_agenda_items").select("meeting_id,title,notes,completed").in("meeting_id",
        // sub-query workaround: just fetch all and filter client-side below
        []
      ),
      supabase.from("research_schedule_items").select("title,description,phase,status,start_date,end_date,progress,is_milestone,predecessor_id").eq("project_id", project_id).order("start_date", { nullsFirst: false }),
      supabase.from("research_project_references").select("title,authors,year,doi").eq("project_id", project_id).limit(60),
      supabase.from("research_ideas").select("title,description").eq("project_id", project_id).limit(20),
    ]);

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found or no access" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch agendas for retrieved meetings (RLS again, scoped)
    let realAgendas: any[] = [];
    if (meetings && meetings.length > 0) {
      const ids = meetings.map((m: any) => m.id);
      const { data: ag } = await supabase
        .from("research_meeting_agenda_items")
        .select("meeting_id,title,notes,completed")
        .in("meeting_id", ids);
      realAgendas = ag ?? [];
    }

    // Build a compact context
    const lines: string[] = [];
    lines.push(`# PROJETO: ${project.title}`);
    if (project.description) lines.push(`Resumo: ${clip(project.description, 800)}`);
    if (project.objectives) lines.push(`Objetivos: ${clip(project.objectives, 800)}`);
    if (project.cnpq_area) lines.push(`Área CNPq: ${project.cnpq_area}`);
    if (project.keywords?.length) lines.push(`Palavras-chave: ${project.keywords.join(", ")}`);
    lines.push(`Status: ${project.status} · Datas: ${project.start_date ?? "—"} → ${project.end_date ?? "—"}`);

    if (project.full_content) {
      lines.push(`\n## TEXTO COMPLETO DO PROJETO\n${clip(project.full_content, 6000)}`);
    }

    if (members?.length) {
      lines.push(`\n## EQUIPE`);
      members.forEach((m: any) => lines.push(`- ${m.full_name ?? m.invited_email ?? "—"} (${m.role})`));
    }

    if (tasks?.length) {
      lines.push(`\n## TAREFAS (${tasks.length})`);
      tasks.slice(0, 60).forEach((t: any) =>
        lines.push(`- [${t.status}/${t.priority}${t.due_date ? "/prazo " + t.due_date : ""}] ${t.title}${t.description ? " — " + clip(t.description, 200) : ""}`));
    }

    if (schedule?.length) {
      lines.push(`\n## CRONOGRAMA (${schedule.length})`);
      schedule.forEach((s: any) =>
        lines.push(`- [${s.status} · ${s.progress ?? 0}%${s.is_milestone ? " · marco" : ""}] ${s.title}${s.phase ? " (" + s.phase + ")" : ""} ${s.start_date ?? ""} → ${s.end_date ?? ""}${s.predecessor_id ? " [depende de outro item]" : ""}`));
    }

    if (meetings?.length) {
      lines.push(`\n## REUNIÕES (mais recentes)`);
      meetings.forEach((m: any) => {
        lines.push(`### ${m.title} — ${m.scheduled_at ?? ""}`);
        if (m.summary) lines.push(`Ata: ${clip(m.summary, 800)}`);
        const ag = realAgendas.filter(a => a.meeting_id === m.id);
        if (ag.length) {
          ag.forEach(a => lines.push(`  · ${a.completed ? "[x]" : "[ ]"} ${a.title}${a.notes ? " — " + clip(a.notes, 200) : ""}`));
        }
      });
    }

    if (refs?.length) {
      lines.push(`\n## REFERÊNCIAS (${refs.length})`);
      refs.slice(0, 30).forEach((r: any) => {
        const authors = Array.isArray(r.authors) ? r.authors.slice(0, 3).map((a: any) => a.name ?? a).join(", ") : "";
        lines.push(`- ${r.title} (${authors}${r.year ? ", " + r.year : ""}${r.doi ? ", DOI " + r.doi : ""})`);
      });
    }

    if (ideas?.length) {
      lines.push(`\n## IDEIAS REGISTRADAS`);
      ideas.forEach((i: any) => lines.push(`- ${i.title}${i.description ? ": " + clip(i.description, 200) : ""}`));
    }

    let ctx = lines.join("\n");
    if (ctx.length > MAX_CTX) ctx = ctx.slice(0, MAX_CTX) + "\n…[contexto truncado]";

    const lang = locale === "en" ? "English" : "Português (pt-BR)";
    const system: Msg = {
      role: "system",
      content: `Você é o Copiloto de Pesquisa deste projeto. Tem memória total do projeto via o CONTEXTO abaixo (visão geral, equipe, tarefas, reuniões/atas, cronograma, referências, ideias).

Princípios obrigatórios:
- ZERO FABRICAÇÃO. Se algo não está no contexto, responda explicitamente "Não consta no projeto" e proponha onde registrar.
- Sempre cite a origem da informação inline (ex.: "[Tarefa]", "[Reunião 12/05]", "[Cronograma — Fase 2]").
- Seja conciso, estruturado, com bullets e seções curtas quando útil.
- Quando o usuário pedir resumos/relatórios, gere markdown limpo.
- Quando detectar riscos (tarefas atrasadas, cronograma em risco, ausência de reuniões, gaps no overview), aponte-os ao final em uma seção "⚠️ Riscos detectados".
- Responda no idioma: ${lang}.

=== CONTEXTO DO PROJETO ===
${ctx}
=== FIM DO CONTEXTO ===`,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [system, ...messages.slice(-12)],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: t }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
