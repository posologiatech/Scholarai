import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { Presentation, ChevronLeft, ChevronRight, X } from "lucide-react";

type Slide = { title: string; body: React.ReactNode };

export default function PresentationMode({ project }: { project: any }) {
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const { data: bundle } = useQuery({
    queryKey: ["pres-bundle", project.id],
    enabled: open,
    queryFn: async () => {
      const [tasks, sched, pubs, advisees, budget, expenses] = await Promise.all([
        supabase.from("research_tasks").select("*").eq("project_id", project.id),
        supabase.from("research_schedule_items").select("*").eq("project_id", project.id).order("start_date"),
        supabase.from("research_publications").select("*").eq("project_id", project.id),
        supabase.from("research_advisees").select("*").eq("project_id", project.id),
        supabase.from("research_budget_items").select("*").eq("project_id", project.id),
        supabase.from("research_expenses").select("*").eq("project_id", project.id),
      ]);
      return {
        tasks: tasks.data ?? [], sched: sched.data ?? [], pubs: pubs.data ?? [],
        advisees: advisees.data ?? [], budget: budget.data ?? [], expenses: expenses.data ?? [],
      };
    },
  });

  const slides: Slide[] = !bundle ? [] : (() => {
    const planned = bundle.budget.reduce((s, b: any) => s + Number(b.planned_amount || 0), 0);
    const executed = bundle.expenses.filter((e: any) => e.status !== "rejeitado").reduce((s, e: any) => s + Number(e.amount || 0), 0);
    const done = bundle.tasks.filter((t: any) => t.status === "concluida").length;
    const pubByStatus = bundle.pubs.reduce((acc: any, p: any) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1 }), {});
    return [
      { title: project.title, body: (
        <div className="text-center space-y-4">
          <p className="text-2xl text-muted-foreground">{project.cnpq_area || ""}</p>
          <p className="text-base max-w-3xl mx-auto">{project.description}</p>
        </div>
      )},
      { title: locale === "pt" ? "Objetivos" : "Objectives", body: (
        <p className="text-lg whitespace-pre-wrap">{project.objectives || (locale === "pt" ? "—" : "—")}</p>
      )},
      { title: locale === "pt" ? "Progresso de Tarefas" : "Task Progress", body: (
        <div className="text-center space-y-4">
          <div className="text-7xl font-bold text-primary">{done}/{bundle.tasks.length}</div>
          <p className="text-xl text-muted-foreground">{locale === "pt" ? "tarefas concluídas" : "tasks completed"}</p>
        </div>
      )},
      { title: locale === "pt" ? "Cronograma" : "Schedule", body: (
        <ul className="space-y-2 text-base">
          {bundle.sched.slice(0, 10).map((s: any) => (
            <li key={s.id} className="flex justify-between border-b pb-1">
              <span>{s.title}</span>
              <span className="text-muted-foreground text-sm">{s.start_date} → {s.end_date}</span>
            </li>
          ))}
        </ul>
      )},
      { title: locale === "pt" ? "Publicações" : "Publications", body: (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(pubByStatus).map(([k, v]: any) => (
            <div key={k} className="border rounded-lg p-4 text-center">
              <div className="text-4xl font-bold">{v}</div>
              <div className="text-sm text-muted-foreground uppercase">{k}</div>
            </div>
          ))}
        </div>
      )},
      { title: locale === "pt" ? "Orientações" : "Advisees", body: (
        <ul className="space-y-2 text-base">
          {bundle.advisees.map((a: any) => (
            <li key={a.id} className="border-b pb-2">
              <span className="font-medium">{a.full_name}</span> — <span className="text-muted-foreground">{a.level}</span>
              {a.thesis_title && <p className="text-sm text-muted-foreground italic">{a.thesis_title}</p>}
            </li>
          ))}
          {!bundle.advisees.length && <p className="text-muted-foreground">—</p>}
        </ul>
      )},
      { title: locale === "pt" ? "Orçamento" : "Budget", body: (
        <div className="grid grid-cols-3 gap-6 text-center">
          <div><div className="text-3xl font-bold">R$ {planned.toLocaleString()}</div><div className="text-sm text-muted-foreground">{locale === "pt" ? "Previsto" : "Planned"}</div></div>
          <div><div className="text-3xl font-bold text-primary">R$ {executed.toLocaleString()}</div><div className="text-sm text-muted-foreground">{locale === "pt" ? "Executado" : "Executed"}</div></div>
          <div><div className="text-3xl font-bold">R$ {(planned - executed).toLocaleString()}</div><div className="text-sm text-muted-foreground">{locale === "pt" ? "Saldo" : "Balance"}</div></div>
        </div>
      )},
    ];
  })();

  const total = slides.length;
  const next = () => setI(v => Math.min(v + 1, total - 1));
  const prev = () => setI(v => Math.max(v - 1, 0));

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); setI(0); }}>
        <Presentation className="h-4 w-4" />{locale === "pt" ? "Modo Apresentação" : "Presentation Mode"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl h-[80vh] flex flex-col p-0" onKeyDown={(e) => {
          if (e.key === "ArrowRight") next();
          if (e.key === "ArrowLeft") prev();
        }}>
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <span className="text-sm text-muted-foreground">{i + 1} / {total}</span>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-12 overflow-auto">
            {slides[i] && (
              <div className="w-full max-w-4xl">
                <h2 className="text-4xl font-display font-bold mb-8 text-center">{slides[i].title}</h2>
                <div>{slides[i].body}</div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <Button variant="outline" onClick={prev} disabled={i === 0}><ChevronLeft className="h-4 w-4" />{locale === "pt" ? "Anterior" : "Prev"}</Button>
            <Button variant="outline" onClick={next} disabled={i >= total - 1}>{locale === "pt" ? "Próximo" : "Next"}<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
