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
import { Plus, Trash2, Calendar } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SCHEDULE_STATUS_LABEL, type ResearchScheduleStatus } from "@/lib/research/types";

const STATUS_COLOR: Record<ResearchScheduleStatus, string> = {
  planejado: "bg-slate-400",
  em_andamento: "bg-blue-500",
  concluido: "bg-emerald-500",
  atrasado: "bg-rose-500",
};

export const ScheduleTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", phase: "", start_date: "", end_date: "",
    status: "planejado" as ResearchScheduleStatus,
  });

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

  const create = async () => {
    if (!form.title) return toast.error(locale === "pt" ? "Título obrigatório" : "Title required");
    const { error } = await supabase.from("research_schedule_items").insert({
      project_id: projectId, created_by: user!.id,
      title: form.title, description: form.description || null,
      phase: form.phase || null, status: form.status,
      start_date: form.start_date || null, end_date: form.end_date || null,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
    setOpen(false);
    setForm({ title: "", description: "", phase: "", start_date: "", end_date: "", status: "planejado" });
  };

  const update = async (id: string, patch: any) => {
    await supabase.from("research_schedule_items").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
  };

  const remove = async (id: string) => {
    await supabase.from("research_schedule_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-schedule", projectId] });
  };

  // Timeline calculation
  const { startMs, totalMs, monthMarkers } = useMemo(() => {
    const dates = items.flatMap((i: any) => [i.start_date, i.end_date]).filter(Boolean).map(d => new Date(d).getTime());
    if (!dates.length) return { startMs: 0, totalMs: 0, monthMarkers: [] as any[] };
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
    return { startMs, totalMs, monthMarkers: markers };
  }, [items, locale]);

  const todayPct = totalMs > 0 ? ((Date.now() - startMs) / totalMs) * 100 : -1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{locale === "pt" ? "Cronograma" : "Schedule"}</h2>
          <p className="text-sm text-muted-foreground">{locale === "pt" ? "Planeje fases e marcos do projeto. Itens próximos serão sugeridos como pauta." : "Plan phases and milestones. Upcoming items will be suggested as agenda."}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" />{locale === "pt" ? "Novo item" : "New item"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "pt" ? "Novo item do cronograma" : "New schedule item"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
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
              <div><Label>{locale === "pt" ? "Descrição" : "Description"}</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter><Button onClick={create}>{locale === "pt" ? "Criar" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timeline */}
      {items.length > 0 && totalMs > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div className="relative h-6 border-b text-[10px] text-muted-foreground">
              {monthMarkers.map((m, i) => (
                <div key={i} className="absolute top-0" style={{ left: `${((m.ms - startMs) / totalMs) * 100}%` }}>
                  <div className="h-2 w-px bg-border" />
                  <span className="ml-1">{m.label}</span>
                </div>
              ))}
              {todayPct >= 0 && todayPct <= 100 && (
                <div className="absolute top-0 h-full w-0.5 bg-primary" style={{ left: `${todayPct}%` }}>
                  <span className="absolute -top-4 -translate-x-1/2 text-[10px] font-semibold text-primary">{locale === "pt" ? "Hoje" : "Today"}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5 pt-2">
              {items.map((it: any) => {
                if (!it.start_date || !it.end_date) return null;
                const s = new Date(it.start_date).getTime();
                const e = new Date(it.end_date).getTime();
                const left = ((s - startMs) / totalMs) * 100;
                const width = Math.max(2, ((e - s) / totalMs) * 100);
                return (
                  <div key={it.id} className="relative h-7 group">
                    <div className={`absolute h-6 rounded-md ${STATUS_COLOR[it.status as ResearchScheduleStatus]} opacity-80 hover:opacity-100 transition-opacity flex items-center px-2`}
                      style={{ left: `${left}%`, width: `${width}%` }}>
                      <span className="text-[11px] text-white font-medium truncate">{it.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-2">
        {items.map((it: any) => (
          <Card key={it.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`w-1 self-stretch rounded-full ${STATUS_COLOR[it.status as ResearchScheduleStatus]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium">{it.title}</h4>
                  {it.phase && <Badge variant="outline" className="text-[10px]">{it.phase}</Badge>}
                </div>
                {it.description && <p className="text-sm text-muted-foreground mt-1">{it.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  {it.start_date && <span><Calendar className="h-3 w-3 inline mr-1" />{new Date(it.start_date).toLocaleDateString()}{it.end_date && ` → ${new Date(it.end_date).toLocaleDateString()}`}</span>}
                </div>
              </div>
              <Select value={it.status} onValueChange={(v: ResearchScheduleStatus) => update(it.id, { status: v })}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(SCHEDULE_STATUS_LABEL) as ResearchScheduleStatus[]).map(s =>
                  <SelectItem key={s} value={s}>{SCHEDULE_STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">{locale === "pt" ? "Nenhum item no cronograma." : "No schedule items."}</p>
        )}
      </div>
    </div>
  );
};
