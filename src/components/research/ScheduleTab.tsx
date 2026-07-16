import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichEditor } from "./RichEditor";
import { RichText } from "./RichText";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, Calendar, Link2, Diamond, ChevronDown, ChevronRight,
  Sparkles, GanttChart, Kanban, CalendarDays, Users, TrendingDown, Flame
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SCHEDULE_STATUS_LABEL, type ResearchScheduleStatus } from "@/lib/research/types";
import { CommentThread } from "./CommentThread";
import { SCHEDULE_TEMPLATES } from "@/lib/research/scheduleTemplates";
import { computeCriticalPath } from "@/lib/research/criticalPath";
import { computeAutoProgress } from "@/lib/research/autoProgress";
import { TASK_STATUS_LABEL } from "@/lib/research/types";

const STATUS_COLOR: Record<ResearchScheduleStatus, string> = {
  planejado: "bg-slate-400",
  em_andamento: "bg-blue-500",
  concluido: "bg-emerald-500",
  atrasado: "bg-rose-500",
};

const DEPENDENCY_LABEL: Record<string, { pt: string; en: string }> = {
  FS: { pt: "Término → Início", en: "Finish → Start" },
  SS: { pt: "Início → Início", en: "Start → Start" },
  FF: { pt: "Término → Término", en: "Finish → Finish" },
  SF: { pt: "Início → Término", en: "Start → Finish" },
};

interface FormState {
  title: string;
  description: string;
  notes: string;
  phase: string;
  start_date: string;
  end_date: string;
  status: ResearchScheduleStatus;
  predecessor_id: string;
  dependency_type: "FS" | "SS" | "FF" | "SF";
  progress: number;
  progress_mode: "auto" | "manual";
  linked_task_ids: string[];
  is_milestone: boolean;
  assignee_id: string;
  assignee_ids: string[];
}

const EMPTY_FORM: FormState = {
  title: "", description: "", notes: "", phase: "", start_date: "", end_date: "",
  status: "planejado", predecessor_id: "", dependency_type: "FS",
  progress: 0, progress_mode: "auto", linked_task_ids: [], is_milestone: false, assignee_id: "", assignee_ids: [],
};

const dayMs = 86400000;

