import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { exportSurveyToDataMind } from "@/lib/survey/datamindExport";

/** Sends the current survey's collected data to DataMind, linked to its research project (if any). */
export function useSurveyDataMindExport(surveyId: string) {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const store = useSurveyStore();
  const [isExporting, setIsExporting] = useState(false);

  const exportToDataMind = useCallback(async () => {
    if (!user) { toast.error(locale === "pt" ? "Login necessário" : "Login required"); return; }
    setIsExporting(true);
    try {
      const { conversationId } = await exportSurveyToDataMind({
        surveyId,
        surveyTitle: store.survey?.title || "",
        researchProjectId: store.survey?.research_project_id ?? null,
        userId: user.id,
        locale,
      });
      toast.success(locale === "pt" ? "Dados enviados para DataMind!" : "Data sent to DataMind!");
      navigate(`/datamind/${conversationId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      if (message === "NO_DATA") {
        toast.error(locale === "pt" ? "Sem dados para exportar" : "No data to export");
      } else {
        console.error(err);
        toast.error(message || "Export failed");
      }
    } finally {
      setIsExporting(false);
    }
  }, [user, locale, navigate, store.survey, surveyId]);

  return { exportToDataMind, isExporting };
}
