import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { useProjectLinkedIds } from "@/hooks/useProjectLinkedIds";
import { createSurveyAnalysisTask, linkResource } from "@/lib/research/integrations";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  ClipboardList,
  Pencil,
  Trash2,
  Copy,
  BarChart3,
  Send,
  Zap,
  Stethoscope,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export type StudyType = "quick" | "clinical";

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabel: Record<string, { pt: string; en: string }> = {
  draft: { pt: "Rascunho", en: "Draft" },
  active: { pt: "Ativa", en: "Active" },
  closed: { pt: "Encerrada", en: "Closed" },
};

const Surveys = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeProjectId } = useActiveProject();
  const linkedSurveyIds = useProjectLinkedIds("survey");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<StudyType>("quick");

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["surveys", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const createSurvey = useMutation({
    mutationFn: async ({ title, studyType }: { title: string; studyType: StudyType }) => {
      const { data, error } = await supabase
        .from("surveys")
        .insert({ user_id: user!.id, title, settings: { study_type: studyType }, research_project_id: activeProjectId })
        .select()
        .single();
      if (error) throw error;
      // Create a default block
      await supabase.from("survey_blocks").insert({
        survey_id: data.id,
        title: locale === "pt" ? "Bloco 1" : "Block 1",
        block_order: 0,
      });
      if (activeProjectId) {
        await linkResource({ projectId: activeProjectId, resourceType: "survey", resourceId: data.id, label: data.title });
      }
      return data;
    },
    onSuccess: (data) => {
      setCreateOpen(false);
      navigate(`/surveys/${data.id}/build`);
    },
    onError: () => toast.error(locale === "pt" ? "Falha ao criar coleta" : "Failed to create data collection"),
  });

  const openCreateDialog = () => {
    setNewTitle(locale === "pt" ? "Nova Coleta" : "New Data Collection");
    setNewMode("quick");
    setCreateOpen(true);
  };

  const deleteSurvey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("surveys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(locale === "pt" ? "Coleta excluída" : "Data collection deleted");
    },
  });

  const duplicateSurvey = useMutation({
    mutationFn: async (sourceId: string) => {
      const source = surveys.find((s) => s.id === sourceId);
      if (!source) return;
      const { data, error } = await supabase
        .from("surveys")
        .insert({
          user_id: user!.id,
          title: `${source.title} (Copy)`,
          description: source.description,
          settings: source.settings,
          research_project_id: source.research_project_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      if (source.research_project_id) {
        await linkResource({ projectId: source.research_project_id, resourceType: "survey", resourceId: data.id, label: data.title });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(locale === "pt" ? "Coleta duplicada" : "Data collection duplicated");
    },
  });

  const filtered = surveys.filter((s) =>
    s.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              {locale === "pt" ? "Coleta de Dados" : "Data Collection"}
            </h1>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {locale === "pt" ? "Nova Coleta" : "New Data Collection"}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={locale === "pt" ? "Buscar coletas..." : "Search data collections..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {locale === "pt" ? "Nenhuma coleta ainda" : "No data collections yet"}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              {locale === "pt"
                ? "Crie sua primeira coleta para começar a reunir dados"
                : "Create your first data collection to start gathering data"}
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {locale === "pt" ? "Nova Coleta" : "New Data Collection"}
            </Button>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {locale === "pt" ? "Nome" : "Name"}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {locale === "pt" ? "Modificado" : "Modified"}
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((survey) => (
                  <tr
                    key={survey.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/surveys/${survey.id}/build`)}
                  >
                    <td className="px-4 py-3 font-medium">{survey.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={statusColor[survey.status] || ""}>
                        {statusLabel[survey.status]?.[locale] || survey.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(survey.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <LinkToProjectButton
                          resourceType="survey"
                          resourceId={survey.id}
                          label={survey.title}
                          attachTable="surveys"
                          variant="ghost"
                          linked={linkedSurveyIds.has(survey.id)}
                          metadata={{ status: survey.status }}
                          onLinked={async (projectId) => {
                            if (["completed", "closed", "encerrada", "concluida"].includes(String(survey.status))) {
                              try { await createSurveyAnalysisTask(projectId, survey.title); } catch { /* non-blocking */ }
                            }
                          }}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/surveys/${survey.id}/build`)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {locale === "pt" ? "Editar" : "Edit"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/surveys/${survey.id}/results`)}>
                            <BarChart3 className="h-4 w-4 mr-2" />
                            {locale === "pt" ? "Resultados" : "Results"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/surveys/${survey.id}/distribute`)}>
                            <Send className="h-4 w-4 mr-2" />
                            {locale === "pt" ? "Distribuir" : "Distribute"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateSurvey.mutate(survey.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            {locale === "pt" ? "Duplicar" : "Duplicate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteSurvey.mutate(survey.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {locale === "pt" ? "Excluir" : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{locale === "pt" ? "Nova Coleta" : "New Data Collection"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-survey-title">{locale === "pt" ? "Título" : "Title"}</Label>
                <Input
                  id="new-survey-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label>{locale === "pt" ? "Tipo de coleta" : "Collection type"}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewMode("quick")}
                    className={`relative text-left rounded-lg border p-3 transition-colors ${
                      newMode === "quick" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {newMode === "quick" && <Check className="absolute top-3 right-3 h-4 w-4 text-primary" />}
                    <Zap className="h-5 w-5 text-primary mb-2" />
                    <p className="font-medium text-sm">{locale === "pt" ? "Coleta Rápida" : "Quick Collection"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {locale === "pt"
                        ? "Enquetes e questionários simples: montar, distribuir, ver resultados."
                        : "Simple polls and questionnaires: build, distribute, see results."}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewMode("clinical")}
                    className={`relative text-left rounded-lg border p-3 transition-colors ${
                      newMode === "clinical" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {newMode === "clinical" && <Check className="absolute top-3 right-3 h-4 w-4 text-primary" />}
                    <Stethoscope className="h-5 w-5 text-primary mb-2" />
                    <p className="font-medium text-sm">{locale === "pt" ? "Estudo Clínico" : "Clinical Study"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {locale === "pt"
                        ? "Com TCLE, visitas, participantes, conformidade e equipe."
                        : "With consent (TCLE), visits, participants, compliance, and team."}
                    </p>
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {locale === "pt" ? "Cancelar" : "Cancel"}
              </Button>
              <Button
                onClick={() =>
                  createSurvey.mutate({
                    title: newTitle.trim() || (locale === "pt" ? "Nova Coleta" : "New Data Collection"),
                    studyType: newMode,
                  })
                }
                disabled={createSurvey.isPending}
              >
                {locale === "pt" ? "Criar" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default Surveys;
