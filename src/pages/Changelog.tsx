import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/i18n/LanguageContext";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Rocket, Lightbulb, Calendar, Plus, Pencil, Trash2, Search,
  CheckCircle2, Clock, Sparkles, Bug, Zap, Puzzle, Filter,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  released_at: string | null;
  created_at: string;
  module: string | null;
  version: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  released: { label: "Lançado", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  planned: { label: "Planejado", icon: Clock, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  idea: { label: "Ideia", icon: Lightbulb, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  feature: { label: "Funcionalidade", icon: Sparkles },
  bugfix: { label: "Correção", icon: Bug },
  improvement: { label: "Melhoria", icon: Zap },
  integration: { label: "Integração", icon: Puzzle },
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-600",
  high: "bg-orange-500/10 text-orange-600",
  critical: "bg-destructive/10 text-destructive",
};

const Changelog = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { locale } = useLanguage();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "feature", status: "released",
    priority: "medium", module: "", version: "", released_at: "",
  });

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_changelog" as any)
      .select("*")
      .order("released_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setEntries((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "feature", status: "released", priority: "medium", module: "", version: "", released_at: "" });
    setDialogOpen(true);
  };

  const openEdit = (e: ChangelogEntry) => {
    setEditing(e);
    setForm({
      title: e.title, description: e.description, category: e.category,
      status: e.status, priority: e.priority || "medium",
      module: e.module || "", version: e.version || "",
      released_at: e.released_at ? e.released_at.slice(0, 10) : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      status: form.status,
      priority: form.priority,
      module: form.module || null,
      version: form.version || null,
      released_at: form.released_at ? new Date(form.released_at).toISOString() : null,
      created_by: user?.id,
    };

    if (editing) {
      await supabase.from("system_changelog" as any).update(payload as any).eq("id", editing.id);
      toast({ title: "Atualização editada" });
    } else {
      await supabase.from("system_changelog" as any).insert(payload as any);
      toast({ title: "Entrada adicionada ao changelog" });
    }
    setDialogOpen(false);
    fetchEntries();
  };

  const remove = async (id: string) => {
    await supabase.from("system_changelog" as any).delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Entrada removida" });
  };

  const filtered = entries.filter((e) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const released = filtered.filter((e) => e.status === "released");
  const planned = filtered.filter((e) => e.status === "planned");
  const ideas = filtered.filter((e) => e.status === "idea");

  const renderEntry = (entry: ChangelogEntry) => {
    const st = statusConfig[entry.status] || statusConfig.released;
    const cat = categoryConfig[entry.category] || categoryConfig.feature;
    const StatusIcon = st.icon;
    const CatIcon = cat.icon;

    return (
      <Card key={entry.id} className="group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${st.color} shrink-0 mt-0.5`}>
              <StatusIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm text-foreground">{entry.title}</h3>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(entry.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{entry.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                  <CatIcon className="h-2.5 w-2.5" />{cat.label}
                </Badge>
                {entry.module && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entry.module}</Badge>
                )}
                {entry.version && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">v{entry.version}</Badge>
                )}
                {entry.priority && entry.status !== "released" && (
                  <Badge className={`text-[10px] px-1.5 py-0 border-0 ${priorityColors[entry.priority]}`}>
                    {entry.priority === "critical" ? "Crítico" : entry.priority === "high" ? "Alta" : entry.priority === "medium" ? "Média" : "Baixa"}
                  </Badge>
                )}
                {entry.released_at && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5" />
                    {format(new Date(entry.released_at), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              {locale === "pt" ? "Pipeline de Atualizações" : "Update Pipeline"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {locale === "pt" ? "Histórico de atualizações e roadmap de funcionalidades" : "Update history and feature roadmap"}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova entrada
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="released">Lançados</SelectItem>
              <SelectItem value="planned">Planejados</SelectItem>
              <SelectItem value="idea">Ideias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-8">
            {/* Released */}
            {released.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Lançados ({released.length})
                </h2>
                <div className="space-y-2">{released.map(renderEntry)}</div>
              </section>
            )}

            {/* Planned */}
            {planned.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-blue-500" /> Planejados ({planned.length})
                </h2>
                <div className="space-y-2">{planned.map(renderEntry)}</div>
              </section>
            )}

            {/* Ideas */}
            {ideas.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Lightbulb className="h-5 w-5 text-amber-500" /> Ideias ({ideas.length})
                </h2>
                <div className="space-y-2">{ideas.map(renderEntry)}</div>
              </section>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Rocket className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma entrada encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar entrada" : "Nova entrada no changelog"}</DialogTitle>
            <DialogDescription>Registre uma atualização, ideia ou funcionalidade planejada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Descrição detalhada..." rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="released">Lançado</SelectItem>
                  <SelectItem value="planned">Planejado</SelectItem>
                  <SelectItem value="idea">Ideia</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Funcionalidade</SelectItem>
                  <SelectItem value="bugfix">Correção</SelectItem>
                  <SelectItem value="improvement">Melhoria</SelectItem>
                  <SelectItem value="integration">Integração</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Módulo" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />
              <Input placeholder="Versão" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
            {form.status === "released" && (
              <Input type="date" value={form.released_at} onChange={(e) => setForm({ ...form, released_at: e.target.value })} />
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={!form.title.trim() || !form.description.trim()}>
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Changelog;
