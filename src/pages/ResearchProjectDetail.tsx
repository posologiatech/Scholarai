import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ProjectSubNav, useProjectSubNavState, ALL_TAB_IDS, type TabId } from "@/components/research/ProjectSubNav";
import { Sheet as MobileSheet, SheetContent as MobileSheetContent, SheetTrigger as MobileSheetTrigger } from "@/components/ui/sheet";
import { PanelLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useResearchProject, useUpdateResearchProject } from "@/hooks/useResearchProjects";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Plus, Trash2, Calendar, Users2, FileText, BookOpen, Lightbulb, Mic, GraduationCap, CheckSquare, Send, Sparkles, CalendarRange, ChevronRight, FileSignature, Wallet, ShieldCheck, NotebookPen, RefreshCw, ExternalLink, Award, AlertTriangle, Activity, Globe, UserCheck, Package, Link2, MoreVertical, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import IntegrationsTab from "@/components/research/IntegrationsTab";
import ExportProjectMenu from "@/components/research/ExportProjectMenu";
import { useLanguage } from "@/i18n/LanguageContext";
import { STATUS_LABEL, ROLE_LABEL, TASK_STATUS_LABEL, PUB_STATUS_LABEL, type ResearchTaskStatus, type ResearchPublicationStatus, type ResearchMemberRole, type ResearchAdviseeLevel } from "@/lib/research/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { ProjectBodyEditor } from "@/components/research/ProjectBodyEditor";
import { MeetingDetail, NewMeetingDialog } from "@/components/research/MeetingDetail";
import { ScheduleTab } from "@/components/research/ScheduleTab";
import { AdviseePhotoUpload } from "@/components/research/AdviseePhotoUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";
import { ResearchCopilot } from "@/components/research/ResearchCopilot";
import { CommentThread } from "@/components/research/CommentThread";
import DocumentsTab from "@/components/research/DocumentsTab";
import BudgetTab from "@/components/research/BudgetTab";
import EthicsTab from "@/components/research/EthicsTab";
import LogbookTab from "@/components/research/LogbookTab";
import PresentationMode from "@/components/research/PresentationMode";
import EvaluationsTab from "@/components/research/EvaluationsTab";
import RisksTab from "@/components/research/RisksTab";
import ComplianceTab from "@/components/research/ComplianceTab";
import ActivityHeatmap from "@/components/research/ActivityHeatmap";
import PublicShareCard from "@/components/research/PublicShareCard";
import CreditAuthorshipTab from "@/components/research/CreditAuthorshipTab";
import OutputsTab from "@/components/research/OutputsTab";
import TasksBoard from "@/components/research/TasksBoard";
import FavoritesTab from "@/components/research/FavoritesTab";
import DefenseTab from "@/components/research/DefenseTab";
import NotificationsBell from "@/components/research/NotificationsBell";
import ConnectionsTab from "@/components/research/ConnectionsTab";

