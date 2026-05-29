import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_STATUS_LABEL, type ResearchTaskStatus } from "@/lib/research/types";
import { Plus, Trash2, Mic, Calendar, Flag, CheckSquare, GripVertical, ListChecks, User, X } from "lucide-react";
import { RichEditor } from "./RichEditor";
import { RichText } from "./RichText";
import { CommentThread } from "./CommentThread";
import { toast } from "sonner";

const STATUSES: ResearchTaskStatus[] = ["backlog", "doing", "review", "done"];

const PRIORITY_META: Record<string, { label_pt: string; label_en: string; color: string; dot: string }> = {
  low: { label_pt: "Baixa", label_en: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400" },
  medium: { label_pt: "Média", label_en: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", dot: "bg-blue-500" },
  high: { label_pt: "Alta", label_en: "High", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", dot: "bg-amber-500" },
  urgent: { label_pt: "Urgente", label_en: "Urgent", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", dot: "bg-rose-500" },
};

const COLUMN_ACCENT: Record<ResearchTaskStatus, string> = {
  backlog: "before:bg-slate-400",
  doing: "before:bg-blue-500",
  review: "before:bg-amber-500",
  done: "before:bg-emerald-500",
};

type ChecklistItem = { id: string; text: string; done: boolean };

export const TasksBoard = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "" });
  const [selected, setSelected] = useState<any | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["research-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_tasks")
        .select("*, source_meeting:research_meetings!source_meeting_id(id,title,scheduled_at)")
        .eq("project_id", projectId).order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["research-members-min", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_project_members")
        .select("id, full_name, invited_email").eq("project_id", projectId);
      return data ?? [];
    },
  });

  const memberLabel = (mid: string | null) => {
    if (!mid) return null;
    const m: any = members.find((x: any) => x.id === mid);
    return m ? (m.full_name || m.invited_email || "—") : null;
  };

  const grouped = useMemo(() => {
    const cols: Record<ResearchTaskStatus, any[]> = { backlog: [], doing: [], review: [], done: [] };
    tasks.forEach((t: any) => cols[t.status as ResearchTaskStatus]?.push(t));
    return cols;
  }, [tasks]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["research-tasks", projectId] });

  const add = async () => {
    if (!form.title) return;
    await supabase.from("research_tasks").insert({
      project_id: projectId, created_by: user!.id,
      title: form.title, description: form.description || null,
      priority: form.priority as any, due_date: form.due_date || null, status: "backlog",
    });
    invalidate();
    setOpen(false); setForm({ title: "", description: "", priority: "medium", due_date: "" });
  };

  const moveTask = async (id: string, status: ResearchTaskStatus) => {
    await supabase.from("research_tasks").update({
      status, completed_at: status === "done" ? new Date().toISOString() : null,
    }).eq("id", id);
    invalidate();
    setSelected((s: any) => (s && s.id === id ? { ...s, status } : s));
  };

  const updateTask = async (id: string, patch: any) => {
    await supabase.from("research_tasks").update(patch).eq("id", id);
    invalidate();
    setSelected((s: any) => (s && s.id === id ? { ...s, ...patch } : s));
  };

  const remove = async (id: string) => {
    await supabase.from("research_tasks").delete().eq("id", id);
    invalidate();
    if (selected?.id === id) setSelected(null);
  };

  const onDrop = (status: ResearchTaskStatus) => {
    if (dragId) { moveTask(dragId, status); setDragId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          <span>{tasks.length} {locale === "pt" ? "tarefas" : "tasks"}</span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Nova tarefa" : "New task"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "pt" ? "Nova tarefa" : "New task"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{locale === "pt" ? "Título" : "Title"}</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus /></div>
              <div><Label>{locale === "pt" ? "Descrição" : "Description"}</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{locale === "pt" ? "Prazo" : "Due"}</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Prioridade" : "Priority"}</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(PRIORITY_META).map(p => <SelectItem key={p} value={p}>{locale === "pt" ? PRIORITY_META[p].label_pt : PRIORITY_META[p].label_en}</SelectItem>)}
                    </SelectContent></Select></div>
              </div>
            </div>
            <DialogFooter><Button onClick={add}>{locale === "pt" ? "Criar" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(st => (
          <div key={st}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(st)}
            className="flex flex-col rounded-xl bg-muted/40 border border-border/50 min-h-[120px]">
            <div className={`flex items-center justify-between px-3 py-2.5 relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full ${COLUMN_ACCENT[st]}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/70 pl-2">
                {TASK_STATUS_LABEL[st][locale]}
              </h4>
              <span className="text-xs font-semibold text-muted-foreground bg-background rounded-full px-2 py-0.5">{grouped[st].length}</span>
            </div>
            <div className="space-y-2 p-2 flex-1">
              {grouped[st].map((t: any) => {
                const checklist: ChecklistItem[] = Array.isArray(t.checklist) ? t.checklist : [];
                const doneCount = checklist.filter(c => c.done).length;
                const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
                const overdue = t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString());
                return (
                  <div key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onClick={() => setSelected(t)}
                    className="group bg-card rounded-lg border border-border/60 p-3 space-y-2 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all">
                    <div className="flex items-start gap-1.5">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${pm.dot}`} />
                      <p className="text-sm font-medium leading-snug flex-1">{t.title}</p>
                      <GripVertical className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 shrink-0" />
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground line-clamp-2 pl-3.5">{t.description.replace(/[#*`>|-]/g, "")}</p>}
                    <div className="flex items-center gap-1.5 flex-wrap pl-3.5">
                      <Badge className={`text-[10px] border-0 ${pm.color}`}>{locale === "pt" ? pm.label_pt : pm.label_en}</Badge>
                      {t.due_date && <Badge variant={overdue ? "destructive" : "secondary"} className="text-[10px] gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(t.due_date).toLocaleDateString()}</Badge>}
                      {checklist.length > 0 && <Badge variant="outline" className="text-[10px] gap-1"><CheckSquare className="h-2.5 w-2.5" />{doneCount}/{checklist.length}</Badge>}
                      {memberLabel(t.assignee_id) && <Badge variant="outline" className="text-[10px] gap-1"><User className="h-2.5 w-2.5" />{memberLabel(t.assignee_id)}</Badge>}
                      {t.source_meeting && <Badge variant="outline" className="text-[10px] gap-1"><Mic className="h-2.5 w-2.5" />{locale === "pt" ? "Reunião" : "Meeting"}</Badge>}
                    </div>
                  </div>
                );
              })}
              {grouped[st].length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-6">{locale === "pt" ? "Arraste tarefas aqui" : "Drop tasks here"}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <TaskDetailDialog
        task={selected} projectId={projectId} members={members} memberLabel={memberLabel}
        onClose={() => setSelected(null)} onUpdate={updateTask} onMove={moveTask} onRemove={remove} locale={locale}
      />
    </div>
  );
};

