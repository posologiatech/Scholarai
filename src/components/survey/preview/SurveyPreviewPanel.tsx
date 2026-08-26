import { useState, useMemo, useEffect } from "react";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { evaluateVisibility, findMissingRequired } from "@/lib/survey/surveyLogic";
import QuestionRenderer from "@/components/survey/builder/QuestionRenderer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type AnswerMap = Record<string, any>;

const SurveyPreviewPanel = () => {
  const { locale } = useLanguage();
  const { survey, blocks, questions, logicRules } = useSurveyStore();
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.block_order - b.block_order), [blocks]);

  // Same engine the real respondent's page runs — a rule that behaves one way here and
  // another way in production is worse than no preview at all.
  const { visibleQuestions, visibleBlocks } = useMemo(
    () => evaluateVisibility(questions, sortedBlocks, logicRules, answers),
    [questions, sortedBlocks, logicRules, answers]
  );

  const blockQuestions = useMemo(() => {
    const block = visibleBlocks[currentBlockIdx];
    if (!block) return [];
    return visibleQuestions.filter((q) => q.block_id === block.id).sort((a, b) => a.question_order - b.question_order);
  }, [visibleBlocks, currentBlockIdx, visibleQuestions]);

  const missingRequired = useMemo(() => findMissingRequired(blockQuestions, answers), [blockQuestions, answers]);
  const missingRequiredIds = useMemo(() => new Set(missingRequired.map((q) => q.id)), [missingRequired]);

  useEffect(() => setValidationAttempted(false), [currentBlockIdx]);

  const progress = visibleBlocks.length ? ((currentBlockIdx + 1) / visibleBlocks.length) * 100 : 0;
  const isLastBlock = currentBlockIdx >= visibleBlocks.length - 1;

  const reset = () => { setAnswers({}); setCurrentBlockIdx(0); setSubmitted(false); setValidationAttempted(false); };

  const goNext = () => {
    if (missingRequired.length > 0) { setValidationAttempted(true); return; }
    if (isLastBlock) setSubmitted(true);
    else setCurrentBlockIdx((p) => p + 1);
  };

  if (!survey || !blocks.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {locale === "pt" ? "Adicione blocos e questões para visualizar" : "Add blocks and questions to preview"}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-muted/30">
      {/* Controls bar */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 flex items-center gap-3">
        <Badge variant="outline" className="text-xs">{locale === "pt" ? "Modo Prévia" : "Preview Mode"}</Badge>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant={mobileView ? "ghost" : "secondary"} size="icon" className="h-7 w-7" onClick={() => setMobileView(false)}>
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button variant={mobileView ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setMobileView(true)}>
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1">
          <RotateCcw className="h-3 w-3" />
          {locale === "pt" ? "Reiniciar" : "Reset"}
        </Button>
      </div>

      {/* Preview frame */}
      <div className="flex justify-center py-6 px-4">
        <div className={`w-full transition-all ${mobileView ? "max-w-[375px]" : "max-w-2xl"} ${mobileView ? "border rounded-2xl shadow-lg overflow-hidden bg-background" : ""}`}>
          {submitted ? (
            <div className="py-16 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-[hsl(var(--success))] mx-auto" />
              <h2 className="text-xl font-semibold">{locale === "pt" ? "Obrigado!" : "Thank you!"}</h2>
              <p className="text-sm text-muted-foreground">{locale === "pt" ? "Sua resposta foi registrada." : "Your response has been recorded."}</p>
              <Button variant="outline" onClick={reset}>{locale === "pt" ? "Responder novamente" : "Respond again"}</Button>
            </div>
          ) : (
            <div className={mobileView ? "p-4" : ""}>
              {/* Header */}
              <div className={`border-b bg-card ${mobileView ? "px-4 py-3" : "px-6 py-4"}`}>
                <h1 className="text-lg font-semibold">{survey.title}</h1>
                {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
                <Progress value={progress} className="mt-3 h-2" />
              </div>

              {/* Questions */}
              <div className={`space-y-4 ${mobileView ? "px-4 py-4" : "px-6 py-6"}`}>
                {visibleBlocks[currentBlockIdx] && (
                  <h2 className="text-base font-medium">{visibleBlocks[currentBlockIdx].title}</h2>
                )}
                {blockQuestions.map((q) => {
                  const showError = validationAttempted && missingRequiredIds.has(q.id);
                  return (
                    <Card key={q.id} className={cn(showError && "border-destructive")}>
                      <CardContent className="pt-6">
                        <QuestionRenderer
                          question={q}
                          respondMode
                          value={answers[q.id]}
                          onChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
                        />
                        {showError && (
                          <p className="text-xs text-destructive mt-2">
                            {locale === "pt" ? "Esta questão é obrigatória." : "This question is required."}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" disabled={currentBlockIdx === 0} onClick={() => setCurrentBlockIdx((p) => p - 1)}>
                    {locale === "pt" ? "Anterior" : "Previous"}
                  </Button>
                  <Button onClick={goNext}>
                    {isLastBlock ? (locale === "pt" ? "Enviar" : "Submit") : (locale === "pt" ? "Próximo" : "Next")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyPreviewPanel;
