import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Award, Star } from "lucide-react";
import { toast } from "sonner";

export default function EvaluationsTab({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    advisee_id: "", task_id: "", schedule_item_id: "", title: "", score: "8.0", comments: "",
    evaluated_at: new Date().toISOString().slice(0, 10),
  });

  const { data: evals = [] } = useQuery({
    queryKey: ["evals", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_milestone_evaluations")
        .select("*").eq("project_id", projectId).order("evaluated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: advisees = [] } = useQuery({
    queryKey: ["eval-advisees", projectId],
    queryFn: async () => (await supabase.from("research_advisees").select("id, full_name").eq("project_id", projectId)).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["eval-tasks", projectId],
    queryFn: async () => (await supabase.from("research_tasks").select("id, title").eq("project_id", projectId)).data ?? [],
  });
  const { data: sched = [] } = useQuery({
    queryKey: ["eval-sched", projectId],
    queryFn: async () => (await supabase.from("research_schedule_items").select("id, title").eq("project_id", projectId)).data ?? [],
  });

  const add = async () => {
    if (!form.title || !form.score) return toast.error(locale === "pt" ? "Preencha título e nota" : "Fill title and score");
    const advisee = advisees.find((a: any) => a.id === form.advisee_id);
    const { error } = await supabase.from("research_milestone_evaluations").insert({
      project_id: projectId, evaluator_id: user!.id,
      advisee_id: form.advisee_id || null,
      task_id: form.task_id || null,
      schedule_item_id: form.schedule_item_id || null,
      title: form.title, score: Number(form.score), comments: form.comments || null,
      evaluated_at: form.evaluated_at,
    });
    if (error) return toast.error(error.message);
    toast.success(locale === "pt" ? "Avaliação registrada" : "Evaluation saved");
    qc.invalidateQueries({ queryKey: ["evals", projectId] });
    setOpen(false);
    setForm({ advisee_id: "", task_id: "", schedule_item_id: "", title: "", score: "8.0", comments: "", evaluated_at: new Date().toISOString().slice(0, 10) });
  };

  const remove = async (id: string) => {
    await supabase.from("research_milestone_evaluations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["evals", projectId] });
  };

  const scoreColor = (s: number) =>
    s >= 8 ? "bg-green-600" : s >= 6 ? "bg-blue-600" : s >= 4 ? "bg-amber-600" : "bg-red-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Award className="h-4 w-4" />{evals.length} {locale === "pt" ? "avaliações" : "evaluations"}
        </div>
        {isManager && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Nova avaliação" : "New evaluation"}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{locale === "pt" ? "Avaliar marco" : "Evaluate milestone"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{locale === "pt" ? "Título" : "Title"}</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>{locale === "pt" ? "Nota (0-10)" : "Score (0-10)"}</Label>
                    <Input type="number" min="0" max="10" step="0.5" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} /></div>
                  <div className="col-span-2"><Label>{locale === "pt" ? "Data" : "Date"}</Label>
                    <Input type="date" value={form.evaluated_at} onChange={e => setForm({ ...form, evaluated_at: e.target.value })} /></div>
                </div>
                <div><Label>{locale === "pt" ? "Orientando (opcional)" : "Advisee (optional)"}</Label>
                  <Select value={form.advisee_id} onValueChange={v => setForm({ ...form, advisee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{advisees.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>{locale === "pt" ? "Tarefa" : "Task"}</Label>
                    <Select value={form.task_id} onValueChange={v => setForm({ ...form, task_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{tasks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label>{locale === "pt" ? "Marco do cronograma" : "Schedule item"}</Label>
                    <Select value={form.schedule_item_id} onValueChange={v => setForm({ ...form, schedule_item_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{sched.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div><Label>{locale === "pt" ? "Comentários" : "Comments"}</Label>
                  <Textarea rows={4} value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={add}>{locale === "pt" ? "Salvar" : "Save"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {evals.map((e: any) => {
          const adv = advisees.find((a: any) => a.id === e.advisee_id);
          const tk = tasks.find((t: any) => t.id === e.task_id);
          const sc = sched.find((s: any) => s.id === e.schedule_item_id);
          return (
            <Card key={e.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`${scoreColor(Number(e.score))} text-white rounded-lg w-16 h-16 flex flex-col items-center justify-center shrink-0`}>
                  <Star className="h-4 w-4" />
                  <span className="text-xl font-bold">{Number(e.score).toFixed(1)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold">{e.title}</h4>
                    <span className="text-xs text-muted-foreground">{e.evaluated_at}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {adv && <Badge variant="outline" className="text-[10px]">👤 {adv.full_name}</Badge>}
                    {tk && <Badge variant="outline" className="text-[10px]">📋 {tk.title}</Badge>}
                    {sc && <Badge variant="outline" className="text-[10px]">📅 {sc.title}</Badge>}
                  </div>
                  {e.comments && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{e.comments}</p>}
                </div>
                {isManager && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(e.id)}><Trash2 className="h-3 w-3" /></Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!evals.length && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {locale === "pt" ? "Sem avaliações ainda." : "No evaluations yet."}
          </p>
        )}
      </div>
    </div>
  );
}