const TaskDetailDialog = ({ task, projectId, members, memberLabel, onClose, onUpdate, onMove, onRemove, locale }: any) => {
  const [newCheck, setNewCheck] = useState("");
  if (!task) return null;
  const checklist: ChecklistItem[] = Array.isArray(task.checklist) ? task.checklist : [];
  const pm = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;

  const saveChecklist = (items: ChecklistItem[]) => onUpdate(task.id, { checklist: items as any });
  const addCheck = () => {
    if (!newCheck.trim()) return;
    saveChecklist([...checklist, { id: crypto.randomUUID(), text: newCheck.trim(), done: false }]);
    setNewCheck("");
  };
  const toggleCheck = (id: string) => saveChecklist(checklist.map(c => c.id === id ? { ...c, done: !c.done } : c));
  const removeCheck = (id: string) => saveChecklist(checklist.filter(c => c.id !== id));

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-0 gap-0">
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className={`text-[10px] border-0 ${pm.color}`}><Flag className="h-2.5 w-2.5" />{locale === "pt" ? pm.label_pt : pm.label_en}</Badge>
            {task.source_meeting && <Badge variant="outline" className="text-[10px] gap-1"><Mic className="h-2.5 w-2.5" />{task.source_meeting.title}</Badge>}
          </div>
          <Input
            defaultValue={task.title}
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && onUpdate(task.id, { title: e.target.value.trim() })}
            className="text-xl font-bold border-0 bg-transparent px-0 focus-visible:ring-0 h-auto"
          />
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={task.status} onValueChange={(v) => onMove(task.id, v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{locale === "pt" ? "Prioridade" : "Priority"}</Label>
              <Select value={task.priority} onValueChange={(v) => onUpdate(task.id, { priority: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(PRIORITY_META).map(p => <SelectItem key={p} value={p}>{locale === "pt" ? PRIORITY_META[p].label_pt : PRIORITY_META[p].label_en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{locale === "pt" ? "Prazo" : "Due"}</Label>
              <Input type="date" className="h-9 mt-1" defaultValue={task.due_date ?? ""}
                onChange={(e) => onUpdate(task.id, { due_date: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{locale === "pt" ? "Responsável" : "Assignee"}</Label>
              <Select value={task.assignee_id ?? "none"} onValueChange={(v) => onUpdate(task.id, { assignee_id: v === "none" ? null : v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.invited_email || "—"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">{locale === "pt" ? "Descrição" : "Description"}</Label>
            <RichEditor value={task.description ?? ""} onChange={(v) => onUpdate(task.id, { description: v || null })}
              minHeight={160} storagePrefix={`${projectId}/task`}
              placeholder={locale === "pt" ? "Detalhe a tarefa — tabelas, imagens, listas…" : "Task details…"} />
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CheckSquare className="h-4 w-4" />{locale === "pt" ? "Checklist" : "Checklist"}
              {checklist.length > 0 && <span className="text-xs text-muted-foreground font-normal">({checklist.filter(c => c.done).length}/{checklist.length})</span>}
            </Label>
            {checklist.length > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(checklist.filter(c => c.done).length / checklist.length) * 100}%` }} />
              </div>
            )}
            <div className="space-y-1.5">
              {checklist.map(c => (
                <div key={c.id} className="flex items-center gap-2 group">
                  <Checkbox checked={c.done} onCheckedChange={() => toggleCheck(c.id)} />
                  <span className={`text-sm flex-1 ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                  <button onClick={() => removeCheck(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCheck()}
                placeholder={locale === "pt" ? "Adicionar item…" : "Add item…"} className="h-8 text-sm" />
              <Button size="sm" variant="outline" onClick={addCheck} className="h-8"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">{locale === "pt" ? "Comentários" : "Comments"}</Label>
            <CommentThread projectId={projectId} entityType="task" entityId={task.id} />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="ghost" className="text-destructive" onClick={() => onRemove(task.id)}><Trash2 className="h-4 w-4" />{locale === "pt" ? "Excluir" : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TasksBoard;
