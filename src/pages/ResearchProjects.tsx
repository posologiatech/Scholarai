import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Plus, FlaskConical, Calendar, Banknote, GraduationCap, MoreVertical,
  Trash2, CheckCircle2, PlayCircle, XCircle, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useResearchProjects, useCreateResearchProject,
  useUpdateResearchProject, useDeleteResearchProject,
} from "@/hooks/useResearchProjects";
import { STATUS_LABEL, type ResearchProject, type ResearchProjectStatus } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

type TabKey = "ativo" | "concluido" | "cancelado";

const TAB_STATUSES: Record<TabKey, ResearchProjectStatus[]> = {
  ativo: ["planejamento", "em_andamento", "pausado", "arquivado"],
  concluido: ["concluido"],
  cancelado: ["cancelado"],
};

/** Segmented green progress bar like a project management board. */
const SegmentedProgress = ({ value }: { value: number }) => {
  const total = 10;
  const filled = Math.round((Math.min(100, Math.max(0, value)) / 100) * total);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-[3px] ${
              i < filled ? "bg-emerald-500" : "bg-muted"
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{value}%</span>
    </div>
  );
};

const Inner = () => {
  const { locale } = useLanguage();
  const { data: projects = [], isLoading } = useResearchProjects();
  const createMut = useCreateResearchProject();
  const updateMut = useUpdateResearchProject();
  const deleteMut = useDeleteResearchProject();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("ativo");
  const [toDelete, setToDelete] = useState<ResearchProject | null>(null);
  const [form, setForm] = useState({ title: "", description: "", cnpq_area: "", keywords: "", objectives: "" });

  // Advisee names per project
  const { data: advisees = [] } = useQuery({
    queryKey: ["research-advisees-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_advisees")
        .select("project_id, full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Tasks for progress per project
  const { data: tasks = [] } = useQuery({
    queryKey: ["research-tasks-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_tasks")
        .select("project_id, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const adviseeByProject = useMemo(() => {
    const m = new Map<string, string[]>();
    advisees.forEach((a: any) => {
      if (!a.project_id || !a.full_name) return;
      m.set(a.project_id, [...(m.get(a.project_id) ?? []), a.full_name]);
    });
    return m;
  }, [advisees]);

  const progressByProject = useMemo(() => {
    const grp = new Map<string, { done: number; total: number }>();
    tasks.forEach((t: any) => {
      if (!t.project_id) return;
      const cur = grp.get(t.project_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      else if (t.status === "review") cur.done += 0.5;
      grp.set(t.project_id, cur);
    });
    const m = new Map<string, number>();
    grp.forEach((v, k) => m.set(k, v.total ? Math.round((v.done / v.total) * 100) : 0));
    return m;
  }, [tasks]);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { ativo: 0, concluido: 0, cancelado: 0 };
    projects.forEach((p) => {
      (Object.keys(TAB_STATUSES) as TabKey[]).forEach((k) => {
        if (TAB_STATUSES[k].includes(p.status)) c[k] += 1;
      });
    });
    return c;
  }, [projects]);

  const filtered = projects.filter((p) => TAB_STATUSES[tab].includes(p.status));

  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error(locale === "pt" ? "Título obrigatório" : "Title required");
    try {
      await createMut.mutateAsync({
        title: form.title.trim(),
        description: form.description || null,
        cnpq_area: form.cnpq_area || null,
        keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
        objectives: form.objectives || null,
      });
      toast.success(locale === "pt" ? "Projeto criado" : "Project created");
      setOpen(false);
      setForm({ title: "", description: "", cnpq_area: "", keywords: "", objectives: "" });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleStatus = async (p: ResearchProject, status: ResearchProjectStatus) => {
    try {
      await updateMut.mutateAsync({ id: p.id, patch: { status } });
      toast.success(locale === "pt" ? "Status atualizado" : "Status updated");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMut.mutateAsync(toDelete.id);
      toast.success(locale === "pt" ? "Projeto excluído" : "Project deleted");
      setToDelete(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <FlaskConical className="h-7 w-7 text-primary" />
            {locale === "pt" ? "Projetos de Pesquisa" : "Research Projects"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {locale === "pt"
              ? "Gerencie projetos, equipe, tarefas, orientações, reuniões, publicações e editais."
              : "Manage projects, team, tasks, advisees, meetings, publications and funding calls."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/research/advisor"><GraduationCap className="h-4 w-4" />{locale === "pt" ? "Orientador" : "Advisor"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/research/funding"><Banknote className="h-4 w-4" />{locale === "pt" ? "Editais" : "Funding"}</Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" />{locale === "pt" ? "Novo projeto" : "New project"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{locale === "pt" ? "Novo projeto de pesquisa" : "New research project"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>{locale === "pt" ? "Título *" : "Title *"}</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Descrição" : "Description"}</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{locale === "pt" ? "Área CNPq" : "Field"}</Label>
                    <Input placeholder={locale === "pt" ? "Ex.: Ciências da Saúde" : "e.g. Health Sciences"}
                      value={form.cnpq_area} onChange={e => setForm({ ...form, cnpq_area: e.target.value })} /></div>
                  <div><Label>{locale === "pt" ? "Palavras-chave (vírgula)" : "Keywords (comma)"}</Label>
                    <Input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} /></div>
                </div>
                <div><Label>{locale === "pt" ? "Objetivos" : "Objectives"}</Label>
                  <Textarea value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} rows={4} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{locale === "pt" ? "Cancelar" : "Cancel"}</Button>
                <Button onClick={handleCreate} disabled={createMut.isPending}>{locale === "pt" ? "Criar" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-6">
        <TabsList>
          <TabsTrigger value="ativo">
            {locale === "pt" ? "Projetos ativos" : "Active"}
            <Badge variant="secondary" className="ml-2">{counts.ativo}</Badge>
          </TabsTrigger>
          <TabsTrigger value="concluido">
            {locale === "pt" ? "Concluídos" : "Completed"}
            <Badge variant="secondary" className="ml-2">{counts.concluido}</Badge>
          </TabsTrigger>
          <TabsTrigger value="cancelado">
            {locale === "pt" ? "Cancelados" : "Cancelled"}
            <Badge variant="secondary" className="ml-2">{counts.cancelado}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-muted-foreground">{locale === "pt" ? "Carregando..." : "Loading..."}</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {tab === "ativo"
              ? (locale === "pt" ? "Nenhum projeto ativo. Crie o primeiro!" : "No active projects. Create your first!")
              : tab === "concluido"
                ? (locale === "pt" ? "Nenhum projeto concluído." : "No completed projects.")
                : (locale === "pt" ? "Nenhum projeto cancelado." : "No cancelled projects.")}
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const names = adviseeByProject.get(p.id) ?? [];
            const progress = progressByProject.get(p.id) ?? (p.status === "concluido" ? 100 : 0);
            return (
              <Card key={p.id} className="h-full flex flex-col hover:border-primary/40 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/research/${p.id}`} className="min-w-0">
                      <CardTitle className="text-base line-clamp-2 hover:text-primary transition-colors">{p.title}</CardTitle>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary">{STATUS_LABEL[p.status][locale]}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{locale === "pt" ? "Alterar status" : "Change status"}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleStatus(p, "em_andamento")}>
                            <PlayCircle className="h-4 w-4 text-primary" />{locale === "pt" ? "Marcar como ativo" : "Mark active"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatus(p, "concluido")}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />{locale === "pt" ? "Marcar como concluído" : "Mark completed"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatus(p, "cancelado")}>
                            <XCircle className="h-4 w-4 text-amber-500" />{locale === "pt" ? "Marcar como cancelado" : "Mark cancelled"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setToDelete(p)}>
                            <Trash2 className="h-4 w-4" />{locale === "pt" ? "Excluir projeto" : "Delete project"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {p.cnpq_area && <CardDescription>{p.cnpq_area}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <Link to={`/research/${p.id}`} className="flex-1">
                    {p.description && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{p.description}</p>}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.keywords.slice(0, 4).map(k => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}
                    </div>
                  </Link>
                  <div className="mb-3"><SegmentedProgress value={progress} /></div>
                  {names.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="line-clamp-1">{names.join(", ")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.updated_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{locale === "pt" ? "Excluir projeto?" : "Delete project?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "pt"
                ? `Esta ação não pode ser desfeita. O projeto "${toDelete?.title}" e seus dados serão removidos permanentemente.`
                : `This action cannot be undone. The project "${toDelete?.title}" and its data will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{locale === "pt" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {locale === "pt" ? "Excluir" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default function ResearchProjects() {
  return <Inner />;
}
