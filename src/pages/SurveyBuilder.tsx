import { useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSurveyStore } from "@/hooks/useSurveyStore";

import BlockSidebar from "@/components/survey/builder/BlockSidebar";
import QuestionCanvas from "@/components/survey/builder/QuestionCanvas";
import QuestionContextPanel from "@/components/survey/builder/QuestionContextPanel";
import FlowCanvas from "@/components/survey/flow/FlowCanvas";
import DistributionPanel from "@/components/survey/distribution/DistributionPanel";
import SurveyResultsPanel from "@/components/survey/results/SurveyResultsPanel";
import SurveyPreviewPanel from "@/components/survey/preview/SurveyPreviewPanel";
import ConsentBuilder from "@/components/survey/consent/ConsentBuilder";
import VisitManager from "@/components/survey/ecrf/VisitManager";
import ParticipantList from "@/components/survey/ecrf/ParticipantList";
import ComplianceDocuments from "@/components/survey/compliance/ComplianceDocuments";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, GitBranch, Send, BarChart3, Hammer, ShieldCheck, Calendar, Users, FileText } from "lucide-react";
import { toast } from "sonner";

type BuilderView = "build" | "consent" | "visits" | "participants" | "compliance" | "flow" | "distribute" | "results" | "preview";

const getViewFromPath = (pathname: string): BuilderView => {
  if (pathname.endsWith("/consent")) return "consent";
  if (pathname.endsWith("/visits")) return "visits";
  if (pathname.endsWith("/participants")) return "participants";
  if (pathname.endsWith("/compliance")) return "compliance";
  if (pathname.endsWith("/flow")) return "flow";
  if (pathname.endsWith("/distribute")) return "distribute";
  if (pathname.endsWith("/results")) return "results";
  if (pathname.endsWith("/preview")) return "preview";
  return "build";
};

const SurveyBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const store = useSurveyStore();
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const currentView = getViewFromPath(location.pathname);

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

  useEffect(() => () => store.resetStore(), []);

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
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
              <BlockSidebar />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={55} minSize={35}>
              <QuestionCanvas />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={27} minSize={20} maxSize={35}>
              <QuestionContextPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-14 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/surveys")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={store.survey.title}
          onChange={(e) => store.updateSurveyField("title", e.target.value)}
          className="max-w-xs border-none shadow-none text-base font-semibold focus-visible:ring-0 px-1"
        />
        <Tabs value={currentView} className="ml-auto">
          <TabsList className="h-9 flex-wrap">
            <TabsTrigger value="build" className="text-xs" onClick={() => navigate(`/surveys/${id}/build`)}>
              <Hammer className="h-3 w-3 mr-1" />
              {locale === "pt" ? "Construir" : "Build"}
            </TabsTrigger>
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
            <TabsTrigger value="flow" className="text-xs" onClick={() => navigate(`/surveys/${id}/flow`)}>
              <GitBranch className="h-3 w-3 mr-1" />
              {locale === "pt" ? "Fluxo" : "Flow"}
            </TabsTrigger>
            <TabsTrigger value="distribute" className="text-xs" onClick={() => navigate(`/surveys/${id}/distribute`)}>
              <Send className="h-3 w-3 mr-1" />
              {locale === "pt" ? "Distribuir" : "Distribute"}
            </TabsTrigger>
            <TabsTrigger value="results" className="text-xs" onClick={() => navigate(`/surveys/${id}/results`)}>
              <BarChart3 className="h-3 w-3 mr-1" />
              {locale === "pt" ? "Resultados" : "Results"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 ml-4">
          <Button variant="outline" size="sm" onClick={() => navigate(`/surveys/${id}/preview`)}>
            <Eye className="h-4 w-4 mr-1" />
            {locale === "pt" ? "Prévia" : "Preview"}
          </Button>
          <Button size="sm" onClick={save} disabled={!store.isDirty}>
            <Save className="h-4 w-4 mr-1" />
            {locale === "pt" ? "Salvar" : "Save"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">{renderContent()}</div>
    </div>
  );
};

export default SurveyBuilder;
