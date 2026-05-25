import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, Calendar, Link2, Diamond, ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SCHEDULE_STATUS_LABEL, type ResearchScheduleStatus } from "@/lib/research/types";
import { CommentThread } from "./CommentThread";

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
  phase: string;
  start_date: string;
  end_date: string;
  status: ResearchScheduleStatus;
  predecessor_id: string;
  dependency_type: "FS" | "SS" | "FF" | "SF";
  progress: number;
  is_milestone: boolean;
}

const EMPTY_FORM: FormState = {
  title: "", description: "", phase: "", start_date: "", end_date: "",
  status: "planejado", predecessor_id: "", dependency_type: "FS", progress: 0, is_milestone: false,
};

export const ScheduleTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

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

  const openEdit = (it: any) => {
    setEditingId(it.id);
    setForm({
      title: it.title ?? "",
      description: it.description ?? "",
      phase: it.phase ?? "",
      start_date: it.start_date ?? "",
      end_date: it.end_date ?? "",
      status: it.status,
      predecessor_id: it.predecessor_id ?? "",
      dependency_type: it.dependency_type ?? "FS",
      progress: it.progress ?? 0,
      is_milestone: it.is_milestone ?? false,
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.title) return toast.error(locale === "pt" ? "Título obrigatório" : "Title required");
    const payload = {
      title: form.title,
      description: form.description || null,
      phase: form.phase || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      predecessor_id: form.predecessor_id || null,
      dependency_type: form.dependency_type,
      progress: form.progress,
      is_milestone: form.is_milestone,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("research_schedule_items").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("research_schedule_items").insert({
        ...payload, project_id: projectId, created_by: user!.id,
      }));
    }
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
    setOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
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

  // Timeline calculation + dependency arrows
  const { startMs, totalMs, monthMarkers, barIndexById } = useMemo(() => {
    const dated = items.filter((i: any) => i.start_date && i.end_date);
    const dates = items.flatMap((i: any) => [i.start_date, i.end_date]).filter(Boolean).map(d => new Date(d).getTime());
    if (!dates.length) return { startMs: 0, totalMs: 0, monthMarkers: [] as any[], barIndexById: new Map<string, number>() };
    const min = Math.min(...dates);
    const max = Math.max(...dates);
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
  }, [items, locale]);

  const todayPct = totalMs > 0 ? ((Date.now() - startMs) / totalMs) * 100 : -1;
  const datedItems = items.filter((i: any) => i.start_date && i.end_date);
  const ROW_H = 28;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{locale === "pt" ? "Cronograma" : "Schedule"}</h2>
          <p className="text-sm text-muted-foreground">
            {locale === "pt"
              ? "Gantt com dependências, marcos e progresso. Itens viram pauta de reuniões."
              : "Gantt with dependencies, milestones and progress. Items become meeting agenda."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(EMPTY_FORM); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4" />{locale === "pt" ? "Novo item" : "New item"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? (locale === "pt" ? "Editar item" : "Edit item") : (locale === "pt" ? "Novo item do cronograma" : "New schedule item")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div><Label>{locale === "pt" ? "Título" : "Title"}</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>{locale === "pt" ? "Fase" : "Phase"}</Label>
                <Input placeholder={locale === "pt" ? "Ex.: Coleta, Análise…" : "e.g. Collection, Analysis…"}
                  value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{locale === "pt" ? "Início" : "Start"}</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Fim" : "End"}</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v: ResearchScheduleStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(SCHEDULE_STATUS_LABEL) as ResearchScheduleStatus[]).map(s =>
                    <SelectItem key={s} value={s}>{SCHEDULE_STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
                </Select></div>

              <div>
                <Label>{locale === "pt" ? `Progresso: ${form.progress}%` : `Progress: ${form.progress}%`}</Label>
                <Slider min={0} max={100} step={5} value={[form.progress]} onValueChange={([v]) => setForm({ ...form, progress: v })} className="mt-2" />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">{locale === "pt" ? "É um marco" : "Is milestone"}</Label>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Marcos aparecem como losango no Gantt." : "Milestones appear as diamonds on the Gantt."}</p>
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
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>{editingId ? (locale === "pt" ? "Salvar" : "Save") : (locale === "pt" ? "Criar" : "Create")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Gantt */}
      {datedItems.length > 0 && totalMs > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="relative">
              {/* Month markers */}
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

              {/* SVG layer for dependency arrows */}
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
                  return (
                    <path
                      key={it.id}
                      d={`M ${xFrom}% ${yFrom} L ${xFrom}% ${yTo} L ${xTo}% ${yTo}`}
                      stroke="hsl(var(--muted-foreground) / 0.6)"
                      strokeWidth="1.2"
                      fill="none"
                      markerEnd="url(#arrowhead)"
                    />
                  );
                })}
              </svg>

              {/* Bars */}
              <div className="space-y-0">
                {datedItems.map((it: any) => {
                  const s = new Date(it.start_date).getTime();
                  const e = new Date(it.end_date).getTime();
                  const left = ((s - startMs) / totalMs) * 100;
                  const width = Math.max(1, ((e - s) / totalMs) * 100);
                  const progress = it.progress ?? 0;
                  const isMilestone = it.is_milestone;
                  return (
                    <div key={it.id} className="relative" style={{ height: ROW_H }}>
                      {isMilestone ? (
                        <button
                          onClick={() => openEdit(it)}
                          className="absolute top-1.5 -translate-x-1/2 z-10 group"
                          style={{ left: `${left}%` }}
                          title={it.title}
                        >
                          <Diamond className={`h-5 w-5 ${STATUS_COLOR[it.status as ResearchScheduleStatus]} text-white fill-current rotate-45 rounded-sm`} style={{ fill: "currentColor" }} />
                          <span className="absolute left-7 top-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 bg-popover px-2 py-0.5 rounded shadow">{it.title}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openEdit(it)}
                          className={`absolute h-6 top-0.5 rounded-md ${STATUS_COLOR[it.status as ResearchScheduleStatus]} opacity-85 hover:opacity-100 hover:ring-2 hover:ring-primary/40 transition-all flex items-center px-2 overflow-hidden cursor-pointer z-10`}
                          style={{ left: `${left}%`, width: `${width}%`, minWidth: 8 }}
                        >
                          {/* Progress overlay */}
                          {progress > 0 && (
                            <div className="absolute inset-y-0 left-0 bg-white/30 pointer-events-none" style={{ width: `${progress}%` }} />
                          )}
                          <span className="text-[11px] text-white font-medium truncate relative z-10">{it.title}</span>
                          {progress > 0 && <span className="text-[10px] text-white/90 ml-auto relative z-10 shrink-0">{progress}%</span>}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-2">
        {items.map((it: any) => {
          const pred = items.find((p: any) => p.id === it.predecessor_id);
          const showComments = expandedComments.has(it.id);
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
                      {(it.progress ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">{it.progress}%</Badge>}
                      {pred && <Badge variant="outline" className="text-[10px] gap-1"><Link2 className="h-2.5 w-2.5" />{pred.title}</Badge>}
                    </div>
                    {it.description && <p className="text-sm text-muted-foreground mt-1">{it.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      {it.start_date && <span><Calendar className="h-3 w-3 inline mr-1" />{new Date(it.start_date).toLocaleDateString()}{it.end_date && ` → ${new Date(it.end_date).toLocaleDateString()}`}</span>}
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
          <p className="text-sm text-muted-foreground text-center py-12">{locale === "pt" ? "Nenhum item no cronograma." : "No schedule items."}</p>
        )}
      </div>
    </div>
  );
};
