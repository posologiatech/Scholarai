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
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { useProjectLinkedIds } from "@/hooks/useProjectLinkedIds";
import { importPapersToReferences } from "@/lib/research/integrations";
import { buildProtocolDocument, type Pico } from "@/lib/systematicReview/protocol";

const SystematicReview = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuestion = searchParams.get("q") || "";
  const autoSuggestions = searchParams.get("auto") !== "false";
  const reviewId = searchParams.get("id");
  const linkedReviewIds = useProjectLinkedIds("systematic_review");

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
  const [pico, setPico] = useState<Pico>({});
  const [searchStrategy, setSearchStrategy] = useState("");
  const [prosperoId, setProsperoId] = useState("");
  const [protocolLockedAt, setProtocolLockedAt] = useState<string | null>(null);
  const [protocolLockedBy, setProtocolLockedBy] = useState<string | null>(null);
  const [protocolDocument, setProtocolDocument] = useState<string | null>(null);
  const [researchProjectId, setResearchProjectId] = useState<string | null>(null);
  const [reviewOwnerId, setReviewOwnerId] = useState<string | null>(null);
  const isOwner = !dbId || !reviewOwnerId || reviewOwnerId === user?.id;

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
    setPico((data.pico as Pico) || {});
    setSearchStrategy(data.search_strategy || "");
    setProsperoId(data.prospero_id || "");
    setProtocolLockedAt(data.protocol_locked_at || null);
    setProtocolLockedBy(data.protocol_locked_by || null);
    setProtocolDocument(data.protocol_document || null);
    setResearchProjectId(data.research_project_id || null);
    setReviewOwnerId(data.user_id || null);
  };

  const buildPayload = useCallback(() => ({
    user_id: user?.id,
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
    pico: pico as any,
    search_strategy: searchStrategy,
    prospero_id: prosperoId || null,
    protocol_locked_at: protocolLockedAt,
    protocol_locked_by: protocolLockedBy,
    protocol_document: protocolDocument,
    updated_at: new Date().toISOString(),
  }), [user?.id, question, currentStep, papers, criteria, screeningResults, extractionColumns, extractionResults, includedPaperIds, reportContent, pico, searchStrategy, prosperoId, protocolLockedAt, protocolLockedBy, protocolDocument, autoSuggestions]);

  const saveReview = useCallback(async () => {
    if (!user?.id || !question.trim() || !isOwner) return;
    const payload = buildPayload();
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
  }, [user?.id, question, dbId, buildPayload, isOwner]);

  useEffect(() => {
    const timeout = setTimeout(saveReview, 2000);
    return () => clearTimeout(timeout);
  }, [currentStep, papers, criteria, screeningResults, extractionColumns, extractionResults, includedPaperIds, reportContent, pico, searchStrategy, prosperoId]);

  const registerProtocol = useCallback(async () => {
    if (!user?.id || !question.trim() || !isOwner) return;
    const lockedAt = new Date().toISOString();
    const document = buildProtocolDocument({
      question,
      pico,
      criteria: criteria.filter((c) => c.enabled !== false),
      searchStrategy,
      prosperoId,
      lockedAt,
      locale: locale as "pt" | "en",
    });
    const payload = {
      ...buildPayload(),
      protocol_locked_at: lockedAt,
      protocol_locked_by: user.id,
      protocol_document: document,
    };
    try {
      let id = dbId;
      if (id) {
        await supabase.from("systematic_reviews").update(payload).eq("id", id);
      } else {
        const { data, error } = await supabase.from("systematic_reviews").insert(payload).select("id").single();
        if (error) throw error;
        id = data?.id || null;
        setDbId(id);
      }
      setProtocolLockedAt(lockedAt);
      setProtocolLockedBy(user.id);
      setProtocolDocument(document);
      toast.success(locale === "pt" ? "Protocolo registrado e bloqueado" : "Protocol registered and locked");
    } catch (err: any) {
      console.error("Failed to register protocol:", err);
      toast.error(err.message || (locale === "pt" ? "Falha ao registrar protocolo" : "Failed to register protocol"));
    }
  }, [user?.id, question, pico, criteria, searchStrategy, prosperoId, dbId, buildPayload, locale, isOwner]);

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
            linked={linkedReviewIds.has(dbId)}
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
              setResearchProjectId(projectId);
            }}
          />
        )}
      </div>

      <main className="flex-1 px-4 py-8">
        {currentStep === 0 && (
          <StepQuestion
            question={question}
            onQuestionChange={setQuestion}
            pico={pico}
            onPicoChange={setPico}
            locked={!!protocolLockedAt}
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
            searchStrategy={searchStrategy}
            onSearchStrategyChange={setSearchStrategy}
            locked={!!protocolLockedAt}
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
            pico={pico}
            searchStrategy={searchStrategy}
            prosperoId={prosperoId}
            onProsperoIdChange={setProsperoId}
            protocolLockedAt={protocolLockedAt}
            protocolDocument={protocolDocument}
            onRegisterProtocol={registerProtocol}
            reviewId={dbId}
            researchProjectId={researchProjectId}
            isOwner={isOwner}
            reviewOwnerId={reviewOwnerId || user?.id || null}
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
