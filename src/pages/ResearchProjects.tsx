import { useState } from "react";
import { Link } from "react-router-dom";
import AppSidebar from "@/components/app/AppSidebar";
import ProtectedRoute from "@/components/app/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, FlaskConical, Calendar, Users2, FileText, Banknote } from "lucide-react";
import { useResearchProjects, useCreateResearchProject } from "@/hooks/useResearchProjects";
import { STATUS_LABEL } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const Inner = () => {
  const { locale } = useLanguage();
  const { data: projects = [], isLoading } = useResearchProjects();
  const createMut = useCreateResearchProject();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", cnpq_area: "", keywords: "", objectives: "" });

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

      {isLoading ? (
        <p className="text-muted-foreground">{locale === "pt" ? "Carregando..." : "Loading..."}</p>
      ) : projects.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">{locale === "pt" ? "Nenhum projeto ainda. Crie o primeiro!" : "No projects yet. Create your first!"}</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <Link to={`/research/${p.id}`} key={p.id}>
              <Card className="h-full hover:border-primary/40 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{p.title}</CardTitle>
                    <Badge variant="secondary" className="shrink-0">{STATUS_LABEL[p.status][locale]}</Badge>
                  </div>
                  {p.cnpq_area && <CardDescription>{p.cnpq_area}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{p.description}</p>}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.keywords.slice(0, 4).map(k => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.updated_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ResearchProjects() {
  return <ProtectedRoute><AppSidebar><Inner /></AppSidebar></ProtectedRoute>;
}
