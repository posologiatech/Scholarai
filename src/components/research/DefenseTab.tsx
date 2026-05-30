import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GraduationCap, Plus, Trash2, Calendar, MapPin, Video, Users, ExternalLink, Award } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "./RichEditor";

type Member = { id: string; name: string; role: string | null; institution: string | null; email: string | null; lattes_url: string | null; notes: string | null };

const ROLES = [
  { v: "presidente", l: "Presidente / Orientador" },
  { v: "membro_interno", l: "Membro Interno" },
  { v: "membro_externo", l: "Membro Externo" },
  { v: "suplente", l: "Suplente" },
  { v: "coorientador", l: "Coorientador" },
];
const STATUS = [
  { v: "planned", l: "Planejada" },
  { v: "scheduled", l: "Agendada" },
  { v: "done", l: "Realizada" },
  { v: "approved", l: "Aprovada" },
];

export default function DefenseTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const [defense, setDefense] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [mOpen, setMOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mForm, setMForm] = useState({ name: "", role: "membro_externo", institution: "", email: "", lattes_url: "", notes: "" });
  const [directory, setDirectory] = useState<any[]>([]);
  const [dirSearch, setDirSearch] = useState("");

  const load = async () => {
    const { data: d } = await supabase.from("research_defense").select("*").eq("project_id", projectId).maybeSingle();
    setDefense(d || { project_id: projectId });
    const { data: m } = await supabase.from("research_defense_members").select("*").eq("project_id", projectId).order("position").order("created_at");
    setMembers((m as Member[]) || []);
  };
  const loadDirectory = async () => {
    const { data } = await supabase.from("research_examiners").select("*").order("name");
    setDirectory(data || []);
  };
  useEffect(() => { load(); loadDirectory(); }, [projectId]);

  const saveField = async (patch: any) => {
    setDefense((d: any) => ({ ...d, ...patch }));
    if (defense?.id) {
      await supabase.from("research_defense").update(patch).eq("id", defense.id);
    } else {
      const { data } = await supabase.from("research_defense").insert({ project_id: projectId, created_by: user!.id, ...patch }).select().single();
      if (data) setDefense(data);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setMForm({ name: "", role: "membro_externo", institution: "", email: "", lattes_url: "", notes: "" });
    setDirSearch("");
    setMOpen(true);
  };
  const openEdit = (m: Member) => {
    setEditingId(m.id);
    setMForm({ name: m.name, role: m.role || "membro_externo", institution: m.institution || "", email: m.email || "", lattes_url: m.lattes_url || "", notes: m.notes || "" });
    setDirSearch("");
    setMOpen(true);
  };

  // Persist a member to the reusable personal directory (upsert by name+email)
  const syncToDirectory = async (data: { name: string; role: string; institution: string | null; email: string | null; lattes_url: string | null; notes: string | null }) => {
    if (!user) return;
    const existing = directory.find(
      (e) => e.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
        (e.email || "").trim().toLowerCase() === (data.email || "").trim().toLowerCase()
    );
    if (existing) {
      await supabase.from("research_examiners").update({
        role: data.role, institution: data.institution, email: data.email, lattes_url: data.lattes_url, notes: data.notes,
      }).eq("id", existing.id);
    } else {
      await supabase.from("research_examiners").insert({
        owner_id: user.id, name: data.name, role: data.role, institution: data.institution,
        email: data.email, lattes_url: data.lattes_url, notes: data.notes,
      });
    }
    loadDirectory();
  };

  const saveMember = async () => {
    if (!mForm.name.trim()) return toast.error(locale === "pt" ? "Nome obrigatório" : "Name required");
    const payload = {
      name: mForm.name.trim(), role: mForm.role,
      institution: mForm.institution.trim() || null, email: mForm.email.trim() || null,
      lattes_url: mForm.lattes_url.trim() || null, notes: mForm.notes.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from("research_defense_members").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("research_defense_members").insert({ project_id: projectId, ...payload });
      if (error) return toast.error(error.message);
    }
    await syncToDirectory(payload);
    setMOpen(false);
    setEditingId(null);
    setMForm({ name: "", role: "membro_externo", institution: "", email: "", lattes_url: "", notes: "" });
    load();
  };
  const removeMember = async (id: string) => {
    await supabase.from("research_defense_members").delete().eq("id", id);
    setMembers(members.filter(m => m.id !== id));
  };

  const pickFromDirectory = (e: any) => {
    setMForm({
      name: e.name || "", role: e.role || "membro_externo", institution: e.institution || "",
      email: e.email || "", lattes_url: e.lattes_url || "", notes: e.notes || "",
    });
    setDirSearch("");
  };
  const filteredDir = dirSearch.trim()
    ? directory.filter((e) =>
        `${e.name} ${e.institution || ""} ${e.email || ""}`.toLowerCase().includes(dirSearch.trim().toLowerCase()))
    : directory.slice(0, 6);


  const dt = defense?.defense_date ? new Date(defense.defense_date) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center"><GraduationCap className="h-6 w-6 text-primary" /></div>
            <div>
              <h2 className="text-xl font-bold">{locale === "pt" ? "Banca de Defesa" : "Defense Committee"}</h2>
              <p className="text-sm text-muted-foreground">{locale === "pt" ? "Organize todas as informações da sua defesa." : "Organize your defense details."}</p>
            </div>
          </div>
          <Select value={defense?.status || "planned"} onValueChange={(v) => saveField({ status: v })}>
            <SelectTrigger className="w-44 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Card><CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" />{locale === "pt" ? "Tipo de defesa" : "Defense type"}</Label>
          <Input className="mt-1" defaultValue={defense?.defense_type || ""} placeholder={locale === "pt" ? "Mestrado, Doutorado, TCC, Qualificação…" : "Master's, PhD…"}
            onBlur={(e) => e.target.value !== (defense?.defense_type || "") && saveField({ defense_type: e.target.value || null })} /></div>
        <div><Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{locale === "pt" ? "Data e hora" : "Date & time"}</Label>
          <Input className="mt-1" type="datetime-local" defaultValue={dt ? new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
            onChange={(e) => saveField({ defense_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
        <div><Label className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />{locale === "pt" ? "Modalidade" : "Modality"}</Label>
          <Select value={defense?.modality || ""} onValueChange={(v) => saveField({ modality: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder={locale === "pt" ? "Selecione…" : "Select…"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="presencial">{locale === "pt" ? "Presencial" : "In person"}</SelectItem>
              <SelectItem value="remota">{locale === "pt" ? "Remota" : "Remote"}</SelectItem>
              <SelectItem value="hibrida">{locale === "pt" ? "Híbrida" : "Hybrid"}</SelectItem>
            </SelectContent>
          </Select></div>
        <div><Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{locale === "pt" ? "Local" : "Location"}</Label>
          <Input className="mt-1" defaultValue={defense?.location || ""} placeholder={locale === "pt" ? "Sala / endereço" : "Room / address"}
            onBlur={(e) => e.target.value !== (defense?.location || "") && saveField({ location: e.target.value || null })} /></div>
        <div className="md:col-span-2"><Label className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />{locale === "pt" ? "Link da reunião" : "Meeting link"}</Label>
          <Input className="mt-1" defaultValue={defense?.meeting_link || ""} placeholder="https://…"
            onBlur={(e) => e.target.value !== (defense?.meeting_link || "") && saveField({ meeting_link: e.target.value || null })} /></div>
        <div className="md:col-span-2"><Label>{locale === "pt" ? "Título do trabalho" : "Work title"}</Label>
          <Input className="mt-1" defaultValue={defense?.title || ""}
            onBlur={(e) => e.target.value !== (defense?.title || "") && saveField({ title: e.target.value || null })} /></div>
        <div><Label className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" />{locale === "pt" ? "Resultado" : "Result"}</Label>
          <Input className="mt-1" defaultValue={defense?.result || ""} placeholder={locale === "pt" ? "Aprovado, Aprovado com louvor…" : "Approved…"}
            onBlur={(e) => e.target.value !== (defense?.result || "") && saveField({ result: e.target.value || null })} /></div>
        <div><Label>{locale === "pt" ? "Nota / Conceito" : "Grade"}</Label>
          <Input className="mt-1" defaultValue={defense?.grade || ""}
            onBlur={(e) => e.target.value !== (defense?.grade || "") && saveField({ grade: e.target.value || null })} /></div>
      </CardContent></Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" />{locale === "pt" ? "Membros da banca" : "Committee members"} <Badge variant="secondary">{members.length}</Badge></h3>
          <Button size="sm" variant="outline" onClick={openAdd}><Plus className="h-4 w-4" />{locale === "pt" ? "Adicionar" : "Add"}</Button>
          <Dialog open={mOpen} onOpenChange={(o) => { setMOpen(o); if (!o) setEditingId(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? (locale === "pt" ? "Editar membro" : "Edit member") : (locale === "pt" ? "Membro da banca" : "Committee member")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {!editingId && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <Label className="text-xs flex items-center gap-1.5"><Search className="h-3.5 w-3.5" />{locale === "pt" ? "Buscar professor já cadastrado" : "Search saved professor"}</Label>
                    <Input value={dirSearch} onChange={e => setDirSearch(e.target.value)} placeholder={locale === "pt" ? "Nome, instituição ou email…" : "Name, institution or email…"} />
                    {filteredDir.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filteredDir.map(e => (
                          <button key={e.id} type="button" onClick={() => pickFromDirectory(e)}
                            className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent transition-colors">
                            <div className="text-sm font-medium">{e.name}</div>
                            <div className="text-xs text-muted-foreground">{[e.institution, e.email].filter(Boolean).join(" · ") || (ROLES.find(r => r.v === e.role)?.l || "")}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{locale === "pt" ? "Nenhum professor cadastrado encontrado." : "No saved professor found."}</p>
                    )}
                  </div>
                )}
                <div><Label>{locale === "pt" ? "Nome" : "Name"}</Label><Input value={mForm.name} onChange={e => setMForm({ ...mForm, name: e.target.value })} autoFocus /></div>
                <div><Label>{locale === "pt" ? "Função" : "Role"}</Label>
                  <Select value={mForm.role} onValueChange={(v) => setMForm({ ...mForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>{locale === "pt" ? "Instituição" : "Institution"}</Label><Input value={mForm.institution} onChange={e => setMForm({ ...mForm, institution: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Email</Label><Input value={mForm.email} onChange={e => setMForm({ ...mForm, email: e.target.value })} /></div>
                  <div><Label>Lattes</Label><Input value={mForm.lattes_url} onChange={e => setMForm({ ...mForm, lattes_url: e.target.value })} placeholder="http://lattes…" /></div>
                </div>
                <div><Label>{locale === "pt" ? "Observações" : "Notes"}</Label><Textarea value={mForm.notes} onChange={e => setMForm({ ...mForm, notes: e.target.value })} rows={2} /></div>
              </div>
              <DialogFooter><Button onClick={saveMember}>{editingId ? (locale === "pt" ? "Salvar" : "Save") : (locale === "pt" ? "Adicionar" : "Add")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {members.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{locale === "pt" ? "Nenhum membro adicionado." : "No members yet."}</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map(m => (
              <Card key={m.id} className="p-4 group cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all" onClick={() => openEdit(m)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.name}</span>
                      {m.role && <Badge variant="outline" className="text-[10px]">{ROLES.find(r => r.v === m.role)?.l || m.role}</Badge>}
                    </div>
                    {m.institution && <p className="text-sm text-muted-foreground">{m.institution}</p>}
                    {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                    {m.lattes_url && <a href={m.lattes_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-primary flex items-center gap-1 mt-0.5">Lattes <ExternalLink className="h-3 w-3" /></a>}
                    {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeMember(m.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-sm font-semibold mb-2 block">{locale === "pt" ? "Resumo / Abstract" : "Abstract"}</Label>
        <RichEditor value={defense?.abstract || ""} onChange={(v) => saveField({ abstract: v || null })} minHeight={140} storagePrefix={`${projectId}/defense`} />
      </div>
      <div>
        <Label className="text-sm font-semibold mb-2 block">{locale === "pt" ? "Anotações da defesa" : "Defense notes"}</Label>
        <RichEditor value={defense?.notes || ""} onChange={(v) => saveField({ notes: v || null })} minHeight={160} storagePrefix={`${projectId}/defense`}
          placeholder={locale === "pt" ? "Arguições, sugestões da banca, ajustes solicitados…" : "Committee remarks, requested changes…"} />
      </div>
    </div>
  );
}
