import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ExternalLink, Database, Code2, FileBadge, Newspaper, Workflow, Box, Globe2 } from "lucide-react";

type Output = {
  id: string; project_id: string; type: string; title: string; description: string | null;
  url: string | null; doi: string | null; repository: string | null; license: string | null;
  release_date: string | null; tags: string[] | null; is_public: boolean; metrics: any;
};

const TYPES = [
  { v: "dataset", l: "Dataset", icon: Database, color: "bg-sky-500/10 text-sky-600" },
  { v: "code", l: "Código", icon: Code2, color: "bg-emerald-500/10 text-emerald-600" },
  { v: "software", l: "Software", icon: Box, color: "bg-violet-500/10 text-violet-600" },
  { v: "patent", l: "Patente", icon: FileBadge, color: "bg-amber-500/10 text-amber-700" },
  { v: "media", l: "Mídia", icon: Newspaper, color: "bg-pink-500/10 text-pink-600" },
  { v: "protocol", l: "Protocolo", icon: Workflow, color: "bg-indigo-500/10 text-indigo-600" },
  { v: "other", l: "Outro", icon: Box, color: "bg-muted text-foreground" },
];

const typeMeta = (v: string) => TYPES.find(t => t.v === v) || TYPES[6];

export default function OutputsTab({ projectId }: { projectId: string }) {
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Output>>({ type: "dataset", is_public: true });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("research_outputs").select("*").eq("project_id", projectId).order("release_date", { ascending: false, nullsFirst: false });
    setOutputs((data as Output[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    if (!form.title) return;
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = { ...form, project_id: projectId, created_by: user?.id };
    if (typeof payload.tags === "string") payload.tags = (payload.tags as string).split(",").map(s => s.trim()).filter(Boolean);
    if (form.id) await supabase.from("research_outputs").update(payload).eq("id", form.id);
    else await supabase.from("research_outputs").insert(payload);
    setOpen(false); setForm({ type: "dataset", is_public: true });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este output?")) return;
    await supabase.from("research_outputs").delete().eq("id", id);
    load();
  };

  const grouped = TYPES.map(t => ({ ...t, items: outputs.filter(o => o.type === t.v) })).filter(g => g.items.length > 0 || g.v === "dataset");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Vitrine de outputs</h3>
          <p className="text-sm text-muted-foreground">Datasets, código, patentes, mídia e protocolos do projeto.</p>
        </div>
        <Button size="sm" onClick={() => { setForm({ type: "dataset", is_public: true }); setOpen(true); }} className="gap-1"><Plus className="h-4 w-4" /> Novo output</Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : outputs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum output cadastrado. Adicione datasets (Zenodo/Figshare), código (GitHub), patentes (INPI), mídia (entrevistas, posts) e protocolos.
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(g => g.items.length > 0 && (
            <div key={g.v}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <g.icon className="h-3.5 w-3.5" /> {g.l} <span className="text-[10px]">({g.items.length})</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {g.items.map(o => {
                  const M = typeMeta(o.type);
                  return (
                    <Card key={o.id} className="p-4 hover:shadow-md transition cursor-pointer" onClick={() => { setForm(o); setOpen(true); }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className={M.color}>{M.l}</Badge>
                            {o.is_public && <Badge variant="outline" className="gap-1"><Globe2 className="h-3 w-3" /> Público</Badge>}
                          </div>
                          <p className="font-medium text-sm line-clamp-2">{o.title}</p>
                          {o.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{o.description}</p>}
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                            {o.doi && <span>DOI: {o.doi}</span>}
                            {o.repository && <span>{o.repository}</span>}
                            {o.license && <span>{o.license}</span>}
                            {o.release_date && <span>{new Date(o.release_date).toLocaleDateString("pt-BR")}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {o.url && <a href={o.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button></a>}
                          <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); remove(o.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} output</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type as string} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data de lançamento</Label>
                <Input type="date" value={form.release_date || ""} onChange={(e) => setForm({ ...form, release_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">URL</Label><Input value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
              <div><Label className="text-xs">DOI</Label><Input value={form.doi || ""} onChange={(e) => setForm({ ...form, doi: e.target.value })} placeholder="10.5281/..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Repositório</Label><Input value={form.repository || ""} onChange={(e) => setForm({ ...form, repository: e.target.value })} placeholder="GitHub, Zenodo..." /></div>
              <div><Label className="text-xs">Licença</Label><Input value={form.license || ""} onChange={(e) => setForm({ ...form, license: e.target.value })} placeholder="CC-BY-4.0, MIT..." /></div>
            </div>
            <div>
              <Label className="text-xs">Tags (separadas por vírgula)</Label>
              <Input value={Array.isArray(form.tags) ? form.tags.join(", ") : (form.tags as any) || ""} onChange={(e) => setForm({ ...form, tags: e.target.value as any })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />
              <Label className="text-xs">Exibir na vitrine pública do projeto</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