// ===== Tab: Equipe =====
const TeamTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invited_email: "", full_name: "", role: "colaborador" as ResearchMemberRole });

  const { data: members = [] } = useQuery({
    queryKey: ["research-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_project_members")
        .select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Directory of previously-added members across all accessible projects (RLS-scoped)
  const { data: directory = [] } = useQuery({
    queryKey: ["research-members-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_project_members")
        .select("invited_email, full_name, role")
        .not("invited_email", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const seen = new Set<string>();
      const out: { invited_email: string; full_name: string | null; role: string | null }[] = [];
      for (const r of (data ?? []) as any[]) {
        const key = (r.invited_email || "").toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(r);
      }
      return out;
    },
  });

  const emailQuery = form.invited_email.trim().toLowerCase();
  const suggestions = emailQuery.length >= 1
    ? directory.filter(d => d.invited_email!.toLowerCase().includes(emailQuery)).slice(0, 6)
    : [];

  const pickSuggestion = (s: { invited_email: string; full_name: string | null; role: string | null }) => {
    setForm(f => ({
      ...f,
      invited_email: s.invited_email,
      full_name: s.full_name || f.full_name,
      role: (s.role as ResearchMemberRole) || f.role,
    }));
  };

  const addMember = async () => {
    if (!form.invited_email && !form.full_name) return toast.error(locale === "pt" ? "Informe email ou nome" : "Provide email or name");
    const { error } = await supabase.from("research_project_members").insert({
      project_id: projectId,
      invited_email: form.invited_email || null,
      full_name: form.full_name || null,
      role: form.role,
      accepted: false,
    });
    if (error) return toast.error(error.message);
    toast.success(locale === "pt" ? "Membro adicionado" : "Member added");
    qc.invalidateQueries({ queryKey: ["research-members", projectId] });
    qc.invalidateQueries({ queryKey: ["research-members-directory"] });
    setOpen(false); setForm({ invited_email: "", full_name: "", role: "colaborador" });
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("research_project_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["research-members", projectId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Adicionar membro" : "Add member"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "pt" ? "Adicionar membro" : "Add member"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{locale === "pt" ? "Nome completo" : "Full name"}</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="relative"><Label>Email</Label>
                <Input
                  type="email"
                  autoComplete="off"
                  list="research-members-emails"
                  value={form.invited_email}
                  onChange={e => setForm({ ...form, invited_email: e.target.value })}
                />
                <datalist id="research-members-emails">
                  {directory.map(d => (
                    <option key={d.invited_email!} value={d.invited_email!}>{d.full_name || ""}</option>
                  ))}
                </datalist>
                {suggestions.length > 0 && (
                  <div className="mt-1 rounded-md border bg-popover shadow-sm max-h-48 overflow-y-auto">
                    {suggestions.map(s => (
                      <button
                        key={s.invited_email!}
                        type="button"
                        onClick={() => pickSuggestion(s)}
                        className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors"
                      >
                        <div className="text-sm font-medium">{s.invited_email}</div>
                        {s.full_name && <div className="text-xs text-muted-foreground">{s.full_name}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><Label>{locale === "pt" ? "Papel" : "Role"}</Label>
                <Select value={form.role} onValueChange={(v: ResearchMemberRole) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(ROLE_LABEL) as ResearchMemberRole[]).map(r =>
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r][locale]}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <DialogFooter><Button onClick={addMember}>{locale === "pt" ? "Adicionar" : "Add"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {members.map((m: any) => (
          <Card key={m.id}><CardContent className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{m.full_name || m.invited_email || "—"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{ROLE_LABEL[m.role as ResearchMemberRole][locale]}</Badge>
                {m.invited_email && <span>{m.invited_email}</span>}
                {!m.accepted && <Badge variant="outline">{locale === "pt" ? "Convidado" : "Invited"}</Badge>}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardContent></Card>
        ))}
        {members.length === 0 && <p className="text-sm text-muted-foreground">{locale === "pt" ? "Sem membros ainda." : "No members yet."}</p>}
      </div>
    </div>
  );
};

// ===== Tab: References =====
const RefsTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", authors: "", year: "", doi: "", notes: "" });

  const { data: refs = [] } = useQuery({
    queryKey: ["research-refs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_project_references")
        .select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Import from saved_searches
  const { data: savedSearches = [] } = useQuery({
    queryKey: ["my-saved-searches"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("saved_searches").select("id, query, papers").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const addManual = async () => {
    if (!form.title) return toast.error(locale === "pt" ? "Título obrigatório" : "Title required");
    const { error } = await supabase.from("research_project_references").insert({
      project_id: projectId, added_by: user!.id,
      title: form.title,
      authors: form.authors.split(",").map(a => ({ name: a.trim() })).filter(a => a.name),
      year: form.year ? parseInt(form.year) : null,
      doi: form.doi || null,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["research-refs", projectId] });
    setOpen(false); setForm({ title: "", authors: "", year: "", doi: "", notes: "" });
  };

  const importFromSearch = async (searchId: string) => {
    const search = savedSearches.find((s: any) => s.id === searchId);
    if (!search || !Array.isArray(search.papers)) return;
    const rows = search.papers.slice(0, 50).map((p: any) => ({
      project_id: projectId, added_by: user!.id,
      title: p.title || "Untitled",
      authors: p.authors || [],
      year: p.year || null,
      doi: p.doi || null,
      external_paper_id: p.id || null,
    }));
    const { error } = await supabase.from("research_project_references").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(locale === "pt" ? `${rows.length} referências importadas` : `${rows.length} references imported`);
    qc.invalidateQueries({ queryKey: ["research-refs", projectId] });
    setOpen(false);
  };

  const removeRef = async (id: string) => {
    await supabase.from("research_project_references").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-refs", projectId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Adicionar referência" : "Add reference"}</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{locale === "pt" ? "Adicionar referência" : "Add reference"}</DialogTitle></DialogHeader>
            <Tabs defaultValue="manual">
              <TabsList><TabsTrigger value="manual">{locale === "pt" ? "Manual" : "Manual"}</TabsTrigger>
                <TabsTrigger value="search">{locale === "pt" ? "Importar de busca salva" : "Import saved search"}</TabsTrigger></TabsList>
              <TabsContent value="manual" className="space-y-3">
                <div><Label>{locale === "pt" ? "Título *" : "Title *"}</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>{locale === "pt" ? "Autores (vírgula)" : "Authors (comma)"}</Label>
                    <Input value={form.authors} onChange={e => setForm({ ...form, authors: e.target.value })} /></div>
                  <div><Label>{locale === "pt" ? "Ano" : "Year"}</Label>
                    <Input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
                </div>
                <div><Label>DOI</Label><Input value={form.doi} onChange={e => setForm({ ...form, doi: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Notas" : "Notes"}</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                <Button onClick={addManual} className="w-full">{locale === "pt" ? "Adicionar" : "Add"}</Button>
              </TabsContent>
              <TabsContent value="search" className="space-y-2 max-h-96 overflow-y-auto">
                {savedSearches.length === 0 && <p className="text-sm text-muted-foreground">{locale === "pt" ? "Nenhuma busca salva." : "No saved searches."}</p>}
                {savedSearches.map((s: any) => (
                  <Card key={s.id}><CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{s.query}</p>
                      <p className="text-xs text-muted-foreground">{Array.isArray(s.papers) ? s.papers.length : 0} {locale === "pt" ? "artigos" : "papers"}</p>
                    </div>
                    <Button size="sm" onClick={() => importFromSearch(s.id)}>{locale === "pt" ? "Importar" : "Import"}</Button>
                  </CardContent></Card>
                ))}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {refs.map((r: any) => (
          <Card key={r.id}><CardContent className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {Array.isArray(r.authors) ? r.authors.map((a: any) => a.name || a).slice(0, 3).join(", ") : ""}
                {r.year && ` · ${r.year}`}{r.doi && ` · ${r.doi}`}
              </p>
              {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => removeRef(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardContent></Card>
        ))}
        {refs.length === 0 && <p className="text-sm text-muted-foreground">{locale === "pt" ? "Sem referências." : "No references."}</p>}
      </div>
    </div>
  );
};
// ===== Tab: Tasks (modern Kanban board) =====
const TasksTab = ({ projectId }: { projectId: string }) => <TasksBoard projectId={projectId} />;

// ===== Tab: Meetings =====
type MeetingStatus = "ativa" | "concluida" | "cancelada";
const MEETING_STATUS_LABEL: Record<MeetingStatus, { pt: string; en: string }> = {
  ativa: { pt: "Ativa", en: "Active" },
  concluida: { pt: "Concluída", en: "Completed" },
  cancelada: { pt: "Cancelada", en: "Cancelled" },
};

const MeetingsTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [statusTab, setStatusTab] = useState<MeetingStatus>("ativa");

  const { data: meetings = [] } = useQuery({
    queryKey: ["research-meetings", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_meetings")
        .select("*, agenda_items:research_meeting_agenda_items(id,completed), attachments:research_meeting_attachments(id)")
        .eq("project_id", projectId).order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    await supabase.from("research_meetings").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-meetings", projectId] });
  };

  const setStatus = async (id: string, status: MeetingStatus) => {
    await supabase.from("research_meetings").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-meetings", projectId] });
  };

  const counts: Record<MeetingStatus, number> = { ativa: 0, concluida: 0, cancelada: 0 };
  meetings.forEach((m: any) => {
    const s = (m.status ?? "ativa") as MeetingStatus;
    if (counts[s] !== undefined) counts[s] += 1;
  });
  const filtered = meetings.filter((m: any) => ((m.status ?? "ativa") as MeetingStatus) === statusTab);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{locale === "pt" ? "Clique em uma reunião para abrir pautas, anotações e encaminhamentos." : "Click a meeting to open agenda, notes and follow-ups."}</p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{locale === "pt" ? "Nova reunião" : "New meeting"}</Button>
      </div>

      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as MeetingStatus)}>
        <TabsList>
          <TabsTrigger value="ativa">{locale === "pt" ? "Ativas" : "Active"}<Badge variant="secondary" className="ml-2">{counts.ativa}</Badge></TabsTrigger>
          <TabsTrigger value="concluida">{locale === "pt" ? "Concluídas" : "Completed"}<Badge variant="secondary" className="ml-2">{counts.concluida}</Badge></TabsTrigger>
          <TabsTrigger value="cancelada">{locale === "pt" ? "Canceladas" : "Cancelled"}<Badge variant="secondary" className="ml-2">{counts.cancelada}</Badge></TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((m: any) => {
          const status = (m.status ?? "ativa") as MeetingStatus;
          const total = m.agenda_items?.length ?? 0;
          const done = m.agenda_items?.filter((a: any) => a.completed).length ?? 0;
          const accent = status === "concluida" ? "bg-emerald-500" : status === "cancelada" ? "bg-destructive" : "bg-blue-500";
          return (
            <div key={m.id} className="group text-left rounded-2xl border bg-card hover:shadow-md hover:border-primary/40 transition-all p-4 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${accent}`} />
              <button onClick={() => setSelected(m)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate">{m.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{new Date(m.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <Badge variant="outline" className="text-[10px]">{MEETING_STATUS_LABEL[status][locale]}</Badge>
                  {total > 0 && <span className="text-muted-foreground">{done}/{total} {locale === "pt" ? "pautas" : "items"}</span>}
                  {m.attachments?.length > 0 && <span className="text-muted-foreground">· {m.attachments.length} {locale === "pt" ? "anexos" : "files"}</span>}
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{locale === "pt" ? "Alterar status" : "Change status"}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setStatus(m.id, "ativa")}>
                    <PlayCircle className="h-4 w-4 text-blue-500" />{locale === "pt" ? "Marcar como ativa" : "Mark active"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatus(m.id, "concluida")}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />{locale === "pt" ? "Marcar como concluída" : "Mark completed"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatus(m.id, "cancelada")}>
                    <XCircle className="h-4 w-4 text-amber-500" />{locale === "pt" ? "Marcar como cancelada" : "Mark cancelled"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive"
                    onClick={() => { if (confirm(locale === "pt" ? "Excluir reunião?" : "Delete meeting?")) remove(m.id); }}>
                    <Trash2 className="h-4 w-4" />{locale === "pt" ? "Excluir reunião" : "Delete meeting"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-12">{locale === "pt" ? "Nenhuma reunião nesta aba." : "No meetings in this tab."}</p>}
      </div>

      <NewMeetingDialog projectId={projectId} open={open} onOpenChange={setOpen} />
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && <MeetingDetail meeting={selected} projectId={projectId} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};



// ===== Tab: Advisees =====
const AdviseesTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", registration_number: "", whatsapp: "", photo_url: "", level: "mestrado" as ResearchAdviseeLevel, thesis_title: "", start_date: "", expected_defense_date: "" });

  const { data: advisees = [] } = useQuery({
    queryKey: ["research-advisees", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_advisees")
        .select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = async () => {
    if (!form.full_name) return toast.error(locale === "pt" ? "Nome obrigatório" : "Name required");
    const { error } = await supabase.from("research_advisees").insert({
      project_id: projectId, advisor_id: user!.id,
      full_name: form.full_name, email: form.email || null,
      registration_number: form.registration_number || null,
      whatsapp: form.whatsapp || null,
      photo_url: form.photo_url || null,
      level: form.level, thesis_title: form.thesis_title || null,
      start_date: form.start_date || null,
      expected_defense_date: form.expected_defense_date || null,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["research-advisees", projectId] });
    setOpen(false);
    setForm({ full_name: "", email: "", registration_number: "", whatsapp: "", photo_url: "", level: "mestrado", thesis_title: "", start_date: "", expected_defense_date: "" });
  };

  const remove = async (id: string) => {
    await supabase.from("research_advisees").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-advisees", projectId] });
  };

  const levelLabel: Record<ResearchAdviseeLevel, string> = locale === "pt"
    ? { ic: "IC", mestrado: "Mestrado", doutorado: "Doutorado", posdoc: "Pós-doc", tcc: "TCC", especializacao: "Especialização" }
    : { ic: "UG Research", mestrado: "Master's", doutorado: "PhD", posdoc: "Postdoc", tcc: "Thesis", especializacao: "Specialization" };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Novo orientando" : "New advisee"}</Button></DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{locale === "pt" ? "Novo orientando" : "New advisee"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{locale === "pt" ? "Foto" : "Photo"}</Label>
                <AdviseePhotoUpload value={form.photo_url} onChange={url => setForm({ ...form, photo_url: url })} /></div>
              <div><Label>{locale === "pt" ? "Nome completo" : "Full name"}</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{locale === "pt" ? "Matrícula" : "Registration"}</Label>
                  <Input value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} /></div>
                <div><Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(00) 00000-0000" /></div>
              </div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>{locale === "pt" ? "Nível" : "Level"}</Label>
                <Select value={form.level} onValueChange={(v: ResearchAdviseeLevel) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(levelLabel) as ResearchAdviseeLevel[]).map(l => <SelectItem key={l} value={l}>{levelLabel[l]}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>{locale === "pt" ? "Tema/Tese" : "Thesis topic"}</Label>
                <Input value={form.thesis_title} onChange={e => setForm({ ...form, thesis_title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{locale === "pt" ? "Início" : "Start"}</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Defesa prevista" : "Expected defense"}</Label>
                  <Input type="date" value={form.expected_defense_date} onChange={e => setForm({ ...form, expected_defense_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={add}>{locale === "pt" ? "Adicionar" : "Add"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {advisees.map((a: any) => (
          <AdviseeCard key={a.id} advisee={a} levelLabel={levelLabel} locale={locale} onRemove={remove} />
        ))}
        {advisees.length === 0 && <p className="text-sm text-muted-foreground">{locale === "pt" ? "Sem orientandos." : "No advisees."}</p>}
      </div>
    </div>
  );
};

const AdviseeCard = ({ advisee, levelLabel, locale, onRemove }: any) => {
  const qc = useQueryClient();
  const [showMilestones, setShowMilestones] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    full_name: advisee.full_name || "", email: advisee.email || "",
    registration_number: advisee.registration_number || "", whatsapp: advisee.whatsapp || "",
    photo_url: advisee.photo_url || "", level: advisee.level,
    thesis_title: advisee.thesis_title || "", start_date: advisee.start_date || "",
    expected_defense_date: advisee.expected_defense_date || "",
  });
  const openEdit = () => {
    setEdit({
      full_name: advisee.full_name || "", email: advisee.email || "",
      registration_number: advisee.registration_number || "", whatsapp: advisee.whatsapp || "",
      photo_url: advisee.photo_url || "", level: advisee.level,
      thesis_title: advisee.thesis_title || "", start_date: advisee.start_date || "",
      expected_defense_date: advisee.expected_defense_date || "",
    });
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!edit.full_name) return toast.error(locale === "pt" ? "Nome obrigatório" : "Name required");
    const { error } = await supabase.from("research_advisees").update({
      full_name: edit.full_name, email: edit.email || null, level: edit.level,
      registration_number: edit.registration_number || null, whatsapp: edit.whatsapp || null,
      photo_url: edit.photo_url || null,
      thesis_title: edit.thesis_title || null, start_date: edit.start_date || null,
      expected_defense_date: edit.expected_defense_date || null,
    }).eq("id", advisee.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["research-advisees", advisee.project_id] });
    setEditing(false);
  };
  const [msForm, setMsForm] = useState({ title: "", due_date: "" });
  const { data: milestones = [] } = useQuery({
    queryKey: ["advisee-milestones", advisee.id],
    enabled: showMilestones,
    queryFn: async () => {
      const { data } = await supabase.from("research_advisee_milestones")
        .select("*").eq("advisee_id", advisee.id).order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });
  const addMs = async () => {
    if (!msForm.title) return;
    await supabase.from("research_advisee_milestones").insert({
      advisee_id: advisee.id, title: msForm.title, due_date: msForm.due_date || null,
    });
    qc.invalidateQueries({ queryKey: ["advisee-milestones", advisee.id] });
    setMsForm({ title: "", due_date: "" });
  };
  const toggleMs = async (id: string, status: string) => {
    await supabase.from("research_advisee_milestones").update({
      status: status === "done" ? "pending" : "done",
      completed_at: status === "done" ? null : new Date().toISOString(),
    }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["advisee-milestones", advisee.id] });
  };
  const removeMs = async (id: string) => {
    await supabase.from("research_advisee_milestones").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["advisee-milestones", advisee.id] });
  };
  const daysLeft = advisee.expected_defense_date
    ? Math.ceil((new Date(advisee.expected_defense_date).getTime() - Date.now()) / 86400000) : null;
  return (
    <Card className="transition-all hover:border-primary/40 hover:shadow-sm"><CardContent className="py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <button onClick={openEdit} className="text-left flex-1 min-w-0 cursor-pointer flex gap-3 items-start">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={advisee.photo_url || undefined} alt={advisee.full_name} />
            <AvatarFallback><UserIcon className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium">{advisee.full_name} <Badge variant="secondary" className="ml-2">{levelLabel[advisee.level]}</Badge></p>
            {advisee.thesis_title && <p className="text-sm text-muted-foreground">{advisee.thesis_title}</p>}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
              {advisee.registration_number && <span>{locale === "pt" ? "Matrícula:" : "ID:"} {advisee.registration_number}</span>}
              {advisee.whatsapp && <span>WhatsApp: {advisee.whatsapp}</span>}
              {advisee.email && <span>{advisee.email}</span>}
              {advisee.start_date && <span>{locale === "pt" ? "Início:" : "Start:"} {new Date(advisee.start_date).toLocaleDateString()}</span>}
              {advisee.expected_defense_date && (
                <Badge variant={daysLeft !== null && daysLeft < 30 ? "destructive" : "outline"}>
                  {locale === "pt" ? "Defesa:" : "Defense:"} {new Date(advisee.expected_defense_date).toLocaleDateString()}
                  {daysLeft !== null && ` (${daysLeft}d)`}
                </Badge>
              )}
            </div>
          </div>
        </button>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setShowMilestones(!showMilestones)}>{locale === "pt" ? "Marcos" : "Milestones"}</Button>
          <Button size="icon" variant="ghost" onClick={() => onRemove(advisee.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{locale === "pt" ? "Editar orientando" : "Edit advisee"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{locale === "pt" ? "Foto" : "Photo"}</Label>
              <AdviseePhotoUpload value={edit.photo_url} onChange={url => setEdit({ ...edit, photo_url: url })} /></div>
            <div><Label>{locale === "pt" ? "Nome completo" : "Full name"}</Label>
              <Input value={edit.full_name} onChange={e => setEdit({ ...edit, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{locale === "pt" ? "Matrícula" : "Registration"}</Label>
                <Input value={edit.registration_number} onChange={e => setEdit({ ...edit, registration_number: e.target.value })} /></div>
              <div><Label>WhatsApp</Label>
                <Input value={edit.whatsapp} onChange={e => setEdit({ ...edit, whatsapp: e.target.value })} placeholder="(00) 00000-0000" /></div>
            </div>
            <div><Label>Email</Label><Input value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></div>
            <div><Label>{locale === "pt" ? "Nível" : "Level"}</Label>
              <Select value={edit.level} onValueChange={(v: ResearchAdviseeLevel) => setEdit({ ...edit, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(levelLabel) as ResearchAdviseeLevel[]).map(l => <SelectItem key={l} value={l}>{levelLabel[l]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>{locale === "pt" ? "Tema/Tese" : "Thesis topic"}</Label>
              <Input value={edit.thesis_title} onChange={e => setEdit({ ...edit, thesis_title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{locale === "pt" ? "Início" : "Start"}</Label>
                <Input type="date" value={edit.start_date} onChange={e => setEdit({ ...edit, start_date: e.target.value })} /></div>
              <div><Label>{locale === "pt" ? "Defesa prevista" : "Expected defense"}</Label>
                <Input type="date" value={edit.expected_defense_date} onChange={e => setEdit({ ...edit, expected_defense_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveEdit}>{locale === "pt" ? "Salvar" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {showMilestones && (
        <div className="border-t pt-3 mt-2 space-y-2">
          <div className="flex gap-2">
            <Input placeholder={locale === "pt" ? "Ex.: Qualificação" : "e.g. Qualifying exam"} value={msForm.title} onChange={e => setMsForm({ ...msForm, title: e.target.value })} className="h-8" />
            <Input type="date" value={msForm.due_date} onChange={e => setMsForm({ ...msForm, due_date: e.target.value })} className="h-8 w-40" />
            <Button size="sm" onClick={addMs}><Plus className="h-3 w-3" /></Button>
          </div>
          {milestones.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between text-sm py-1">
              <button onClick={() => toggleMs(m.id, m.status)} className="flex items-center gap-2 text-left">
                <CheckSquare className={`h-4 w-4 ${m.status === "done" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={m.status === "done" ? "line-through text-muted-foreground" : ""}>{m.title}</span>
                {m.due_date && <span className="text-xs text-muted-foreground">({new Date(m.due_date).toLocaleDateString()})</span>}
              </button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeMs(m.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
};

// ===== Tab: Publications =====
const PublicationsTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", target_journal: "", status: "ideia" as ResearchPublicationStatus });

  const { data: pubs = [] } = useQuery({
    queryKey: ["research-pubs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_publications")
        .select("*").eq("project_id", projectId).order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const cols: Record<ResearchPublicationStatus, any[]> = {
      ideia: [], escrevendo: [], submetido: [], em_revisao: [], aceito: [], publicado: [], rejeitado: [],
    };
    pubs.forEach((p: any) => cols[p.status as ResearchPublicationStatus]?.push(p));
    return cols;
  }, [pubs]);

  const add = async () => {
    if (!form.title) return;
    await supabase.from("research_publications").insert({
      project_id: projectId, created_by: user!.id,
      title: form.title, target_journal: form.target_journal || null, status: form.status,
    });
    qc.invalidateQueries({ queryKey: ["research-pubs", projectId] });
    setOpen(false); setForm({ title: "", target_journal: "", status: "ideia" });
  };

  const move = async (id: string, status: ResearchPublicationStatus) => {
    await supabase.from("research_publications").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-pubs", projectId] });
  };

  const remove = async (id: string) => {
    await supabase.from("research_publications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-pubs", projectId] });
  };

  const enrich = async (p: any) => {
    if (!p.doi) return toast.error(locale === "pt" ? "Adicione um DOI primeiro" : "Add a DOI first");
    toast.loading(locale === "pt" ? "Buscando métricas..." : "Fetching metrics...", { id: `enr-${p.id}` });
    const { error } = await supabase.functions.invoke("research-enrich-publication", {
      body: { publication_id: p.id, doi: p.doi },
    });
    toast.dismiss(`enr-${p.id}`);
    if (error) return toast.error(error.message);
    toast.success(locale === "pt" ? "Atualizado" : "Updated");
    qc.invalidateQueries({ queryKey: ["research-pubs", projectId] });
  };

  const statuses: ResearchPublicationStatus[] = ["ideia", "escrevendo", "submetido", "em_revisao", "aceito", "publicado"];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Nova publicação" : "New publication"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "pt" ? "Nova publicação" : "New publication"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{locale === "pt" ? "Título" : "Title"}</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>{locale === "pt" ? "Revista-alvo" : "Target journal"}</Label>
                <Input value={form.target_journal} onChange={e => setForm({ ...form, target_journal: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v: ResearchPublicationStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{PUB_STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <DialogFooter><Button onClick={add}>{locale === "pt" ? "Criar" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statuses.map(st => (
          <div key={st} className="bg-muted/30 rounded-lg p-2">
            <h4 className="text-[10px] font-semibold uppercase mb-2 text-muted-foreground">{PUB_STATUS_LABEL[st][locale]} ({grouped[st].length})</h4>
            <div className="space-y-2">
              {grouped[st].map((p: any) => (
                <Card key={p.id}><CardContent className="p-2 space-y-1">
                  <p className="text-xs font-medium line-clamp-3">{p.title}</p>
                  {p.target_journal && <p className="text-[10px] text-muted-foreground">{p.target_journal}</p>}
                  {(p.citations_count > 0 || p.altmetric_score) && (
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      {p.citations_count > 0 && <span>📚 {p.citations_count}</span>}
                      {p.altmetric_score && <span className="text-orange-600">🌐 {Number(p.altmetric_score).toFixed(0)}</span>}
                    </div>
                  )}
                  <div className="flex gap-1 pt-1">
                    <Select value={p.status} onValueChange={(v: any) => move(p.id, v)}>
                      <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{PUB_STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
                    </Select>
                    {p.doi && <Button size="icon" variant="ghost" className="h-6 w-6" title={locale === "pt" ? "Atualizar métricas" : "Refresh metrics"} onClick={() => enrich(p)}><RefreshCw className="h-3 w-3" /></Button>}
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  <Button asChild size="sm" variant="link" className="h-auto p-0 text-[10px]">
                    <Link to="/writing">{locale === "pt" ? "Abrir no editor" : "Open in editor"}</Link>
                  </Button>
                </CardContent></Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===== Tab: Brainstorm =====
const BrainstormTab = ({ projectId, projectTitle }: { projectId: string; projectTitle: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: ideas = [] } = useQuery({
    queryKey: ["research-ideas", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_ideas")
        .select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput(""); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-brainstorm", {
        body: {
          project_id: projectId, project_title: projectTitle,
          messages: [...messages, { role: "user", content: userMsg }],
          locale,
        },
      });
      if (error) throw error;
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const saveIdea = async (content: string) => {
    const title = content.split("\n")[0].replace(/^#+\s*/, "").slice(0, 120);
    await supabase.from("research_ideas").insert({
      project_id: projectId, created_by: user!.id,
      title, description: content, ai_generated: true,
    });
    qc.invalidateQueries({ queryKey: ["research-ideas", projectId] });
    toast.success(locale === "pt" ? "Ideia salva" : "Idea saved");
  };

  const removeIdea = async (id: string) => {
    await supabase.from("research_ideas").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-ideas", projectId] });
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />{locale === "pt" ? "Chat de Brainstorm IA" : "AI Brainstorm Chat"}</CardTitle></CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {locale === "pt"
                ? "Pergunte por derivações, hipóteses, métodos ou novos ângulos para este projeto."
                : "Ask for derivations, hypotheses, methods or new angles for this project."}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`${m.role === "user" ? "ml-auto bg-primary/10" : "bg-muted"} rounded-lg p-3 max-w-[90%] text-sm prose prose-sm dark:prose-invert`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
              {m.role === "assistant" && (
                <Button size="sm" variant="ghost" className="mt-2 h-6 text-xs" onClick={() => saveIdea(m.content)}>
                  <Lightbulb className="h-3 w-3" />{locale === "pt" ? "Salvar como ideia" : "Save as idea"}
                </Button>
              )}
            </div>
          ))}
          {loading && <p className="text-xs text-muted-foreground">{locale === "pt" ? "Pensando..." : "Thinking..."}</p>}
        </CardContent>
        <div className="border-t p-3 flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={locale === "pt" ? "Ex.: Quais experimentos derivados...?" : "e.g. Which follow-up experiments...?"} />
          <Button onClick={send} disabled={loading}><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />{locale === "pt" ? "Ideias salvas" : "Saved ideas"}</CardTitle></CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2">
          {ideas.length === 0 && <p className="text-sm text-muted-foreground">{locale === "pt" ? "Salve ideias do chat aqui." : "Save ideas from chat here."}</p>}
          {ideas.map((i: any) => (
            <Card key={i.id}><CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{i.title}</p>
                  {i.ai_generated && <Badge variant="secondary" className="text-[10px] mt-1">IA</Badge>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeIdea(i.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              {i.description && <div className="text-xs text-muted-foreground line-clamp-3 mt-2 prose prose-xs dark:prose-invert max-w-none">
                <ReactMarkdown>{i.description}</ReactMarkdown></div>}
            </CardContent></Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// ===== Overview =====
const OverviewTab = ({ project }: { project: any }) => {
  const { locale } = useLanguage();
  const projectId = project.id;
  const { data: tasks = [] } = useQuery({
    queryKey: ["research-tasks-overview", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_tasks").select("status").eq("project_id", projectId);
      return data ?? [];
    },
  });
  const { data: meetings = [] } = useQuery({
    queryKey: ["research-meetings-overview", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_meetings").select("id,title,scheduled_at").eq("project_id", projectId)
        .gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(5);
      return data ?? [];
    },
  });
  const counts = {
    backlog: tasks.filter((t: any) => t.status === "backlog").length,
    doing: tasks.filter((t: any) => t.status === "doing").length,
    done: tasks.filter((t: any) => t.status === "done").length,
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">{locale === "pt" ? "A fazer" : "To do"}</p><p className="text-2xl font-bold">{counts.backlog}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">{locale === "pt" ? "Fazendo" : "Doing"}</p><p className="text-2xl font-bold">{counts.doing}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">{locale === "pt" ? "Concluídas" : "Done"}</p><p className="text-2xl font-bold">{counts.done}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">{locale === "pt" ? "Próx. reuniões" : "Upcoming"}</p><p className="text-2xl font-bold">{meetings.length}</p></CardContent></Card>
      </div>

      <ProjectBodyEditor projectId={projectId} initial={project.full_content} />

      {meetings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{locale === "pt" ? "Próximas reuniões" : "Upcoming meetings"}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {meetings.map((m: any) => (
              <div key={m.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                <span>{m.title}</span>
                <span className="text-muted-foreground">{new Date(m.scheduled_at).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <PublicShareCard project={project} />

      <CommentThread projectId={projectId} entityType="project" entityId={projectId} />
    </div>
  );
};

// ===== Page =====
const Inner = () => {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const { data: project, isLoading } = useResearchProject(id);
  const updateMut = useUpdateResearchProject();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", status: "planejamento" as any });

  const { data: myRole } = useQuery({
    queryKey: ["my-research-role", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("research_project_members")
        .select("role").eq("project_id", id!).eq("user_id", user!.id).maybeSingle();
      return data?.role ?? null;
    },
  });
  const isManager = !!project && (project.owner_id === user?.id || myRole === "pi" || myRole === "co_pi");

  useEffect(() => {
    if (project) setEditForm({ title: project.title, description: project.description || "", status: project.status });
  }, [project]);

  if (isLoading) return <div className="p-8">{locale === "pt" ? "Carregando..." : "Loading..."}</div>;
  if (!project) return <div className="p-8">{locale === "pt" ? "Projeto não encontrado." : "Project not found."}</div>;

  const save = async () => {
    await updateMut.mutateAsync({ id: project.id, patch: editForm });
    toast.success(locale === "pt" ? "Salvo" : "Saved");
    setEditing(false);
  };

  return <ProjectShell project={project} isManager={isManager} editing={editing} setEditing={setEditing} editForm={editForm} setEditForm={setEditForm} save={save} />;
};

// ===== Shell with sub-nav =====
const TAB_RENDERERS: Record<TabId, (p: { project: any; isManager: boolean }) => JSX.Element> = {
  overview: ({ project }) => <OverviewTab project={project} />,
  team: ({ project }) => <TeamTab projectId={project.id} />,
  refs: ({ project }) => <RefsTab projectId={project.id} />,
  tasks: ({ project }) => <TasksTab projectId={project.id} />,
  schedule: ({ project }) => <ScheduleTab projectId={project.id} />,
  meetings: ({ project }) => <MeetingsTab projectId={project.id} />,
  advisees: ({ project }) => <AdviseesTab projectId={project.id} />,
  pubs: ({ project }) => <PublicationsTab projectId={project.id} />,
  brainstorm: ({ project }) => <BrainstormTab projectId={project.id} projectTitle={project.title} />,
  docs: ({ project }) => <DocumentsTab projectId={project.id} />,
  budget: ({ project }) => <BudgetTab projectId={project.id} />,
  ethics: ({ project }) => <EthicsTab projectId={project.id} />,
  logbook: ({ project, isManager }) => <LogbookTab projectId={project.id} isManager={isManager} />,
  evals: ({ project, isManager }) => <EvaluationsTab projectId={project.id} isManager={isManager} />,
  risks: ({ project }) => <RisksTab projectId={project.id} />,
  compliance: ({ project }) => <ComplianceTab projectId={project.id} />,
  credit: ({ project }) => <CreditAuthorshipTab projectId={project.id} projectTitle={project.title} />,
  outputs: ({ project }) => <OutputsTab projectId={project.id} />,
  activity: ({ project }) => <ActivityHeatmap projectId={project.id} />,
  favorites: ({ project }) => <FavoritesTab projectId={project.id} />,
  defense: ({ project }) => <DefenseTab projectId={project.id} />,
  connections: ({ project }) => <ConnectionsTab projectId={project.id} />,
  integrations: ({ project }) => <IntegrationsTab projectId={project.id} />,
};

const ProjectShell = ({ project, isManager, editing, setEditing, editForm, setEditForm, save }: any) => {
  const { locale } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get("tab") as TabId) || "overview";
  const activeTab: TabId = ALL_TAB_IDS.includes(tabParam) ? tabParam : "overview";
  const { collapsed, toggle } = useProjectSubNavState();
  const [mobileOpen, setMobileOpen] = useState(false);

  const setTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
    setMobileOpen(false);
  };

  // Counters (lightweight)
  const { data: taskCounts } = useQuery({
    queryKey: ["research-task-counts", project.id],
    queryFn: async () => {
      const { data } = await supabase.from("research_tasks").select("status").eq("project_id", project.id);
      const arr = data ?? [];
      return {
        tasks: arr.filter((t: any) => t.status !== "done").length,
      };
    },
  });
  const { data: meetingCount } = useQuery({
    queryKey: ["research-meeting-count", project.id],
    queryFn: async () => {
      const { count } = await supabase.from("research_meetings").select("id", { count: "exact", head: true })
        .eq("project_id", project.id).gte("scheduled_at", new Date().toISOString());
      return count ?? 0;
    },
  });
  const { data: riskCount } = useQuery({
    queryKey: ["research-risk-count", project.id],
    queryFn: async () => {
      const { count } = await supabase.from("research_risk_alerts" as any).select("id", { count: "exact", head: true })
        .eq("project_id", project.id).eq("resolved", false);
      return count ?? 0;
    },
  });

  const counters = {
    tasks: taskCounts?.tasks,
    meetings: meetingCount || undefined,
    risks: riskCount || undefined,
  };

  const Render = TAB_RENDERERS[activeTab];

  const navProps = {
    projectTitle: project.title,
    projectStatus: STATUS_LABEL[project.status]?.[locale],
    activeTab,
    onTabChange: setTab,
    counters,
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-muted/20">
      {/* Desktop sub-nav */}
      <div className="hidden lg:flex">
        <ProjectSubNav {...navProps} collapsed={collapsed} onToggleCollapse={toggle} />
      </div>
      {/* Mobile sub-nav */}
      <MobileSheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <MobileSheetContent side="left" className="p-0 w-64">
          <ProjectSubNav {...navProps} collapsed={false} onToggleCollapse={() => setMobileOpen(false)} />
        </MobileSheetContent>
      </MobileSheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-sm px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setMobileOpen(true)}>
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground hover:text-foreground">
              <Link to="/research"><ArrowLeft className="h-3.5 w-3.5" />{locale === "pt" ? "Projetos" : "Projects"}</Link>
            </Button>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-medium truncate">{project.title}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {editing ? (
                <div className="space-y-2 max-w-2xl">
                  <Input value={editForm.title} onChange={(e: any) => setEditForm({ ...editForm, title: e.target.value })} className="text-xl font-bold" />
                  <Textarea value={editForm.description} onChange={(e: any) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
                  <Select value={editForm.status} onValueChange={(v: any) => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s][locale]}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-2"><Button size="sm" onClick={save}>{locale === "pt" ? "Salvar" : "Save"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{locale === "pt" ? "Cancelar" : "Cancel"}</Button></div>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-semibold tracking-tight truncate">{project.title}</h1>
                    <Badge variant="secondary" className="text-[10px] h-5 px-2 font-medium">{STATUS_LABEL[project.status][locale]}</Badge>
                    {project.cnpq_area && <span className="text-xs text-muted-foreground truncate">{project.cnpq_area}</span>}
                  </div>
                  {project.description && <p className="text-xs text-muted-foreground mt-1 max-w-3xl line-clamp-1">{project.description}</p>}
                </div>
              )}
            </div>
            {!editing && (
              <div className="flex gap-1 items-center shrink-0">
                <NotificationsBell />
                <ExportProjectMenu project={project} />
                <PresentationMode project={project} />
                <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(true)}>{locale === "pt" ? "Editar" : "Edit"}</Button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            <Render project={project} isManager={isManager} />
          </div>
        </main>
      </div>

      <ResearchCopilot projectId={project.id} projectTitle={project.title} />
    </div>
  );
};

export default function ResearchProjectDetail() {
  return <Inner />;
}
