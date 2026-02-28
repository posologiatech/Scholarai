import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
// AppSidebar provided by ProtectedRoute
import ReviewStepper from "@/components/app/systematic-review/ReviewStepper";
import StepQuestion from "@/components/app/systematic-review/StepQuestion";
import StepCollection from "@/components/app/systematic-review/StepCollection";
import StepScreening from "@/components/app/systematic-review/StepScreening";
import StepExtraction from "@/components/app/systematic-review/StepExtraction";
import StepReport from "@/components/app/systematic-review/StepReport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SystematicReview = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuestion = searchParams.get("q") || "";
  const autoSuggestions = searchParams.get("auto") !== "false";
  const reviewId = searchParams.get("id");

  const [currentStep, setCurrentStep] = useState(0);
  const [dbId, setDbId] = useState<string | null>(reviewId);
  const [question, setQuestion] = useState(initialQuestion);
  const [papers, setPapers] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [screeningResults, setScreeningResults] = useState<Record<string, any>>({});
  const [includedPaperIds, setIncludedPaperIds] = useState<string[]>([]);
  const [extractionColumns, setExtractionColumns] = useState<any[]>([]);
  const [extractionResults, setExtractionResults] = useState<Record<string, Record<string, string>>>({});
  const [reportContent, setReportContent] = useState("");

  // Load existing review if id is provided
  useEffect(() => {
    if (reviewId) {
      loadReview(reviewId);
    }
  }, [reviewId]);

  const loadReview = async (id: string) => {
    const { data, error } = await supabase
      .from("systematic_reviews")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return;
    setQuestion(data.research_question);
    setPapers(data.papers as any[]);
    setCriteria(data.screening_criteria as any[]);
    setScreeningResults(data.screening_results as Record<string, any>);
    setIncludedPaperIds(data.included_paper_ids || []);
    setExtractionColumns(data.extraction_columns as any[]);
    setExtractionResults(data.extraction_results as Record<string, Record<string, string>>);
    setReportContent(data.report_content || "");
  };

  // Auto-save with debounce
  const saveReview = useCallback(async () => {
    if (!user?.id || !question.trim()) return;

    const payload = {
      user_id: user.id,
      research_question: question,
      auto_suggestions: autoSuggestions,
      status: currentStep >= 4 ? "complete" : currentStep >= 3 ? "extracting" : currentStep >= 2 ? "screening" : "draft",
      papers: papers as any,
      screening_criteria: criteria as any,
      screening_results: screeningResults as any,
      extraction_columns: extractionColumns as any,
      extraction_results: extractionResults as any,
      included_paper_ids: includedPaperIds,
      report_content: reportContent,
      updated_at: new Date().toISOString(),
    };

    try {
      if (dbId) {
        await supabase.from("systematic_reviews").update(payload).eq("id", dbId);
      } else {
        const { data, error } = await supabase.from("systematic_reviews").insert(payload).select("id").single();
        if (data) setDbId(data.id);
      }
    } catch (err) {
      console.error("Failed to save review:", err);
    }
  }, [user?.id, question, currentStep, papers, criteria, screeningResults, extractionColumns, extractionResults, includedPaperIds, reportContent, dbId, autoSuggestions]);

  // Save on step change
  useEffect(() => {
    const timeout = setTimeout(saveReview, 2000);
    return () => clearTimeout(timeout);
  }, [currentStep, papers, criteria, screeningResults, extractionColumns, extractionResults, includedPaperIds, reportContent]);

  const screenedCount = Object.keys(screeningResults).length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      
      <div className="border-b border-border bg-card px-4 py-3">
        <ReviewStepper currentStep={currentStep} onStepClick={setCurrentStep} />
      </div>

      <main className="flex-1 px-4 py-8">
        {currentStep === 0 && (
          <StepQuestion
            question={question}
            onQuestionChange={setQuestion}
            onNext={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 1 && (
          <StepCollection
            question={question}
            papers={papers}
            onPapersChange={setPapers}
            onNext={() => setCurrentStep(2)}
            onPrev={() => setCurrentStep(0)}
          />
        )}
        {currentStep === 2 && (
          <StepScreening
            question={question}
            papers={papers}
            criteria={criteria}
            onCriteriaChange={setCriteria}
            screeningResults={screeningResults}
            onScreeningResultsChange={setScreeningResults}
            includedPaperIds={includedPaperIds}
            onIncludedPaperIdsChange={setIncludedPaperIds}
            autoSuggestions={autoSuggestions}
            onNext={() => setCurrentStep(3)}
            onPrev={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <StepExtraction
            question={question}
            papers={papers}
            includedPaperIds={includedPaperIds}
            columns={extractionColumns}
            onColumnsChange={setExtractionColumns}
            extractionResults={extractionResults}
            onExtractionResultsChange={setExtractionResults}
            autoSuggestions={autoSuggestions}
            onNext={() => setCurrentStep(4)}
            onPrev={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
          <StepReport
            question={question}
            papers={papers}
            includedPaperIds={includedPaperIds}
            totalPapers={papers.length}
            screenedCount={screenedCount}
            criteria={criteria}
            screeningResults={screeningResults}
            extractionColumns={extractionColumns}
            extractionResults={extractionResults}
            reportContent={reportContent}
            onReportChange={setReportContent}
            onPrev={() => setCurrentStep(3)}
          />
        )}
      </main>
    </div>
  );
};

export default SystematicReview;
