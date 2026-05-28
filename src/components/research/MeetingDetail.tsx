import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Paperclip, FileText,
  Youtube, Link2, Check, Calendar, Loader2, ArrowRight, CheckSquare, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
const isYouTube = (u: string) => /youtube\.com|youtu\.be/.test(u);
const youTubeId = (u: string) => {
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1];
};

const AttachmentItem = ({ a, onRemove, projectId }: any) => {
  const { locale } = useLanguage();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const open = async () => {
    if (a.kind === "file" && a.file_path) {
      const { data } = await supabase.storage.from("research-meetings").createSignedUrl(a.file_path, 3600);
      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl);
        window.open(data.signedUrl, "_blank");
      }
    } else if (a.url) {
      window.open(a.url, "_blank");
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/50 px-3 py-2 text-sm group">
      {a.kind === "file" && <FileText className="h-4 w-4 text-primary" />}
      {a.kind === "youtube" && <Youtube className="h-4 w-4 text-red-500" />}
      {a.kind === "link" && <Link2 className="h-4 w-4 text-blue-500" />}
      <button onClick={open} className="flex-1 text-left truncate hover:underline">
        {a.file_name || a.url}
      </button>
      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onRemove(a.id, a.file_path)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
};

const AttachmentsPanel = ({ meetingId, agendaItemId, projectId }: { meetingId: string; agendaItemId: string | null; projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [] } = useQuery({
    queryKey: ["agenda-attachments", meetingId, agendaItemId],
    queryFn: async () => {
      const q = supabase.from("research_meeting_attachments")
        .select("*").eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });
      const { data, error } = agendaItemId
        ? await q.eq("agenda_item_id", agendaItemId)
        : await q.is("agenda_item_id", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${projectId}/${meetingId}/${Date.now()}-${sanitize(file.name)}`;
      const { error: upErr } = await supabase.storage.from("research-meetings").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("research_meeting_attachments").insert({
        meeting_id: meetingId, agenda_item_id: agendaItemId, kind: "file",
        file_path: path, file_name: file.name, mime_type: file.type, created_by: user!.id,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["agenda-attachments", meetingId, agendaItemId] });
      toast.success(locale === "pt" ? "Arquivo enviado" : "File uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  const addLink = async () => {
    if (!linkUrl.trim()) return;
    const kind = isYouTube(linkUrl) ? "youtube" : "link";
    const { error } = await supabase.from("research_meeting_attachments").insert({
      meeting_id: meetingId, agenda_item_id: agendaItemId, kind,
      url: linkUrl.trim(), file_name: linkUrl.trim(), created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["agenda-attachments", meetingId, agendaItemId] });
    setLinkUrl(""); setLinkOpen(false);
  };

  const remove = async (id: string, path: string | null) => {
    await supabase.from("research_meeting_attachments").delete().eq("id", id);
    if (path) await supabase.storage.from("research-meetings").remove([path]);
    qc.invalidateQueries({ queryKey: ["agenda-attachments", meetingId, agendaItemId] });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,image/*"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
          {locale === "pt" ? "Arquivo" : "File"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
          <Link2 className="h-3 w-3" />{locale === "pt" ? "Link / YouTube" : "Link / YouTube"}
        </Button>
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((a: any) => (
            <div key={a.id}>
              <AttachmentItem a={a} onRemove={remove} projectId={projectId} />
              {a.kind === "youtube" && youTubeId(a.url) && (
                <div className="mt-2 aspect-video rounded-lg overflow-hidden border max-w-md">
                  <iframe src={`https://www.youtube.com/embed/${youTubeId(a.url)}`}
                    className="w-full h-full" allowFullScreen title={a.file_name} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{locale === "pt" ? "Adicionar link" : "Add link"}</DialogTitle></DialogHeader>
          <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()} autoFocus />
          <DialogFooter><Button onClick={addLink}>{locale === "pt" ? "Adicionar" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const AgendaItemRow = ({ item, projectId, onUpdate, onRemove }: any) => {
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes || "");
  const [title, setTitle] = useState(item.title);
  const saveTimer = useRef<number | null>(null);

  const scheduleSave = (patch: Record<string, any>) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => onUpdate(item.id, patch), 800);
  };

  return (
    <Card className={`overflow-hidden transition-colors ${item.completed ? "bg-muted/30" : ""}`}>
      <div className="flex items-start gap-2 p-3">
        <button onClick={() => onUpdate(item.id, { completed: !item.completed })}
          className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"}`}>
          {item.completed && <Check className="h-3 w-3" />}
        </button>
        <button onClick={() => setOpen(!open)} className="mt-1">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <Input value={title} onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }); }}
            className={`border-0 px-0 h-7 font-medium focus-visible:ring-0 ${item.completed ? "line-through text-muted-foreground" : ""}`} />
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.source_task_id && <Badge variant="secondary" className="text-[10px]">{locale === "pt" ? "↻ Tarefa fazendo" : "↻ Task in progress"}</Badge>}
            {item.source_schedule_item_id && <Badge variant="secondary" className="text-[10px]">📅 {locale === "pt" ? "Do cronograma" : "From schedule"}</Badge>}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemove(item.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && (
        <CardContent className="pt-0 pb-3 pl-12 space-y-3">
          <Textarea placeholder={locale === "pt" ? "Anotações da discussão…" : "Discussion notes…"}
            value={notes} onChange={(e) => { setNotes(e.target.value); scheduleSave({ notes: e.target.value }); }}
            rows={3} className="text-sm" />
          <AttachmentsPanel meetingId={item.meeting_id} agendaItemId={item.id} projectId={projectId} />
        </CardContent>
      )}
    </Card>
  );
};