export const ScheduleTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"gantt" | "kanban" | "calendar" | "workload" | "burndown">("gantt");
  const [showCritical, setShowCritical] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { start_date: string; end_date: string }>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["research-schedule", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_schedule_items")
        .select("*").eq("project_id", projectId)
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["research-members-min", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_project_members")
        .select("id, user_id, full_name, invited_email, role").eq("project_id", projectId);
      return data ?? [];
    },
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ["research-tasks-min", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_tasks")
        .select("id, title, status, schedule_item_id").eq("project_id", projectId);
      return (data ?? []) as any[];
    },
  });

  const tasksByItem = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of projectTasks) {
      if (!t.schedule_item_id) continue;
      if (!m.has(t.schedule_item_id)) m.set(t.schedule_item_id, []);
      m.get(t.schedule_item_id)!.push(t);
    }
    return m;
  }, [projectTasks]);

  const effectiveProgress = (it: any): number =>
    it.progress_mode === "manual"
      ? (it.progress ?? 0)
      : computeAutoProgress(it, tasksByItem.get(it.id));

  // Persist auto-computed progress so other views (Gantt fill, burndown) stay consistent
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let changed = false;
      for (const it of items as any[]) {
        if (it.progress_mode === "manual") continue;
        const auto = computeAutoProgress(it, tasksByItem.get(it.id));
        if (auto !== (it.progress ?? 0)) {
          await supabase.from("research_schedule_items").update({ progress: auto }).eq("id", it.id);
          changed = true;
        }
      }
      if (changed && !cancelled) qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tasksByItem]);

  const memberLabel = (mid: string | null) => {
    if (!mid) return null;
    const m: any = members.find((x: any) => x.id === mid);
    return m ? (m.full_name || m.invited_email || "—") : null;
  };

  // Merge drafts (drag state) into items for rendering
  const displayItems = useMemo(() => items.map((i: any) => ({ ...i, ...(drafts[i.id] || {}) })), [items, drafts]);

  const cpm = useMemo(() => computeCriticalPath(displayItems), [displayItems]);

  const openEdit = (it: any) => {
    setEditingId(it.id);
    setForm({
      title: it.title ?? "", description: it.description ?? "", notes: it.notes ?? "", phase: it.phase ?? "",
      start_date: it.start_date ?? "", end_date: it.end_date ?? "",
      status: it.status, predecessor_id: it.predecessor_id ?? "",
      dependency_type: it.dependency_type ?? "FS",
      progress: it.progress ?? 0,
      progress_mode: (it.progress_mode === "manual" ? "manual" : "auto"),
      linked_task_ids: (tasksByItem.get(it.id) ?? []).map((t: any) => t.id),
      is_milestone: it.is_milestone ?? false,
      assignee_id: it.assignee_id ?? "",
      assignee_ids: (it.assignee_ids && it.assignee_ids.length ? it.assignee_ids : (it.assignee_id ? [it.assignee_id] : [])),
    });
    setOpen(true);
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setOpen(true); };

  const submit = async () => {
    if (!form.title) return toast.error(locale === "pt" ? "Título obrigatório" : "Title required");
    const autoProgress = computeAutoProgress(
      { status: form.status, start_date: form.start_date, end_date: form.end_date },
      form.linked_task_ids.map((id) => projectTasks.find((t: any) => t.id === id)).filter(Boolean) as any[],
    );
    const payload = {
      title: form.title, description: form.description || null, notes: form.notes || null, phase: form.phase || null,
      status: form.status,
      start_date: form.start_date || null, end_date: form.end_date || null,
      predecessor_id: form.predecessor_id || null, dependency_type: form.dependency_type,
      progress: form.progress_mode === "manual" ? form.progress : autoProgress,
      progress_mode: form.progress_mode,
      is_milestone: form.is_milestone,
      assignee_id: (form.assignee_ids[0] ?? form.assignee_id) || null,
      assignee_ids: form.assignee_ids,
    };
    let error; let savedId = editingId;
    if (editingId) ({ error } = await supabase.from("research_schedule_items").update(payload).eq("id", editingId));
    else {
      const { data, error: insErr } = await supabase.from("research_schedule_items").insert({
        ...payload, project_id: projectId, created_by: user!.id,
      }).select("id").single();
      error = insErr; savedId = data?.id ?? null;
    }
    if (error) return toast.error(error.message);

    // Sync linked tasks (schedule_item_id) for this item
    if (savedId) {
      const previous = (tasksByItem.get(savedId) ?? []).map((t: any) => t.id);
      const toLink = form.linked_task_ids.filter((id) => !previous.includes(id));
      const toUnlink = previous.filter((id) => !form.linked_task_ids.includes(id));
      if (toLink.length) await supabase.from("research_tasks").update({ schedule_item_id: savedId }).in("id", toLink);
      if (toUnlink.length) await supabase.from("research_tasks").update({ schedule_item_id: null }).in("id", toUnlink);
    }

    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
    qc.invalidateQueries({ queryKey: ["research-tasks-min", projectId] });
    setOpen(false); setForm(EMPTY_FORM); setEditingId(null);
  };

  const update = async (id: string, patch: any) => {
    await supabase.from("research_schedule_items").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
  };

  const remove = async (id: string) => {
    if (!confirm(locale === "pt" ? "Excluir este item?" : "Delete this item?")) return;
    await supabase.from("research_schedule_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
  };

  const toggleComments = (id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyTemplate = async (tplId: string, startDate: string) => {
    const tpl = SCHEDULE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const base = startDate ? new Date(startDate) : new Date();
    base.setHours(0, 0, 0, 0);
    const insertedIds: string[] = [];
    for (let idx = 0; idx < tpl.items.length; idx++) {
      const item = tpl.items[idx];
      const s = new Date(base); s.setMonth(s.getMonth() + item.monthStart);
      const e = new Date(base); e.setMonth(e.getMonth() + item.monthEnd);
      const payload: any = {
        project_id: projectId, created_by: user!.id,
        title: item.title, phase: item.phase,
        start_date: s.toISOString().slice(0, 10), end_date: e.toISOString().slice(0, 10),
        status: "planejado" as ResearchScheduleStatus,
        is_milestone: !!item.is_milestone, progress: 0,
        predecessor_id: item.predecessorRef != null ? insertedIds[item.predecessorRef] : null,
        dependency_type: "FS",
      };
      const { data } = await supabase.from("research_schedule_items").insert(payload).select("id").single();
      insertedIds.push(data?.id ?? "");
    }
    toast.success(locale === "pt" ? `Template aplicado (${tpl.items.length} itens)` : `Template applied`);
    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
    setTplOpen(false);
  };

  // Timeline calculation
  const { startMs, totalMs, monthMarkers, barIndexById } = useMemo(() => {
    const dated = displayItems.filter((i: any) => i.start_date && i.end_date);
    const dates = displayItems.flatMap((i: any) => [i.start_date, i.end_date]).filter(Boolean).map((d: string) => new Date(d).getTime());
    if (!dates.length) return { startMs: 0, totalMs: 0, monthMarkers: [] as any[], barIndexById: new Map<string, number>() };
    const min = Math.min(...dates); const max = Math.max(...dates);
    const start = new Date(min); start.setDate(1);
    const end = new Date(max); end.setMonth(end.getMonth() + 1, 1);
    const startMs = start.getTime();
    const totalMs = end.getTime() - startMs;
    const markers: any[] = [];
    const cur = new Date(start);
    while (cur < end) {
      markers.push({ label: cur.toLocaleDateString(locale === "pt" ? "pt-BR" : "en-US", { month: "short", year: "2-digit" }), ms: cur.getTime() });
      cur.setMonth(cur.getMonth() + 1);
    }
    const barIndexById = new Map<string, number>();
    dated.forEach((it: any, idx: number) => barIndexById.set(it.id, idx));
    return { startMs, totalMs, monthMarkers: markers, barIndexById };
  }, [displayItems, locale]);

  const todayPct = totalMs > 0 ? ((Date.now() - startMs) / totalMs) * 100 : -1;
  const datedItems = displayItems.filter((i: any) => i.start_date && i.end_date);
  const ROW_H = 32;

  // ---- Drag / Resize handling ----
  const ganttRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; mode: "move" | "resize-l" | "resize-r"; startX: number; origStart: number; origEnd: number; pxPerMs: number } | null>(null);

  const beginDrag = (e: React.PointerEvent, it: any, mode: "move" | "resize-l" | "resize-r") => {
    if (!ganttRef.current || !it.start_date || !it.end_date) return;
    e.preventDefault(); e.stopPropagation();
    const rect = ganttRef.current.getBoundingClientRect();
    dragRef.current = {
      id: it.id, mode, startX: e.clientX,
      origStart: new Date(it.start_date).getTime(),
      origEnd: new Date(it.end_date).getTime(),
      pxPerMs: rect.width / totalMs,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    const deltaMs = Math.round((e.clientX - d.startX) / d.pxPerMs / dayMs) * dayMs;
    let s = d.origStart, en = d.origEnd;
    if (d.mode === "move") { s += deltaMs; en += deltaMs; }
    else if (d.mode === "resize-l") { s = Math.min(en - dayMs, d.origStart + deltaMs); }
    else if (d.mode === "resize-r") { en = Math.max(s + dayMs, d.origEnd + deltaMs); }
    setDrafts((prev) => ({
      ...prev,
      [d.id]: {
        start_date: new Date(s).toISOString().slice(0, 10),
        end_date: new Date(en).toISOString().slice(0, 10),
      },
    }));
  };

  const endDrag = async (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    dragRef.current = null;
    const draft = drafts[d.id];
    if (draft) {
      const orig = items.find((i: any) => i.id === d.id);
      if (orig && (orig.start_date !== draft.start_date || orig.end_date !== draft.end_date)) {
        await update(d.id, draft);
      }
      setDrafts((prev) => { const n = { ...prev }; delete n[d.id]; return n; });
    }
  };

  // ---- Burndown ----
  const burndown = useMemo(() => {
    const dated = items.filter((i: any) => i.start_date && i.end_date);
    if (!dated.length) return null;
    const min = Math.min(...dated.map((i: any) => new Date(i.start_date).getTime()));
    const max = Math.max(...dated.map((i: any) => new Date(i.end_date).getTime()));
    const totalDays = Math.max(1, Math.round((max - min) / dayMs));
    const totalWork = dated.reduce((s: number, i: any) => s + (new Date(i.end_date).getTime() - new Date(i.start_date).getTime()) / dayMs, 0);
    const series: { day: number; ideal: number; actual: number }[] = [];
    const today = Date.now();
    for (let d = 0; d <= totalDays; d += Math.max(1, Math.floor(totalDays / 30))) {
      const cursor = min + d * dayMs;
      const ideal = totalWork * (1 - d / totalDays);
      const completedWork = dated.reduce((acc: number, i: any) => {
        if (cursor < new Date(i.start_date).getTime()) return acc;
        const dur = (new Date(i.end_date).getTime() - new Date(i.start_date).getTime()) / dayMs;
        const progress = cursor > today ? (i.progress ?? 0) / 100 : Math.min(1, (i.progress ?? 0) / 100);
        return acc + dur * progress;
      }, 0);
      series.push({ day: d, ideal, actual: Math.max(0, totalWork - completedWork) });
    }
    return { series, totalWork, totalDays, min };
  }, [items]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{locale === "pt" ? "Cronograma" : "Schedule"}</h2>
          <p className="text-sm text-muted-foreground">
            {locale === "pt"
              ? "Gantt drag/resize, caminho crítico, Kanban, Calendário, Workload e Burndown."
              : "Drag/resize Gantt, critical path, Kanban, Calendar, Workload, Burndown."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={tplOpen} onOpenChange={setTplOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Sparkles className="h-4 w-4" />{locale === "pt" ? "Templates" : "Templates"}</Button>
            </DialogTrigger>
            <TemplatesDialog onApply={applyTemplate} locale={locale} />
          </Dialog>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(EMPTY_FORM); setEditingId(null); } }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Novo item" : "New item"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingId ? (locale === "pt" ? "Editar item" : "Edit item") : (locale === "pt" ? "Novo item do cronograma" : "New schedule item")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto px-1 py-1 -mx-1">
                <div><Label>{locale === "pt" ? "Título" : "Title"}</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Fase" : "Phase"}</Label>
                  <Input placeholder={locale === "pt" ? "Ex.: Coleta, Análise…" : "e.g. Collection…"}
                    value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>{locale === "pt" ? "Início" : "Start"}</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label>{locale === "pt" ? "Fim" : "End"}</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: ResearchScheduleStatus) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(SCHEDULE_STATUS_LABEL) as ResearchScheduleStatus[]).map(s =>
                        <SelectItem key={s} value={s}>{SCHEDULE_STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div>
                    <Label>{locale === "pt" ? "Responsáveis" : "Assignees"}</Label>
                    <div className="rounded-md border max-h-40 overflow-y-auto p-2 space-y-1.5 bg-background">
                      {members.length === 0 && (
                        <p className="text-xs text-muted-foreground px-1 py-2">
                          {locale === "pt" ? "Sem membros na equipe." : "No team members."}
                        </p>
                      )}
                      {members.map((m: any) => {
                        const checked = form.assignee_ids.includes(m.id);
                        return (
                          <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next = v
                                  ? [...form.assignee_ids, m.id]
                                  : form.assignee_ids.filter((x) => x !== m.id);
                                setForm({ ...form, assignee_ids: next, assignee_id: next[0] ?? "" });
                              }}
                            />
                            <span className="truncate">{m.full_name || m.invited_email || "—"}</span>
                          </label>
                        );
                      })}
                    </div>
                    {form.assignee_ids.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {form.assignee_ids.length} {locale === "pt" ? "selecionado(s)" : "selected"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">{locale === "pt" ? "Progresso automático" : "Automatic progress"}</Label>
                      <p className="text-xs text-muted-foreground">
                        {locale === "pt"
                          ? "Calculado pelas tarefas vinculadas ou, na ausência delas, por status + tempo decorrido."
                          : "Computed from linked tasks, or status + elapsed time when none."}
                      </p>
                    </div>
                    <Switch
                      checked={form.progress_mode === "auto"}
                      onCheckedChange={(v) => setForm({ ...form, progress_mode: v ? "auto" : "manual" })}
                    />
                  </div>

                  {form.progress_mode === "manual" ? (
                    <div>
                      <Label>{locale === "pt" ? `Progresso (manual): ${form.progress}%` : `Progress (manual): ${form.progress}%`}</Label>
                      <Slider min={0} max={100} step={5} value={[form.progress]} onValueChange={([v]) => setForm({ ...form, progress: v })} className="mt-2" />
                    </div>
                  ) : (
                    (() => {
                      const linked = form.linked_task_ids
                        .map((id) => projectTasks.find((t: any) => t.id === id))
                        .filter(Boolean) as any[];
                      const previewAuto = computeAutoProgress(
                        { status: form.status, start_date: form.start_date, end_date: form.end_date },
                        linked,
                      );
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{locale === "pt" ? "Progresso calculado" : "Computed progress"}</span>
                            <Badge variant="secondary">{previewAuto}%</Badge>
                          </div>
                          <Progress value={previewAuto} className="h-2" />
                          <p className="text-[11px] text-muted-foreground">
                            {linked.length > 0
                              ? (locale === "pt"
                                  ? `Baseado em ${linked.length} tarefa(s) vinculada(s).`
                                  : `Based on ${linked.length} linked task(s).`)
                              : (locale === "pt"
                                  ? "Sem tarefas vinculadas — estimado por status + tempo."
                                  : "No linked tasks — estimated by status + time.")}
                          </p>
                        </div>
                      );
                    })()
                  )}

                  <div>
                    <Label className="text-xs">{locale === "pt" ? "Tarefas vinculadas" : "Linked tasks"}</Label>
                    <div className="mt-1.5 max-h-40 overflow-y-auto rounded-md border divide-y">
                      {projectTasks.filter((t: any) => !t.schedule_item_id || form.linked_task_ids.includes(t.id) || (editingId && t.schedule_item_id === editingId)).length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">{locale === "pt" ? "Nenhuma tarefa disponível." : "No tasks available."}</p>
                      ) : (
                        projectTasks
                          .filter((t: any) => !t.schedule_item_id || form.linked_task_ids.includes(t.id) || (editingId && t.schedule_item_id === editingId))
                          .map((t: any) => {
                            const checked = form.linked_task_ids.includes(t.id);
                            return (
                              <label key={t.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => setForm({
                                    ...form,
                                    linked_task_ids: v
                                      ? [...form.linked_task_ids, t.id]
                                      : form.linked_task_ids.filter((id) => id !== t.id),
                                  })}
                                />
                                <span className="truncate flex-1">{t.title}</span>
                                <Badge variant="outline" className="text-[10px]">{TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL]?.[locale] ?? t.status}</Badge>
                              </label>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm">{locale === "pt" ? "É um marco" : "Is milestone"}</Label>
                    <p className="text-xs text-muted-foreground">{locale === "pt" ? "Marcos aparecem como losango." : "Milestones appear as diamonds."}</p>
                  </div>
                  <Switch checked={form.is_milestone} onCheckedChange={(v) => setForm({ ...form, is_milestone: v })} />
                </div>
                <div className="rounded-lg border p-3 space-y-3">
                  <Label className="flex items-center gap-1.5 text-sm"><Link2 className="h-3.5 w-3.5" />{locale === "pt" ? "Dependência" : "Dependency"}</Label>
                  <Select value={form.predecessor_id || "none"} onValueChange={(v) => setForm({ ...form, predecessor_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder={locale === "pt" ? "Sem dependência" : "No dependency"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{locale === "pt" ? "Sem dependência" : "No dependency"}</SelectItem>
                      {items.filter((i: any) => i.id !== editingId).map((i: any) =>
                        <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.predecessor_id && (
                    <Select value={form.dependency_type} onValueChange={(v: any) => setForm({ ...form, dependency_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DEPENDENCY_LABEL).map(([k, v]) =>
                          <SelectItem key={k} value={k}>{k} — {v[locale]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div><Label>{locale === "pt" ? "Descrição" : "Description"}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{locale === "pt" ? "Suporta markdown — use \"Ver\" para visualizar tabelas formatadas." : "Supports markdown — use \"View\" to see formatted tables."}</p>
                  <RichEditor value={form.description} onChange={(v) => setForm({ ...form, description: v })} minHeight={200}
                    storagePrefix={`${projectId}/schedule-desc`}
                    placeholder={locale === "pt" ? "Descrição desta etapa…" : "Description…"} /></div>
                <div>
                  <Label>{locale === "pt" ? "Anotações detalhadas" : "Detailed notes"}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{locale === "pt" ? "Espaço amplo para registrar tudo sobre esta etapa — tabelas, imagens e listas." : "Rich space — tables, images, lists."}</p>
                  <RichEditor value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} minHeight={220}
                    storagePrefix={`${projectId}/schedule`}
                    placeholder={locale === "pt" ? "Informações detalhadas desta etapa…" : "Detailed information…"} />
                </div>
              </div>
              <DialogFooter><Button onClick={submit}>{editingId ? (locale === "pt" ? "Salvar" : "Save") : (locale === "pt" ? "Criar" : "Create")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="gantt"><GanttChart className="h-4 w-4" />Gantt</TabsTrigger>
          <TabsTrigger value="kanban"><Kanban className="h-4 w-4" />Kanban</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4" />{locale === "pt" ? "Calendário" : "Calendar"}</TabsTrigger>
          <TabsTrigger value="workload"><Users className="h-4 w-4" />Workload</TabsTrigger>
          <TabsTrigger value="burndown"><TrendingDown className="h-4 w-4" />Burndown</TabsTrigger>
        </TabsList>

        {/* ===== Gantt ===== */}
        <TabsContent value="gantt" className="space-y-4">
          {datedItems.length > 0 && totalMs > 0 && (
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-end gap-2 mb-3 text-xs">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-rose-500" />{locale === "pt" ? "Caminho crítico" : "Critical path"}</span>
                  <Switch checked={showCritical} onCheckedChange={setShowCritical} />
                </div>
                <div ref={ganttRef} className="relative" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
                  <div className="relative h-6 border-b text-[10px] text-muted-foreground mb-2">
                    {monthMarkers.map((m, i) => (
                      <div key={i} className="absolute top-0" style={{ left: `${((m.ms - startMs) / totalMs) * 100}%` }}>
                        <div className="h-2 w-px bg-border" />
                        <span className="ml-1">{m.label}</span>
                      </div>
                    ))}
                    {todayPct >= 0 && todayPct <= 100 && (
                      <div className="absolute top-0 h-[1000px] w-0.5 bg-primary/40 z-20 pointer-events-none" style={{ left: `${todayPct}%` }}>
                        <span className="absolute -top-4 -translate-x-1/2 text-[10px] font-semibold text-primary">{locale === "pt" ? "Hoje" : "Today"}</span>
                      </div>
                    )}
                  </div>

                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ top: 32, height: datedItems.length * ROW_H, width: "100%" }}
                  >
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill="hsl(var(--muted-foreground))" />
                      </marker>
                    </defs>
                    {datedItems.map((it: any) => {
                      if (!it.predecessor_id) return null;
                      const pred = datedItems.find((p: any) => p.id === it.predecessor_id);
                      if (!pred) return null;
                      const predIdx = barIndexById.get(pred.id);
                      const curIdx = barIndexById.get(it.id);
                      if (predIdx == null || curIdx == null) return null;
                      const ps = new Date(pred.start_date).getTime();
                      const pe = new Date(pred.end_date).getTime();
                      const cs = new Date(it.start_date).getTime();
                      const ce = new Date(it.end_date).getTime();
                      const type = it.dependency_type ?? "FS";
                      const xFrom = type === "SS" || type === "SF"
                        ? ((ps - startMs) / totalMs) * 100
                        : ((pe - startMs) / totalMs) * 100;
                      const xTo = type === "FF" || type === "SF"
                        ? ((ce - startMs) / totalMs) * 100
                        : ((cs - startMs) / totalMs) * 100;
                      const yFrom = predIdx * ROW_H + ROW_H / 2;
                      const yTo = curIdx * ROW_H + ROW_H / 2;
                      const isCrit = showCritical && cpm.get(it.id)?.critical && cpm.get(pred.id)?.critical;
                      return (
                        <path
                          key={it.id}
                          d={`M ${xFrom}% ${yFrom} L ${xFrom}% ${yTo} L ${xTo}% ${yTo}`}
                          stroke={isCrit ? "hsl(0 84% 60%)" : "hsl(var(--muted-foreground) / 0.5)"}
                          strokeWidth={isCrit ? 1.6 : 1.2}
                          fill="none"
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })}
                  </svg>

                  <div className="space-y-0">
                    {datedItems.map((it: any) => {
                      const s = new Date(it.start_date).getTime();
                      const e = new Date(it.end_date).getTime();
                      const left = ((s - startMs) / totalMs) * 100;
                      const width = Math.max(1, ((e - s) / totalMs) * 100);
                      const progress = effectiveProgress(it);
                      const isMilestone = it.is_milestone;
                      const isCrit = showCritical && cpm.get(it.id)?.critical;
                      return (
                        <div key={it.id} className="relative" style={{ height: ROW_H }}>
                          {isMilestone ? (
                            <button
                              onClick={() => openEdit(it)}
                              className="absolute top-2 -translate-x-1/2 z-10 group"
                              style={{ left: `${left}%` }}
                              title={it.title}
                            >
                              <Diamond className={`h-5 w-5 ${isCrit ? "text-rose-500" : "text-amber-500"} fill-current rotate-45`} />
                              <span className="absolute left-7 top-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 bg-popover px-2 py-0.5 rounded shadow">{it.title}</span>
                            </button>
                          ) : (
                            <div
                              className={`absolute h-7 top-1 rounded-md ${STATUS_COLOR[it.status as ResearchScheduleStatus]} opacity-90 hover:opacity-100 transition-opacity flex items-center px-2 overflow-hidden z-10 select-none ${isCrit ? "ring-2 ring-rose-500" : ""}`}
                              style={{ left: `${left}%`, width: `${width}%`, minWidth: 12, cursor: "grab", touchAction: "none" }}
                              onPointerDown={(ev) => beginDrag(ev, it, "move")}
                              onDoubleClick={() => openEdit(it)}
                              title={`${it.title} • ${locale === "pt" ? "arraste para mover, duplo-clique para editar" : "drag to move, double-click to edit"}`}
                            >
                              <div
                                onPointerDown={(ev) => beginDrag(ev, it, "resize-l")}
                                className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/20"
                              />
                              {progress > 0 && (
                                <div className="absolute inset-y-0 left-0 bg-white/30 pointer-events-none" style={{ width: `${progress}%` }} />
                              )}
                              <span className="text-[11px] text-white font-medium truncate relative z-10">{it.title}</span>
                              {progress > 0 && <span className="text-[10px] text-white/90 ml-auto relative z-10 shrink-0 mr-2">{progress}%</span>}
                              <div
                                onPointerDown={(ev) => beginDrag(ev, it, "resize-r")}
                                className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/20"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {showCritical && (
                  <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
                    <Flame className="h-3 w-3 text-rose-500" />
                    {locale === "pt"
                      ? "Itens marcados em vermelho não têm folga: atraso aqui atrasa o projeto inteiro."
                      : "Red items have zero slack: any delay slips the whole project."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* List */}
          <div className="space-y-2">
            {items.map((it: any) => {
              const pred = items.find((p: any) => p.id === it.predecessor_id);
              const showComments = expandedComments.has(it.id);
              const node = cpm.get(it.id);
              return (
                <Card key={it.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-1 self-stretch rounded-full ${STATUS_COLOR[it.status as ResearchScheduleStatus]}`} />
                      <button onClick={() => openEdit(it)} className="flex-1 min-w-0 text-left hover:opacity-80">
                        <div className="flex items-center gap-2 flex-wrap">
                          {it.is_milestone && <Diamond className="h-3.5 w-3.5 text-amber-500 rotate-45" />}
                          <h4 className="font-medium">{it.title}</h4>
                          {it.phase && <Badge variant="outline" className="text-[10px]">{it.phase}</Badge>}
                          {effectiveProgress(it) > 0 && <Badge variant="secondary" className="text-[10px]">{effectiveProgress(it)}%{it.progress_mode !== "manual" && <Sparkles className="h-2.5 w-2.5 ml-0.5" />}</Badge>}
                          {node?.critical && <Badge className="text-[10px] bg-rose-500"><Flame className="h-2.5 w-2.5" />{locale === "pt" ? "Crítico" : "Critical"}</Badge>}
                          {memberLabel(it.assignee_id) && <Badge variant="outline" className="text-[10px]"><Users className="h-2.5 w-2.5" />{memberLabel(it.assignee_id)}</Badge>}
                          {pred && <Badge variant="outline" className="text-[10px] gap-1"><Link2 className="h-2.5 w-2.5" />{pred.title}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                          {it.start_date && <span><Calendar className="h-3 w-3 inline mr-1" />{new Date(it.start_date).toLocaleDateString()}{it.end_date && ` → ${new Date(it.end_date).toLocaleDateString()}`}</span>}
                          {node && !node.critical && <span className="text-emerald-600">{locale === "pt" ? `Folga: ${node.slack.toFixed(0)} dias` : `Slack: ${node.slack.toFixed(0)}d`}</span>}
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <Select value={it.status} onValueChange={(v: ResearchScheduleStatus) => update(it.id, { status: v })}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{(Object.keys(SCHEDULE_STATUS_LABEL) as ResearchScheduleStatus[]).map(s =>
                            <SelectItem key={s} value={s}>{SCHEDULE_STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => toggleComments(it.id)} title={locale === "pt" ? "Discussão" : "Discussion"}>
                          {showComments ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {showComments && (
                      <div className="mt-3 pl-4">
                        <CommentThread projectId={projectId} entityType="schedule_item" entityId={it.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">{locale === "pt" ? "Nenhum item no cronograma. Use Templates para começar rápido." : "No schedule items. Use Templates to start fast."}</p>
            )}
          </div>
        </TabsContent>

        {/* ===== Kanban ===== */}
        <TabsContent value="kanban">
          <KanbanView items={items} update={update} openEdit={openEdit} locale={locale} />
        </TabsContent>

        {/* ===== Calendar ===== */}
        <TabsContent value="calendar">
          <CalendarView items={items} openEdit={openEdit} locale={locale} />
        </TabsContent>

        {/* ===== Workload ===== */}
        <TabsContent value="workload">
          <WorkloadView items={items} members={members} locale={locale} />
        </TabsContent>

        {/* ===== Burndown ===== */}
        <TabsContent value="burndown">
          <BurndownChart data={burndown} locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ===== Templates Dialog =====
const TemplatesDialog = ({ onApply, locale }: { onApply: (id: string, start: string) => void; locale: string }) => {
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{locale === "pt" ? "Templates de cronograma" : "Schedule templates"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{locale === "pt" ? "Data de início" : "Start date"}</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="max-w-xs" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto">
          {SCHEDULE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`text-left rounded-lg border p-3 hover:border-primary transition ${selected === t.id ? "border-primary ring-2 ring-primary/30 bg-primary/5" : ""}`}
            >
              <p className="font-medium text-sm">{locale === "pt" ? t.label_pt : t.label_en}</p>
              <p className="text-xs text-muted-foreground mt-1">{locale === "pt" ? t.description_pt : t.description_en}</p>
              <p className="text-[10px] text-muted-foreground mt-2">{t.items.length} {locale === "pt" ? "itens" : "items"} · {t.totalMonths} {locale === "pt" ? "meses" : "months"}</p>
            </button>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!selected} onClick={() => selected && onApply(selected, start)}>
          {locale === "pt" ? "Aplicar template" : "Apply template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

// ===== Kanban View =====
const KanbanView = ({ items, update, openEdit, locale }: any) => {
  const cols: { key: ResearchScheduleStatus; label: string }[] = (Object.keys(SCHEDULE_STATUS_LABEL) as ResearchScheduleStatus[])
    .map((k) => ({ key: k, label: SCHEDULE_STATUS_LABEL[k][locale as "pt" | "en"] }));
  const onDrop = (e: React.DragEvent, status: ResearchScheduleStatus) => {
    const id = e.dataTransfer.getData("text/plain");
    if (id) update(id, { status });
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {cols.map((c) => {
        const list = items.filter((i: any) => i.status === c.key);
        return (
          <div
            key={c.key}
            className="bg-muted/30 rounded-lg p-3 min-h-[200px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, c.key)}
          >
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 text-muted-foreground flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[c.key]}`} />
              {c.label} <span className="ml-auto text-[10px]">({list.length})</span>
            </h4>
            <div className="space-y-2">
              {list.map((it: any) => (
                <Card
                  key={it.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", it.id)}
                  onClick={() => openEdit(it)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      {it.is_milestone && <Diamond className="h-3 w-3 text-amber-500 rotate-45" />}
                      <p className="text-sm font-medium line-clamp-2">{it.title}</p>
                    </div>
                    {it.phase && <Badge variant="outline" className="text-[10px]">{it.phase}</Badge>}
                    {it.end_date && <p className="text-[10px] text-muted-foreground"><Calendar className="h-2.5 w-2.5 inline mr-1" />{new Date(it.end_date).toLocaleDateString()}</p>}
                    {(it.progress ?? 0) > 0 && (
                      <div className="h-1 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${it.progress}%` }} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ===== Calendar View =====
const CalendarView = ({ items, openEdit, locale }: any) => {
  const grouped: Record<string, any[]> = {};
  items.forEach((it: any) => {
    if (!it.start_date) return;
    const d = new Date(it.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    (grouped[key] ||= []).push(it);
  });
  const months = Object.keys(grouped).sort();
  return (
    <div className="space-y-4">
      {months.map((m) => {
        const [y, mo] = m.split("-");
        const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(locale === "pt" ? "pt-BR" : "en-US", { month: "long", year: "numeric" });
        return (
          <Card key={m}>
            <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{label}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {grouped[m].sort((a: any, b: any) => a.start_date.localeCompare(b.start_date)).map((it: any) => (
                <button key={it.id} onClick={() => openEdit(it)} className="w-full flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-muted text-left">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLOR[it.status as ResearchScheduleStatus]}`} />
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{new Date(it.start_date).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</span>
                  {it.is_milestone && <Diamond className="h-3 w-3 text-amber-500 rotate-45 shrink-0" />}
                  <span className="flex-1 truncate">{it.title}</span>
                  {it.phase && <Badge variant="outline" className="text-[10px]">{it.phase}</Badge>}
                </button>
              ))}
            </CardContent>
          </Card>
        );
      })}
      {!months.length && <p className="text-sm text-muted-foreground text-center py-12">{locale === "pt" ? "Sem itens com data." : "No dated items."}</p>}
    </div>
  );
};

// ===== Workload View =====
const WorkloadView = ({ items, members, locale }: any) => {
  const totals = useMemo(() => {
    const map = new Map<string, { days: number; count: number; name: string }>();
    items.forEach((it: any) => {
      if (!it.start_date || !it.end_date) return;
      const days = Math.max(1, (new Date(it.end_date).getTime() - new Date(it.start_date).getTime()) / dayMs);
      const key = it.assignee_id || "_unassigned";
      const name = it.assignee_id
        ? (members.find((m: any) => m.id === it.assignee_id)?.full_name || members.find((m: any) => m.id === it.assignee_id)?.invited_email || "—")
        : (locale === "pt" ? "Sem responsável" : "Unassigned");
      const cur = map.get(key) || { days: 0, count: 0, name };
      cur.days += days; cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.days - a.days);
  }, [items, members, locale]);
  const max = Math.max(1, ...totals.map((t) => t.days));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{locale === "pt" ? "Carga por pessoa (dias planejados)" : "Workload per person (planned days)"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {totals.map((t, idx) => (
          <div key={idx}>
            <div className="flex justify-between text-sm mb-1">
              <span>{t.name}</span>
              <span className="text-muted-foreground">{t.days.toFixed(0)}d · {t.count} {locale === "pt" ? "itens" : "items"}</span>
            </div>
            <div className="h-3 bg-muted rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/70" style={{ width: `${(t.days / max) * 100}%` }} />
            </div>
          </div>
        ))}
        {!totals.length && <p className="text-sm text-muted-foreground text-center py-8">{locale === "pt" ? "Nada para mostrar." : "Nothing to show."}</p>}
      </CardContent>
    </Card>
  );
};

// ===== Burndown =====
const BurndownChart = ({ data, locale }: { data: any; locale: string }) => {
  if (!data) return <p className="text-sm text-muted-foreground text-center py-12">{locale === "pt" ? "Sem dados ainda." : "No data yet."}</p>;
  const { series, totalWork, totalDays, min } = data;
  const W = 800, H = 260, PAD = 36;
  const xScale = (d: number) => PAD + (d / totalDays) * (W - PAD * 2);
  const yScale = (v: number) => H - PAD - (v / totalWork) * (H - PAD * 2);
  const path = (key: "ideal" | "actual") => series.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${xScale(p.day)} ${yScale(p[key])}`).join(" ");
  const todayX = xScale(Math.min(totalDays, Math.max(0, (Date.now() - min) / dayMs)));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{locale === "pt" ? "Burndown — trabalho restante" : "Burndown — remaining work"}</CardTitle></CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="hsl(var(--border))" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="hsl(var(--border))" />
          <path d={path("ideal")} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" fill="none" />
          <path d={path("actual")} stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
          <line x1={todayX} y1={PAD} x2={todayX} y2={H - PAD} stroke="hsl(var(--primary)/0.4)" />
          <text x={todayX + 4} y={PAD + 10} fontSize="10" fill="hsl(var(--primary))">{locale === "pt" ? "Hoje" : "Today"}</text>
          <text x={PAD} y={PAD - 8} fontSize="10" fill="hsl(var(--muted-foreground))">{totalWork.toFixed(0)}d</text>
          <text x={W - PAD - 30} y={H - PAD + 14} fontSize="10" fill="hsl(var(--muted-foreground))">{totalDays}d</text>
        </svg>
        <p className="text-xs text-muted-foreground mt-2">
          {locale === "pt"
            ? "Linha tracejada: ritmo ideal. Linha sólida: trabalho restante real considerando o progresso atual."
            : "Dashed: ideal pace. Solid: actual remaining work based on current progress."}
        </p>
      </CardContent>
    </Card>
  );
};
