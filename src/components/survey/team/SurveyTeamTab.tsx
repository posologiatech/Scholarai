import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ExternalLink, Crown, Loader2 } from "lucide-react";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { ROLE_LABEL, type ResearchMemberRole } from "@/lib/research/types";
import TeamManager from "./TeamManager";

interface Props {
  surveyId: string;
}

const SurveyTeamTab = ({ surveyId }: Props) => {
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pt = locale === "pt";

  const { data: survey, isLoading: loadingSurvey } = useQuery({
    queryKey: ["survey-project-link", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("title, research_project_id")
        .eq("id", surveyId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const projectId = survey?.research_project_id as string | null | undefined;

  const { data: project } = useQuery({
    queryKey: ["linked-project-title", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_projects")
        .select("id, title")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["linked-project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_project_members")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!projectId,
  });

  if (loadingSurvey) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No project linked yet — fall back to the survey's own lightweight roster,
  // with a one-click way to switch to the shared project team instead.
  if (!projectId) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {pt
                ? "Vincule esta coleta a um projeto de pesquisa para compartilhar a equipe automaticamente com ele."
                : "Link this collection to a research project to automatically share its team."}
            </p>
            <LinkToProjectButton
              resourceType="survey"
              resourceId={surveyId}
              label={survey?.title || ""}
              attachTable="surveys"
              onLinked={() => {
                queryClient.invalidateQueries({ queryKey: ["survey-project-link", surveyId] });
                queryClient.invalidateQueries({ queryKey: ["survey-builder", surveyId] });
              }}
            />
          </CardContent>
        </Card>
        <TeamManager surveyId={surveyId} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {pt ? "Equipe do Projeto" : "Project Team"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pt
              ? `Compartilhada com o projeto "${project?.title ?? "..."}" — adicione ou remova membros por lá.`
              : `Shared with the project "${project?.title ?? "..."}" — add or remove members there.`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/research/${projectId}?tab=team`)}>
          <ExternalLink className="h-3.5 w-3.5" />
          {pt ? "Gerenciar equipe" : "Manage team"}
        </Button>
      </div>

      {loadingMembers ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          {pt ? "Carregando..." : "Loading..."}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">
              {pt ? "Nenhum membro no projeto ainda" : "No project members yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const role = m.role as ResearchMemberRole;
            const isPi = role === "pi";
            return (
              <Card key={m.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${isPi ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary"}`}>
                    {isPi ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.full_name || m.invited_email || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]?.[locale] || role}</p>
                  </div>
                  {!m.accepted && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {pt ? "Convidado(a)" : "Invited"}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SurveyTeamTab;