const FollowUpsPanel = ({ meeting, projectId, onRefresh }: any) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<{ title: string; due_date: string; priority?: string }[]>([{ title: "", due_date: "" }]);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [risks, setRisks] = useState<{ title: string; severity: string }[]>([]);
  const [decisions, setDecisions] = useState<string[]>([]);

  const { data: existing = [] } = useQuery({
    queryKey: ["meeting-followups", meeting.id],
    queryFn: async () => {
      const { data } = await supabase.from("research_tasks")
        .select("*").eq("source_meeting_id", meeting.id).order("created_at");
      return data ?? [];
    },
  });

  const suggestWithAI = async () => {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-meeting-followups", {
        body: { meeting_id: meeting.id },
      });
      if (error) throw error;
      const next = (data?.followups ?? []).map((f: any) => ({
        title: f.title || "", due_date: f.due_date || "", priority: f.priority || "medium",
      }));
      if (next.length) {
        setItems([...items.filter(i => i.title.trim()), ...next, { title: "", due_date: "" }]);
        toast.success(locale === "pt" ? `${next.length} sugestão(ões) prontas — revise e salve` : `${next.length} suggestion(s) ready — review and save`);
      } else {
        toast.info(locale === "pt" ? "Nada a sugerir ainda. Adicione notas na reunião." : "Nothing to suggest yet. Add meeting notes.");
      }
      setRisks(data?.risks ?? []);
      setDecisions(data?.decisions ?? []);
    } catch (e: any) {
      toast.error(e.message || "AI error");
    } finally {
      setSuggesting(false);
    }
  };

  const save = async () => {
    const rows = items.filter(i => i.title.trim()).map(i => ({
      project_id: projectId, created_by: user!.id,
      title: i.title.trim(), due_date: i.due_date || null,
      status: "backlog" as const, priority: (i.priority as any) || "medium",
      source_meeting_id: meeting.id,
    }));
    if (!rows.length) return;
    setSaving(true);
    const { error } = await supabase.from("research_tasks").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    setItems([{ title: "", due_date: "" }]);
    qc.invalidateQueries({ queryKey: ["meeting-followups", meeting.id] });
    qc.invalidateQueries({ queryKey: ["research-tasks", projectId] });
    toast.success(locale === "pt" ? `${rows.length} encaminhamento(s) criados como tarefas` : `${rows.length} follow-up(s) created`);
  };

  return (
    <div className="space-y-3">
      {existing.length > 0 && (
        <div className="space-y-1.5">
          {existing.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 text-sm rounded-md border bg-background/50 px-3 py-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="flex-1">{t.title}</span>
              <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
            </div>
          ))}
        </div>
      )}
      {(risks.length > 0 || decisions.length > 0) && (
        <div className="grid md:grid-cols-2 gap-2">
          {risks.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">{locale === "pt" ? "Riscos identificados (IA)" : "Risks (AI)"}</p>
              <ul className="text-xs space-y-1">{risks.map((r, i) => <li key={i}>• <span className="font-medium">[{r.severity}]</span> {r.title}</li>)}</ul>
            </div>
          )}
          {decisions.length > 0 && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1">{locale === "pt" ? "Decisões registradas (IA)" : "Decisions (AI)"}</p>
              <ul className="text-xs space-y-1">{decisions.map((d, i) => <li key={i}>• {d}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-2">
            <Input placeholder={locale === "pt" ? "Novo encaminhamento (vira tarefa A fazer)" : "New follow-up (becomes To-do task)"}
              value={it.title} onChange={(e) => { const n = [...items]; n[idx].title = e.target.value; setItems(n); }} />
            <Input type="date" className="w-40" value={it.due_date}
              onChange={(e) => { const n = [...items]; n[idx].due_date = e.target.value; setItems(n); }} />
            {idx === items.length - 1 ? (
              <Button size="icon" variant="outline" onClick={() => setItems([...items, { title: "", due_date: "" }])}><Plus className="h-4 w-4" /></Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {locale === "pt" ? "Criar como tarefas" : "Create as tasks"}
          </Button>
          <Button variant="outline" onClick={suggestWithAI} disabled={suggesting}>
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {locale === "pt" ? "Sugerir com IA" : "Suggest with AI"}
          </Button>
        </div>
      </div>
    </div>
  );
};


export const MeetingDetail = ({ meeting, projectId, onClose }: { meeting: any; projectId: string; onClose: () => void }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newAgenda, setNewAgenda] = useState("");
  const [notes, setNotes] = useState(meeting.notes || "");
  const notesTimer = useRef<number | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickedTasks, setPickedTasks] = useState<Record<string, boolean>>({});
  const [pickedSchedule, setPickedSchedule] = useState<Record<string, boolean>>({});

  const { data: agendaItems = [] } = useQuery({
    queryKey: ["agenda-items", meeting.id],
    queryFn: async () => {
      const { data } = await supabase.from("research_meeting_agenda_items")
        .select("*").eq("meeting_id", meeting.id).order("position");
      return data ?? [];
    },
  });

  const { data: doingTasks = [] } = useQuery({
    queryKey: ["research-doing-tasks", projectId],
    enabled: pickerOpen,
    queryFn: async () => {
      const { data } = await supabase.from("research_tasks")
        .select("id,title,due_date,status").eq("project_id", projectId).eq("status", "doing");
      return data ?? [];
    },
  });

  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["research-schedule-all", projectId],
    enabled: pickerOpen,
    queryFn: async () => {
      const { data } = await supabase.from("research_schedule_items")
        .select("id,title,start_date,end_date,status")
        .eq("project_id", projectId)
        .neq("status", "concluido")
        .order("start_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const existingTaskIds = new Set(agendaItems.map((a: any) => a.source_task_id).filter(Boolean));
  const existingScheduleIds = new Set(agendaItems.map((a: any) => a.source_schedule_item_id).filter(Boolean));
  const qStr = pickerSearch.toLowerCase();
  const filteredTasks = doingTasks.filter((t: any) => !existingTaskIds.has(t.id) && t.title.toLowerCase().includes(qStr));
  const filteredSchedule = scheduleItems.filter((s: any) => !existingScheduleIds.has(s.id) && s.title.toLowerCase().includes(qStr));

  const addAgenda = async () => {
    if (!newAgenda.trim()) return;
    const { error } = await supabase.from("research_meeting_agenda_items").insert({
      meeting_id: meeting.id, title: newAgenda.trim(), position: agendaItems.length,
    });
    if (error) return toast.error(error.message);
    setNewAgenda("");
    qc.invalidateQueries({ queryKey: ["agenda-items", meeting.id] });
  };
  const updateAgenda = async (id: string, patch: any) => {
    await supabase.from("research_meeting_agenda_items").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["agenda-items", meeting.id] });
  };
  const removeAgenda = async (id: string) => {
    await supabase.from("research_meeting_agenda_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["agenda-items", meeting.id] });
  };

  const importPicked = async () => {
    const rows: any[] = [];
    let pos = agendaItems.length;
    Object.entries(pickedTasks).filter(([, v]) => v).forEach(([taskId]) => {
      const t = doingTasks.find((x: any) => x.id === taskId);
      if (t) rows.push({ meeting_id: meeting.id, title: t.title, source_task_id: taskId, position: pos++ });
    });
    Object.entries(pickedSchedule).filter(([, v]) => v).forEach(([sid]) => {
      const s = scheduleItems.find((x: any) => x.id === sid);
      if (s) rows.push({ meeting_id: meeting.id, title: s.title, source_schedule_item_id: sid, position: pos++ });
    });
    if (!rows.length) { setPickerOpen(false); return; }
    const { error } = await supabase.from("research_meeting_agenda_items").insert(rows);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["agenda-items", meeting.id] });
    toast.success(locale === "pt" ? `${rows.length} ponto(s) de pauta adicionados` : `${rows.length} agenda item(s) added`);
    setPickedTasks({}); setPickedSchedule({}); setPickerSearch(""); setPickerOpen(false);
  };

  const saveNotes = (v: string) => {
    setNotes(v);
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(async () => {
      await supabase.from("research_meetings").update({ notes: v }).eq("id", meeting.id);
    }, 800);
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-2 pb-4 border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />{new Date(meeting.scheduled_at).toLocaleString()}
          {meeting.meeting_link && <> · <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary underline">{locale === "pt" ? "abrir link" : "open link"}</a></>}
        </div>
        <h2 className="text-2xl font-bold">{meeting.title}</h2>
      </header>

      <section>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{locale === "pt" ? "Notas gerais" : "General notes"}</h3>
        <Textarea value={notes} onChange={(e) => saveNotes(e.target.value)} rows={3}
          placeholder={locale === "pt" ? "Observações livres sobre a reunião…" : "Free notes about the meeting…"} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{locale === "pt" ? "Pontos de pauta" : "Agenda items"} ({agendaItems.length})</h3>
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            {locale === "pt" ? "Buscar do projeto" : "Pull from project"}
          </Button>
        </div>
        <div className="space-y-2">
          {agendaItems.map((it: any) => (
            <AgendaItemRow key={it.id} item={it} projectId={projectId}
              onUpdate={updateAgenda} onRemove={removeAgenda} />
          ))}
          <div className="flex gap-2">
            <Input placeholder={locale === "pt" ? "Novo ponto de pauta…" : "New agenda item…"}
              value={newAgenda} onChange={(e) => setNewAgenda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAgenda()} />
            <Button onClick={addAgenda}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{locale === "pt" ? "Adicionar à pauta" : "Add to agenda"}</DialogTitle>
            </DialogHeader>
            <Input placeholder={locale === "pt" ? "Buscar tarefas e itens do cronograma…" : "Search tasks and schedule items…"}
              value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} autoFocus />
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  {locale === "pt" ? "Tarefas em andamento" : "Tasks in progress"} ({filteredTasks.length})
                </p>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {filteredTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">{locale === "pt" ? "Nenhuma tarefa disponível" : "No tasks available"}</p>
                  )}
                  {filteredTasks.map((t: any) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <input type="checkbox" checked={!!pickedTasks[t.id]}
                        onChange={(e) => setPickedTasks({ ...pickedTasks, [t.id]: e.target.checked })} />
                      <span className="flex-1">{t.title}</span>
                      {t.due_date && <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString()}</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  {locale === "pt" ? "Itens do cronograma" : "Schedule items"} ({filteredSchedule.length})
                </p>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {filteredSchedule.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">{locale === "pt" ? "Nenhum item disponível" : "No items available"}</p>
                  )}
                  {filteredSchedule.map((s: any) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <input type="checkbox" checked={!!pickedSchedule[s.id]}
                        onChange={(e) => setPickedSchedule({ ...pickedSchedule, [s.id]: e.target.checked })} />
                      <span className="flex-1">{s.title}</span>
                      {s.start_date && <span className="text-xs text-muted-foreground">{new Date(s.start_date).toLocaleDateString()}</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPickerOpen(false)}>{locale === "pt" ? "Cancelar" : "Cancel"}</Button>
              <Button onClick={importPicked}>
                <Plus className="h-4 w-4" />
                {locale === "pt" ? "Adicionar à pauta" : "Add to agenda"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          {locale === "pt" ? "Encaminhamentos (geram tarefas)" : "Follow-ups (become tasks)"}
        </h3>
        <FollowUpsPanel meeting={meeting} projectId={projectId} />
      </section>

      {meeting.ata && (
        <section>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{locale === "pt" ? "Ata gerada" : "Generated minutes"}</h3>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{meeting.ata}</div>
        </section>
      )}
    </div>
  );
};

// Dialog to create a new meeting, pulling agenda from "doing" tasks + upcoming schedule items
export const NewMeetingDialog = ({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", scheduled_at: "", meeting_link: "", agenda: "" });
  const [pickedTasks, setPickedTasks] = useState<Record<string, boolean>>({});
  const [pickedSchedule, setPickedSchedule] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: doingTasks = [] } = useQuery({
    queryKey: ["research-doing-tasks", projectId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("research_tasks")
        .select("id,title,due_date").eq("project_id", projectId).eq("status", "doing");
      return data ?? [];
    },
  });

  const { data: upcomingSchedule = [] } = useQuery({
    queryKey: ["research-upcoming-schedule", projectId],
    enabled: open,
    queryFn: async () => {
      const limit = new Date(); limit.setDate(limit.getDate() + 21);
      const { data } = await supabase.from("research_schedule_items")
        .select("id,title,start_date,end_date,status")
        .eq("project_id", projectId)
        .neq("status", "concluido")
        .order("start_date", { ascending: true, nullsFirst: false });
      return (data ?? []).filter((i: any) => !i.start_date || new Date(i.start_date) <= limit);
    },
  });

  const create = async () => {
    if (!form.title || !form.scheduled_at) return toast.error(locale === "pt" ? "Título e data obrigatórios" : "Title and date required");
    setSaving(true);
    try {
      const { data: meeting, error } = await supabase.from("research_meetings").insert({
        project_id: projectId, created_by: user!.id,
        title: form.title, scheduled_at: new Date(form.scheduled_at).toISOString(),
        meeting_link: form.meeting_link || null, agenda: form.agenda || null,
      }).select().single();
      if (error) throw error;

      const items: any[] = [];
      let pos = 0;
      Object.entries(pickedTasks).filter(([, v]) => v).forEach(([taskId]) => {
        const t = doingTasks.find((x: any) => x.id === taskId);
        if (t) items.push({ meeting_id: meeting.id, title: t.title, source_task_id: taskId, position: pos++ });
      });
      Object.entries(pickedSchedule).filter(([, v]) => v).forEach(([sid]) => {
        const s = upcomingSchedule.find((x: any) => x.id === sid);
        if (s) items.push({ meeting_id: meeting.id, title: s.title, source_schedule_item_id: sid, position: pos++ });
      });
      if (form.agenda?.trim()) {
        form.agenda.split("\n").map(l => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean).forEach(l => {
          items.push({ meeting_id: meeting.id, title: l, position: pos++ });
        });
      }
      if (items.length) await supabase.from("research_meeting_agenda_items").insert(items);

      qc.invalidateQueries({ queryKey: ["research-meetings", projectId] });
      toast.success(locale === "pt" ? "Reunião agendada" : "Meeting scheduled");
      onOpenChange(false);
      setForm({ title: "", scheduled_at: "", meeting_link: "", agenda: "" });
      setPickedTasks({}); setPickedSchedule({});
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{locale === "pt" ? "Nova reunião" : "New meeting"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>{locale === "pt" ? "Título" : "Title"}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>{locale === "pt" ? "Data e hora" : "Date & time"}</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
            <div><Label>{locale === "pt" ? "Link (Meet/Zoom)" : "Link"}</Label>
              <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} /></div>
          </div>

          {doingTasks.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" />
                {locale === "pt" ? "Tarefas em andamento (vire em pauta)" : "Tasks in progress (add as agenda)"}</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {doingTasks.map((t: any) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                    <input type="checkbox" checked={!!pickedTasks[t.id]} onChange={(e) => setPickedTasks({ ...pickedTasks, [t.id]: e.target.checked })} />
                    <span className="flex-1">{t.title}</span>
                    {t.due_date && <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString()}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {upcomingSchedule.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" />
                {locale === "pt" ? "Itens próximos do cronograma" : "Upcoming schedule items"}</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {upcomingSchedule.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                    <input type="checkbox" checked={!!pickedSchedule[s.id]} onChange={(e) => setPickedSchedule({ ...pickedSchedule, [s.id]: e.target.checked })} />
                    <span className="flex-1">{s.title}</span>
                    {s.start_date && <span className="text-xs text-muted-foreground">{new Date(s.start_date).toLocaleDateString()}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>{locale === "pt" ? "Pauta livre (uma por linha)" : "Free agenda (one per line)"}</Label>
            <Textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {locale === "pt" ? "Agendar" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
