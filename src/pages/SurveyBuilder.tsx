import { useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import AppSidebar from "@/components/app/AppSidebar";
import BlockSidebar from "@/components/survey/builder/BlockSidebar";
import QuestionCanvas from "@/components/survey/builder/QuestionCanvas";
import QuestionContextPanel from "@/components/survey/builder/QuestionContextPanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, GitBranch, Send, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const SurveyBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const store = useSurveyStore();
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

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
        .update({ title: store.survey.title, description: store.survey.description, settings: store.survey.settings, updated_at: new Date().toISOString() })
        .eq("id", store.survey.id);

      // Upsert blocks
      for (const block of store.blocks) {
        await supabase.from("survey_blocks").upsert(block, { onConflict: "id" });
      }
      // Upsert questions
      for (const q of store.questions) {
        await supabase.from("survey_questions").upsert(q as any, { onConflict: "id" });
      }
      store.markClean();
    } catch {
      toast.error("Failed to save");
    }
  }, [store.survey, store.blocks, store.questions, store.isDirty]);

  useEffect(() => {
    if (!store.isDirty) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(save, 2000);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [store.isDirty, save]);

  // Cleanup
  useEffect(() => () => store.resetStore(), []);

  if (isLoading || !store.survey) {
    return (
      <AppSidebar>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar>
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
          <Tabs defaultValue="build" className="ml-auto">
            <TabsList className="h-9">
              <TabsTrigger value="build" className="text-xs" onClick={() => {}}>
                {locale === "pt" ? "Construir" : "Build"}
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

        {/* 3-pane layout */}
        <div className="flex-1 min-h-0">
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
        </div>
      </div>
    </AppSidebar>
  );
};

export default SurveyBuilder;
