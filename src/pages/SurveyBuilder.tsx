import { useEffect, useCallback, useRef, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSurveyStore } from "@/hooks/useSurveyStore";

import BlockStepper from "@/components/survey/builder/BlockStepper";
import QuestionCanvas from "@/components/survey/builder/QuestionCanvas";
import QuestionContextPanel from "@/components/survey/builder/QuestionContextPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import FlowCanvas from "@/components/survey/flow/FlowCanvas";
import DistributionPanel from "@/components/survey/distribution/DistributionPanel";
import SurveyResultsPanel from "@/components/survey/results/SurveyResultsPanel";
import SurveyPreviewPanel from "@/components/survey/preview/SurveyPreviewPanel";
import ConsentBuilder from "@/components/survey/consent/ConsentBuilder";
import VisitManager from "@/components/survey/ecrf/VisitManager";
import ParticipantList from "@/components/survey/ecrf/ParticipantList";
import ComplianceDocuments from "@/components/survey/compliance/ComplianceDocuments";
import SurveyTeamTab from "@/components/survey/team/SurveyTeamTab";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, GitBranch, Send, BarChart3, Hammer, ShieldCheck, Calendar, Users, FileText, UsersRound, Rocket, Lock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { createSurveyAnalysisTask } from "@/lib/research/integrations";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type BuilderView = "build" | "consent" | "visits" | "participants" | "compliance" | "team" | "flow" | "distribute" | "results" | "preview";

// Distribute/Results can carry a sub-tab segment (e.g. /distribute/email), so match the
// view keyword anywhere in the path rather than requiring it to be the final segment.
const getViewFromPath = (pathname: string): BuilderView => {
  const match = pathname.match(
    /\/surveys\/[^/]+\/(consent|visits|participants|compliance|team|flow|distribute|results|preview)(?:\/|$)/
  );
  return (match?.[1] as BuilderView) ?? "build";
};

const CLINICAL_ONLY_VIEWS: BuilderView[] = ["consent", "visits", "participants", "compliance", "team"];

const SurveyBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const store = useSurveyStore();
  const isMobile = useIsMobile();
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const currentView = getViewFromPath(location.pathname);
  // Legacy surveys created before this field existed keep every tab (their prior behavior).
  const studyType: "quick" | "clinical" = store.survey?.settings?.study_type === "quick" ? "quick" : "clinical";
  const isQuick = studyType === "quick";

  // Load survey data
  const { isLoading } = useQuery({
    queryKey: ["survey-builder", id],
    queryFn: async () => {
      const [surveyRes, blocksRes, questionsRes, rulesRes] = await Promise.all([
        supabase.from("surveys").select("*").eq("id", id!).single(),
        supabase.from("survey_blocks").select("*").eq("survey_id", id!).order("block_order"),
        supabase.from("survey_questions").select("*").eq("survey_id", id!).order("question_order"),
        supabase.from("survey_logic_rules").select("*").eq("survey_id", id!).order("rule_order"),
      ]);
      if (surveyRes.error) throw surveyRes.error;
      store.setSurvey(surveyRes.data as any);
      store.setBlocks((blocksRes.data as any[]) || []);
      store.setQuestions((questionsRes.data as any[]) || []);
      store.setLogicRules((rulesRes.data as any[]) || []);
      if (blocksRes.data?.length) {
        store.setActiveBlock(blocksRes.data[0].id);
      }
      store.markClean();
      return surveyRes.data;
    },
    enabled: !!id && !!user,
  });

  // Auto-save
  const save = useCallback(async () => {
    if (!store.survey || !store.isDirty) return;
    try {
      await supabase
        .from("surveys")
        .update({
          title: store.survey.title,
          description: store.survey.description,
          settings: store.survey.settings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", store.survey.id);

      for (const block of store.blocks) {
        await supabase.from("survey_blocks").upsert(block, { onConflict: "id" });
      }
      for (const q of store.questions) {
        await supabase.from("survey_questions").upsert(q as any, { onConflict: "id" });
      }
      for (const rule of store.logicRules) {
        await supabase.from("survey_logic_rules").upsert(rule as any, { onConflict: "id" });
      }
      store.markClean();
      setLastSavedAt(new Date());
    } catch {
      toast.error("Failed to save");
    }
  }, [store.survey, store.blocks, store.questions, store.logicRules, store.isDirty]);

  useEffect(() => {
    if (!store.isDirty) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(save, 2000);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [store.isDirty, save]);

  const changeStatus = useMutation({
    mutationFn: async (newStatus: "active" | "closed") => {
      const patch: Record<string, any> = { status: newStatus };
      if (newStatus === "active") patch.published_at = new Date().toISOString();
      if (newStatus === "closed") patch.closed_at = new Date().toISOString();
      const { error } = await supabase.from("surveys").update(patch).eq("id", store.survey!.id);
      if (error) throw error;
      return patch;
    },
    onSuccess: (patch) => {
      const prevSurvey = store.survey!;
      store.setSurvey({ ...prevSurvey, ...patch });

      if (patch.status === "active") {
        toast.success(locale === "pt" ? "Coleta publicada — já pode receber respostas." : "Collection published — it can now receive responses.");
        return;
      }

      const projectId = prevSurvey.research_project_id;
      if (projectId) {
        createSurveyAnalysisTask(projectId, prevSurvey.title).catch(() => { /* non-blocking */ });
      }
      toast.success(
        locale === "pt" ? "Coleta encerrada." : "Collection closed.",
        {
          description: projectId
            ? (locale === "pt" ? "Uma tarefa de análise foi criada no projeto vinculado." : "An analysis task was created in the linked project.")
            : undefined,
          action: {
            label: locale === "pt" ? "Analisar no DataMind" : "Analyze in DataMind",
            onClick: () => navigate(`/surveys/${id}/results/reports`),
          },
        },
      );
    },
    onError: () => toast.error(locale === "pt" ? "Falha ao atualizar status" : "Failed to update status"),
  });

  useEffect(() => () => store.resetStore(), []);

  // A Quick Collection has no TCLE/Visits/Participants/Compliance/Team screens — bounce back to Build.
  useEffect(() => {
    if (isQuick && CLINICAL_ONLY_VIEWS.includes(currentView)) {
      navigate(`/surveys/${id}/build`, { replace: true });
    }
  }, [isQuick, currentView, id, navigate]);

  if (isLoading || !store.survey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case "consent":
        return <ConsentBuilder surveyId={id!} />;
      case "visits":
        return <VisitManager surveyId={id!} />;
      case "participants":
        return <ParticipantList surveyId={id!} />;
      case "compliance":
        return <ComplianceDocuments surveyId={id!} />;
      case "team":
        return <SurveyTeamTab surveyId={id!} />;
      case "flow":
        return <FlowCanvas />;
      case "distribute":
        return <DistributionPanel surveyId={id!} />;
      case "results":
        return <SurveyResultsPanel surveyId={id!} />;
      case "preview":
        return <SurveyPreviewPanel />;
      default:
        return (
          <div className="flex flex-col h-full">
            <BlockStepper />
            {isMobile ? (
              <>
                <div className="flex-1 min-h-0">
                  <QuestionCanvas />
                </div>
                {/* On a phone-width screen there's no room for a third column, so the
                    properties panel becomes a bottom sheet that opens with the question. */}
                <Sheet
                  open={!!store.activeQuestionId}
                  onOpenChange={(open) => !open && store.setActiveQuestion(null)}
                >
                  <SheetContent side="bottom" className="h-[75vh] p-0">
                    <QuestionContextPanel />
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
                <ResizablePanel defaultSize={70} minSize={40}>
                  <QuestionCanvas />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                  <QuestionContextPanel />
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 h-14 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/surveys")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={store.survey.title}
          onChange={(e) => store.updateSurveyField("title", e.target.value)}
          className="min-w-0 flex-1 sm:flex-none sm:max-w-xs border-none shadow-none text-base font-semibold focus-visible:ring-0 px-1"
        />
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
          {!isMobile && (
            <Badge variant="secondary" className={STATUS_BADGE[store.survey.status] || ""}>
              {store.survey.status === "active"
                ? (locale === "pt" ? "Ativa" : "Active")
                : store.survey.status === "closed"
                  ? (locale === "pt" ? "Encerrada" : "Closed")
                  : (locale === "pt" ? "Rascunho" : "Draft")}
            </Badge>
          )}
          {store.survey.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => changeStatus.mutate("active")} disabled={changeStatus.isPending}>
              <Rocket className="h-4 w-4 sm:mr-1" />
              {!isMobile && (locale === "pt" ? "Publicar" : "Publish")}
            </Button>
          )}
          {store.survey.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => changeStatus.mutate("closed")} disabled={changeStatus.isPending}>
              <Lock className="h-4 w-4 sm:mr-1" />
              {!isMobile && (locale === "pt" ? "Encerrar" : "Close")}
            </Button>
          )}
          {store.isDirty ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              {!isMobile && (locale === "pt" ? "Salvando..." : "Saving...")}
            </span>
          ) : (
            lastSavedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                <Check className="h-3 w-3 shrink-0" />
                {!isMobile && (
                  <>
                    {locale === "pt" ? "Salvo às " : "Saved at "}
                    {lastSavedAt.toLocaleTimeString(locale === "pt" ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                  </>
                )}
              </span>
            )
          )}
          <Button size="sm" onClick={save} disabled={!store.isDirty}>
            <Save className="h-4 w-4 sm:mr-1" />
            {!isMobile && (locale === "pt" ? "Salvar" : "Save")}
          </Button>
        </div>
      </div>

      {/* View tabs — a separate horizontally-scrolling row (like BlockStepper below it) instead
          of sharing the h-14 top bar, which used to wrap onto a second line and clip as soon as
          the clinical clusters (or this row's own status/save controls) left too little width. */}
      <div className="border-b bg-muted/10 px-4 py-1.5 overflow-x-auto shrink-0">
        <Tabs value={currentView}>
          <TabsList className="h-auto items-center gap-1.5 bg-transparent p-0 w-max">
            {/* Cluster: Montar */}
            <div className="flex items-center gap-0.5 rounded-md bg-muted p-1">
              <TabsTrigger value="build" className="text-xs" onClick={() => navigate(`/surveys/${id}/build`)}>
                <Hammer className="h-3 w-3 mr-1" />
                {locale === "pt" ? "Construir" : "Build"}
              </TabsTrigger>
              <TabsTrigger value="flow" className="text-xs" onClick={() => navigate(`/surveys/${id}/flow`)}>
                <GitBranch className="h-3 w-3 mr-1" />
                {locale === "pt" ? "Fluxo" : "Flow"}
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs" onClick={() => navigate(`/surveys/${id}/preview`)}>
                <Eye className="h-3 w-3 mr-1" />
                {locale === "pt" ? "Prévia" : "Preview"}
              </TabsTrigger>
            </div>

            {!isQuick && (
              <>
                {/* Cluster: Ética & Participantes */}
                <div className="flex items-center gap-0.5 rounded-md bg-muted p-1">
                  <TabsTrigger value="consent" className="text-xs" onClick={() => navigate(`/surveys/${id}/consent`)}>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    TCLE
                  </TabsTrigger>
                  <TabsTrigger value="visits" className="text-xs" onClick={() => navigate(`/surveys/${id}/visits`)}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {locale === "pt" ? "Visitas" : "Visits"}
                  </TabsTrigger>
                  <TabsTrigger value="participants" className="text-xs" onClick={() => navigate(`/surveys/${id}/participants`)}>
                    <Users className="h-3 w-3 mr-1" />
                    {locale === "pt" ? "Participantes" : "Participants"}
                  </TabsTrigger>
                  <TabsTrigger value="compliance" className="text-xs" onClick={() => navigate(`/surveys/${id}/compliance`)}>
                    <FileText className="h-3 w-3 mr-1" />
                    {locale === "pt" ? "Conformidade" : "Compliance"}
                  </TabsTrigger>
                </div>

                {/* Cluster: Equipe */}
                <div className="flex items-center gap-0.5 rounded-md bg-muted p-1">
                  <TabsTrigger value="team" className="text-xs" onClick={() => navigate(`/surveys/${id}/team`)}>
                    <UsersRound className="h-3 w-3 mr-1" />
                    {locale === "pt" ? "Equipe" : "Team"}
                  </TabsTrigger>
                </div>
              </>
            )}

            {/* Cluster: Publicar & Resultados */}
            <div className="flex items-center gap-0.5 rounded-md bg-muted p-1">
              <TabsTrigger value="distribute" className="text-xs" onClick={() => navigate(`/surveys/${id}/distribute`)}>
                <Send className="h-3 w-3 mr-1" />
                {locale === "pt" ? "Distribuir" : "Distribute"}
              </TabsTrigger>
              <TabsTrigger value="results" className="text-xs" onClick={() => navigate(`/surveys/${id}/results`)}>
                <BarChart3 className="h-3 w-3 mr-1" />
                {locale === "pt" ? "Resultados" : "Results"}
              </TabsTrigger>
            </div>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">{renderContent()}</div>
    </div>
  );
};

export default SurveyBuilder;
