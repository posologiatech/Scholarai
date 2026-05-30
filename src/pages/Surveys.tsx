import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const Surveys = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

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
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .insert({ user_id: user!.id, title: locale === "pt" ? "Nova Pesquisa" : "New Survey" })
        .select()
        .single();
      if (error) throw error;
      // Create a default block
      await supabase.from("survey_blocks").insert({
        survey_id: data.id,
        title: locale === "pt" ? "Bloco 1" : "Block 1",
        block_order: 0,
      });
      return data;
    },
    onSuccess: (data) => {
      navigate(`/surveys/${data.id}/build`);
    },
    onError: () => toast.error("Failed to create survey"),
  });

  const deleteSurvey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("surveys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(locale === "pt" ? "Pesquisa excluída" : "Survey deleted");
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
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(locale === "pt" ? "Pesquisa duplicada" : "Survey duplicated");
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
              {locale === "pt" ? "Pesquisas" : "Surveys"}
            </h1>
          </div>
          <Button onClick={() => createSurvey.mutate()} disabled={createSurvey.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            {locale === "pt" ? "Criar Pesquisa" : "Create Survey"}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={locale === "pt" ? "Buscar pesquisas..." : "Search surveys..."}
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
              {locale === "pt" ? "Nenhuma pesquisa ainda" : "No surveys yet"}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              {locale === "pt"
                ? "Crie sua primeira pesquisa para começar a coletar dados"
                : "Create your first survey to start collecting data"}
            </p>
            <Button onClick={() => createSurvey.mutate()} disabled={createSurvey.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              {locale === "pt" ? "Criar Pesquisa" : "Create Survey"}
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
                        {survey.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(survey.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default Surveys;
