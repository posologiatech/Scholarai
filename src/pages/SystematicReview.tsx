import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import ReviewStepper from "@/components/app/systematic-review/ReviewStepper";
import StepQuestion from "@/components/app/systematic-review/StepQuestion";
import StepCollection from "@/components/app/systematic-review/StepCollection";
import StepScreening from "@/components/app/systematic-review/StepScreening";
import StepExtraction from "@/components/app/systematic-review/StepExtraction";
import StepQuality from "@/components/app/systematic-review/StepQuality";
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
  const [qualityResults, setQualityResults] = useState<Record<string, any>>({});
  const [reportContent, setReportContent] = useState("");
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);

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

  const saveReview = useCallback(async () => {
    if (!user?.id || !question.trim()) return;

    const payload = {
      user_id: user.id,
      research_question: question,
      auto_suggestions: autoSuggestions,
      status: currentStep >= 5 ? "complete" : currentStep >= 4 ? "quality" : currentStep >= 3 ? "extracting" : currentStep >= 2 ? "screening" : "draft",
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

  useEffect(() => {
    const timeout = setTimeout(saveReview, 2000);
    return () => clearTimeout(timeout);
  }, [currentStep, papers, criteria, screeningResults, extractionColumns, extractionResults, includedPaperIds, reportContent]);

  const screenedCount = Object.keys(screeningResults).length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
        <ReviewStepper currentStep={currentStep} onStepClick={setCurrentStep} />
        {dbId && (
          <LinkToProjectButton
            resourceType="systematic_review"
            resourceId={dbId}
            label={question || (locale === "pt" ? "Revisão sistemática" : "Systematic review")}
            attachTable="systematic_reviews"
            variant="outline"
            metadata={{ included: includedPaperIds.length, total: papers.length }}
            onLinked={async (projectId) => {
              try {
                const included = papers.filter((p: any) =>
                  includedPaperIds.includes(p.id || p.paperId || p.external_id),
                );
                const toImport = (included.length ? included : papers).map((p: any) => ({
                  external_paper_id: p.id || p.external_id || null,
                  title: p.title || "(sem título)",
                  authors: Array.isArray(p.authors) ? p.authors.join(", ") : (p.authors || null),
                  year: p.year || null,
                  doi: p.doi || null,
                }));
                const n = await importPapersToReferences(projectId, toImport);
                if (n > 0) toast.success(locale === "pt" ? `${n} referência(s) importada(s)` : `${n} reference(s) imported`);
              } catch { /* non-blocking */ }
            }}
          />
        )}
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
            duplicatesRemoved={duplicatesRemoved}
            onDuplicatesRemovedChange={setDuplicatesRemoved}
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
          <StepQuality
            question={question}
            papers={papers}
            includedPaperIds={includedPaperIds}
            qualityResults={qualityResults}
            onQualityResultsChange={setQualityResults}
            onNext={() => setCurrentStep(5)}
            onPrev={() => setCurrentStep(3)}
          />
        )}
        {currentStep === 5 && (
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
            onPrev={() => setCurrentStep(4)}
            duplicatesRemoved={duplicatesRemoved}
          />
        )}
      </main>
    </div>
  );
};

export default SystematicReview;
