import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import ConsentRespond from "@/components/survey/consent/ConsentRespond";

type AnswerMap = Record<string, any>;

const SurveyRespond = () => {
  const { token } = useParams<{ token: string }>();
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [consentSignatureId, setConsentSignatureId] = useState<string | null>(null);
  const startTime = useRef(Date.now());

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

  // Evaluate logic rules to determine visible questions
  const visibleQuestions = useMemo(() => {
    const hiddenQuestionIds = new Set<string>();
    const hiddenBlockIds = new Set<string>();

    rules.forEach((rule: any) => {
      const condition = rule.condition as any;
      if (!condition?.field) return;

      const answer = answers[condition.field];
      let conditionMet = false;

      switch (condition.operator) {
        case "equal":
          conditionMet = String(answer) === String(condition.value);
          break;
        case "not_equal":
          conditionMet = String(answer) !== String(condition.value);
          break;
        case "greater_than":
          conditionMet = Number(answer) > Number(condition.value);
          break;
        case "contains":
          conditionMet = String(answer || "").toLowerCase().includes(String(condition.value).toLowerCase());
          break;
      }

      if (conditionMet) {
        if (rule.action === "hide_question" && rule.target_id) hiddenQuestionIds.add(rule.target_id);
        if (rule.action === "end_survey") {
          const sourceQ = allQuestions.find((q: any) => q.id === rule.source_question_id);
          if (sourceQ) {
            allQuestions.forEach((q: any) => {
              if (q.question_order > sourceQ.question_order) hiddenQuestionIds.add(q.id);
            });
          }
        }
      }
    });

    return allQuestions.filter((q: any) => !hiddenQuestionIds.has(q.id) && !hiddenBlockIds.has(q.block_id));
  }, [allQuestions, rules, answers]);

  const blockQuestions = useMemo(() => {
    if (!blocks.length) return [];
    const block = blocks[currentBlockIdx];
    if (!block) return [];
    return visibleQuestions.filter((q: any) => q.block_id === block.id);
  }, [blocks, currentBlockIdx, visibleQuestions]);

  const progress = blocks.length ? ((currentBlockIdx + 1) / blocks.length) * 100 : 0;

  const setAnswer = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmit = async () => {
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

  const isLastBlock = currentBlockIdx >= blocks.length - 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold">{survey.title}</h1>
          {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
          <Progress value={progress} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {currentBlockIdx + 1} / {blocks.length}
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {blocks[currentBlockIdx] && (
          <div className="mb-2">
            <h2 className="text-base font-medium">{blocks[currentBlockIdx].title}</h2>
            {blocks[currentBlockIdx].description && (
              <p className="text-sm text-muted-foreground">{blocks[currentBlockIdx].description}</p>
            )}
          </div>
        )}

        {blockQuestions.map((q: any) => (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-start gap-1">
                {q.question_text}
                {q.is_required && <span className="text-destructive">*</span>}
              </CardTitle>
              {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
            </CardHeader>
            <CardContent>
              <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            </CardContent>
          </Card>
        ))}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" disabled={currentBlockIdx === 0} onClick={() => setCurrentBlockIdx((p) => p - 1)}>
            Previous
          </Button>
          {isLastBlock ? (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit
            </Button>
          ) : (
            <Button onClick={() => setCurrentBlockIdx((p) => p + 1)}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Individual question input components ──────────────────────
const QuestionInput = ({ question, value, onChange }: { question: any; value: any; onChange: (v: any) => void }) => {
  const q = question;

  if (q.question_type === "multiple_choice") {
    const choices = (q.choices || []) as any[];
    const isMulti = q.settings?.allow_multiple;
    if (isMulti) {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {choices.map((c: any) => (
            <div key={c.id} className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes(c.text)}
                onCheckedChange={(checked) => {
                  onChange(checked ? [...selected, c.text] : selected.filter((s: string) => s !== c.text));
                }}
              />
              <Label className="text-sm font-normal">{c.text}</Label>
            </div>
          ))}
        </div>
      );
    }
    return (
      <RadioGroup value={value || ""} onValueChange={onChange}>
        {choices.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2">
            <RadioGroupItem value={c.text} id={c.id} />
            <Label htmlFor={c.id} className="text-sm font-normal">{c.text}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (q.question_type === "text_entry") {
    const isMultiline = q.settings?.multiline;
    if (isMultiline) {
      return <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Your answer..." rows={4} />;
    }
    return <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Your answer..." />;
  }

  if (q.question_type === "slider") {
    const min = q.settings?.min ?? 0;
    const max = q.settings?.max ?? 100;
    const step = q.settings?.step ?? 1;
    const val = value ?? min;
    return (
      <div className="space-y-3">
        <Slider value={[val]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}</span>
          <span className="font-medium text-foreground">{val}</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }

  if (q.question_type === "matrix_table") {
    const rows = (q.matrix_rows || []) as any[];
    const cols = (q.matrix_columns || []) as any[];
    const matrixVal = (typeof value === "object" && value !== null && !Array.isArray(value)) ? value : {};

    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 min-w-[120px]"></th>
              {cols.map((c: any) => (
                <th key={c.id} className="text-center p-2 text-xs font-medium min-w-[80px]">{c.text}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 text-sm">{r.text}</td>
                {cols.map((c: any) => (
                  <td key={c.id} className="text-center p-2">
                    <RadioGroup value={matrixVal[r.id] || ""} onValueChange={(v) => onChange({ ...matrixVal, [r.id]: v })} className="flex justify-center">
                      <RadioGroupItem value={c.id} />
                    </RadioGroup>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (q.question_type === "rank_order") {
    const choices = (q.choices || []) as any[];
    const ranked = Array.isArray(value) ? value : [];
    const unranked = choices.filter((c: any) => !ranked.includes(c.text));
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">Click items in order of preference</p>
        {ranked.map((item: string, idx: number) => (
          <div key={item} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded px-3 py-2 text-sm cursor-pointer" onClick={() => onChange(ranked.filter((r: string) => r !== item))}>
            <span className="text-xs font-bold text-primary w-5">{idx + 1}.</span>
            {item}
          </div>
        ))}
        {unranked.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer hover:bg-muted/50" onClick={() => onChange([...ranked, c.text])}>
            {c.text}
          </div>
        ))}
      </div>
    );
  }

  if (q.question_type === "constant_sum") {
    const choices = (q.choices || []) as any[];
    const vals = (typeof value === "object" && value !== null && !Array.isArray(value)) ? value : {};
    const total = Object.values(vals).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    const target = q.settings?.total ?? 100;
    return (
      <div className="space-y-3">
        {choices.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3">
            <Label className="text-sm min-w-[120px]">{c.text}</Label>
            <Input
              type="number"
              value={vals[c.id] || ""}
              onChange={(e) => onChange({ ...vals, [c.id]: Number(e.target.value) || 0 })}
              className="w-24"
            />
          </div>
        ))}
        <p className={`text-xs ${total === target ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
          Total: {total} / {target}
        </p>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Unsupported question type</p>;
};

export default SurveyRespond;
