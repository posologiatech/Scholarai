import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import ConsentRespond from "@/components/survey/consent/ConsentRespond";
import { evaluateVisibility, findMissingRequired } from "@/lib/survey/surveyLogic";
import QuestionRenderer from "@/components/survey/builder/QuestionRenderer";
import type { SurveyBranding } from "@/components/survey/distribution/BrandingTab";
import { cn } from "@/lib/utils";

type AnswerMap = Record<string, any>;

// Deterministic per-respondent randomization: a stable seed (picked once per response,
// not per render) drives a seeded shuffle, so block/choice order is randomized but doesn't
// re-shuffle under the respondent's feet on every re-render.
function hashSeed(str: string, base: number): number {
  let h = base;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const SurveyRespond = () => {
  const { token } = useParams<{ token: string }>();
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [consentSignatureId, setConsentSignatureId] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const startTime = useRef(Date.now());
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  // Load survey via distribution token
  const { data: surveyData, isLoading, isError } = useQuery({
    queryKey: ["survey-respond", token],
    queryFn: async () => {
      const { data: dist, error: distErr } = await supabase
        .rpc("get_distribution_by_token", { _token: token! })
        .maybeSingle();

      if (distErr || !dist) throw new Error("Invalid survey link");


      const [surveyRes, blocksRes, questionsRes, rulesRes, consentRes] = await Promise.all([
        supabase.from("surveys").select("*").eq("id", dist.survey_id).single(),
        supabase.from("survey_blocks").select("*").eq("survey_id", dist.survey_id).order("block_order"),
        supabase.from("survey_questions").select("*").eq("survey_id", dist.survey_id).order("question_order"),
        supabase.from("survey_logic_rules").select("*").eq("survey_id", dist.survey_id),
        supabase.from("study_consents").select("*").eq("survey_id", dist.survey_id).maybeSingle(),
      ]);

      if (surveyRes.error) throw new Error("Survey not found");
      return {
        survey: surveyRes.data,
        blocks: blocksRes.data || [],
        questions: questionsRes.data || [],
        rules: rulesRes.data || [],
        consent: consentRes.data,
      };
    },
    enabled: !!token,
  });

  const survey = surveyData?.survey;
  const branding: SurveyBranding = (survey?.settings as any)?.branding || {};
  const brandColor = branding.color || null;
  const blocks = surveyData?.blocks || [];
  const allQuestions = surveyData?.questions || [];
  const rules = surveyData?.rules || [];
  const consent = surveyData?.consent;

  // If there's a consent and it hasn't been completed, show consent flow
  const needsConsent = !!consent && !consentCompleted;

  const handleConsentComplete = useCallback((signatureId: string) => {
    setConsentSignatureId(signatureId);
    setConsentCompleted(true);
    startTime.current = Date.now(); // Reset timer for actual survey
  }, []);

  // Evaluate logic rules to determine which questions and blocks are visible, via the same
  // engine the builder's preview runs (src/lib/survey/surveyLogic.ts) — every action the
  // builder (ConditionBuilder.tsx) offers has to actually do something here, and it has to
  // match what the researcher saw in preview.
  const { visibleQuestions, visibleBlocks } = useMemo(
    () => evaluateVisibility(allQuestions, blocks, rules, answers),
    [allQuestions, blocks, rules, answers]
  );

  const blockQuestions = useMemo(() => {
    if (!visibleBlocks.length) return [];
    const block = visibleBlocks[currentBlockIdx];
    if (!block) return [];
    let qs = visibleQuestions.filter((q: any) => q.block_id === block.id);
    // Block-level question order randomization (randomize_questions) and per-question
    // choice randomization (settings.randomize) were both stored but never applied —
    // wire them up here, seeded so order is stable within this response.
    if (block.randomize_questions) {
      qs = seededShuffle(qs, hashSeed(block.id, seed));
    }
    return qs.map((q: any) =>
      q.settings?.randomize && Array.isArray(q.choices) && q.choices.length > 1
        ? { ...q, choices: seededShuffle(q.choices, hashSeed(q.id, seed)) }
        : q
    );
  }, [visibleBlocks, currentBlockIdx, visibleQuestions, seed]);

  const progress = visibleBlocks.length ? ((currentBlockIdx + 1) / visibleBlocks.length) * 100 : 0;

  const missingRequired = useMemo(() => findMissingRequired(blockQuestions, answers), [blockQuestions, answers]);
  const missingRequiredIds = useMemo(() => new Set(missingRequired.map((q) => q.id)), [missingRequired]);

  useEffect(() => setValidationAttempted(false), [currentBlockIdx]);

  const setAnswer = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmit = async () => {
    if (missingRequired.length > 0) { setValidationAttempted(true); return; }
    setSubmitting(true);
    setError(null);
    try {
      const duration = Math.round((Date.now() - startTime.current) / 1000);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/survey-respond`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          answers,
          metadata: {
            duration_seconds: duration,
            consent_signature_id: consentSignatureId,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Submission failed");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">Survey not found</p>
            <p className="text-sm text-muted-foreground">This link may be invalid or the survey has been closed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (survey.status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-lg font-semibold">
              {survey.status === "closed" ? "This survey is closed" : "This survey isn't open yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {survey.status === "closed"
                ? "It is no longer accepting responses."
                : "The researcher hasn't published it yet — check back later."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show consent flow first if needed
  if (needsConsent) {
    return (
      <div className="min-h-screen bg-background">
        <ConsentRespond
          consent={{
            id: consent.id,
            title: consent.title,
            sections: consent.sections as any,
            video_url: consent.video_url,
            audio_url: consent.audio_url,
            require_signature: consent.require_signature,
          }}
          onConsentComplete={handleConsentComplete}
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-[hsl(var(--success))] mx-auto" />
            <h2 className="text-xl font-semibold">Thank you!</h2>
            <p className="text-sm text-muted-foreground">Your response has been recorded successfully.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLastBlock = currentBlockIdx >= visibleBlocks.length - 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-5">
          {(branding.logoUrl || branding.displayName) && (
            <div className="flex items-center gap-2 mb-2">
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="" className="h-6 w-6 rounded object-contain shrink-0" />
              )}
              {branding.displayName && (
                <span className="text-xs font-medium text-muted-foreground truncate">{branding.displayName}</span>
              )}
            </div>
          )}
          <h1 className="text-lg font-semibold">{survey.title}</h1>
          {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
          <div className="h-2 w-full rounded-full bg-secondary mt-3 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", !brandColor && "bg-primary")}
              style={{ width: `${progress}%`, ...(brandColor ? { backgroundColor: brandColor } : {}) }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {currentBlockIdx + 1} / {visibleBlocks.length}
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {visibleBlocks[currentBlockIdx] && (
          <div className="mb-2">
            <h2 className="text-base font-medium">{visibleBlocks[currentBlockIdx].title}</h2>
            {visibleBlocks[currentBlockIdx].description && (
              <p className="text-sm text-muted-foreground">{visibleBlocks[currentBlockIdx].description}</p>
            )}
          </div>
        )}

        {blockQuestions.map((q: any) => {
          const showError = validationAttempted && missingRequiredIds.has(q.id);
          return (
            <Card key={q.id} className={cn(showError && "border-destructive")}>
              <CardContent className="pt-6">
                <QuestionRenderer question={q} respondMode value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
                {showError && (
                  <p className="text-xs text-destructive mt-2">Esta questão é obrigatória.</p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4">
          <Button variant="outline" disabled={currentBlockIdx === 0} onClick={() => setCurrentBlockIdx((p) => p - 1)}>
            Previous
          </Button>
          {isLastBlock ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              style={brandColor ? { backgroundColor: brandColor } : undefined}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit
            </Button>
          ) : (
            <Button
              style={brandColor ? { backgroundColor: brandColor } : undefined}
              onClick={() => {
                if (missingRequired.length > 0) { setValidationAttempted(true); return; }
                setCurrentBlockIdx((p) => p + 1);
              }}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyRespond;
