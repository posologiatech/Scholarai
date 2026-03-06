import { useState, useMemo, useCallback, useRef } from "react";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Smartphone, Monitor } from "lucide-react";

type AnswerMap = Record<string, any>;

const SurveyPreviewPanel = () => {
  const { locale } = useLanguage();
  const { survey, blocks, questions, logicRules } = useSurveyStore();
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [mobileView, setMobileView] = useState(false);

  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.block_order - b.block_order), [blocks]);

  const visibleQuestions = useMemo(() => {
    const hiddenIds = new Set<string>();
    logicRules.forEach((rule) => {
      const cond = rule.condition;
      if (!cond?.field) return;
      const answer = answers[cond.field];
      let met = false;
      switch (cond.operator) {
        case "equal": met = String(answer) === String(cond.value); break;
        case "not_equal": met = String(answer) !== String(cond.value); break;
        case "greater_than": met = Number(answer) > Number(cond.value); break;
        case "contains": met = String(answer || "").toLowerCase().includes(String(cond.value).toLowerCase()); break;
      }
      if (met) {
        if (rule.action === "hide_question" && rule.target_id) hiddenIds.add(rule.target_id);
        if (rule.action === "end_survey") {
          const srcQ = questions.find((q) => q.id === rule.source_question_id);
          if (srcQ) questions.forEach((q) => { if (q.question_order > srcQ.question_order) hiddenIds.add(q.id); });
        }
      }
    });
    return questions.filter((q) => !hiddenIds.has(q.id));
  }, [questions, logicRules, answers]);

  const blockQuestions = useMemo(() => {
    const block = sortedBlocks[currentBlockIdx];
    if (!block) return [];
    return visibleQuestions.filter((q) => q.block_id === block.id).sort((a, b) => a.question_order - b.question_order);
  }, [sortedBlocks, currentBlockIdx, visibleQuestions]);

  const progress = sortedBlocks.length ? ((currentBlockIdx + 1) / sortedBlocks.length) * 100 : 0;

  const reset = () => { setAnswers({}); setCurrentBlockIdx(0); setSubmitted(false); };

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
                {sortedBlocks[currentBlockIdx] && (
                  <h2 className="text-base font-medium">{sortedBlocks[currentBlockIdx].title}</h2>
                )}
                {blockQuestions.map((q) => (
                  <Card key={q.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-start gap-1">
                        {q.question_text || "Untitled"}
                        {q.is_required && <span className="text-destructive">*</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PreviewQuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))} />
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" disabled={currentBlockIdx === 0} onClick={() => setCurrentBlockIdx((p) => p - 1)}>
                    {locale === "pt" ? "Anterior" : "Previous"}
                  </Button>
                  {currentBlockIdx >= sortedBlocks.length - 1 ? (
                    <Button onClick={() => setSubmitted(true)}>{locale === "pt" ? "Enviar" : "Submit"}</Button>
                  ) : (
                    <Button onClick={() => setCurrentBlockIdx((p) => p + 1)}>{locale === "pt" ? "Próximo" : "Next"}</Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PreviewQuestionInput = ({ question: q, value, onChange }: { question: any; value: any; onChange: (v: any) => void }) => {
  if (q.question_type === "multiple_choice") {
    const choices = (q.choices || []) as any[];
    return (
      <RadioGroup value={value || ""} onValueChange={onChange}>
        {choices.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2">
            <RadioGroupItem value={c.text} id={`prev-${c.id}`} />
            <Label htmlFor={`prev-${c.id}`} className="text-sm font-normal">{c.text}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  }
  if (q.question_type === "text_entry") {
    return q.settings?.multiline
      ? <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} />
      : <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (q.question_type === "slider") {
    const min = q.settings?.min ?? 0, max = q.settings?.max ?? 100, step = q.settings?.step ?? 1;
    const val = value ?? min;
    return (
      <div className="space-y-2">
        <Slider value={[val]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
        <div className="flex justify-between text-xs text-muted-foreground"><span>{min}</span><span className="font-medium text-foreground">{val}</span><span>{max}</span></div>
      </div>
    );
  }
  if (q.question_type === "matrix_table") {
    const rows = (q.matrix_rows || []) as any[], cols = (q.matrix_columns || []) as any[];
    const mv = (typeof value === "object" && value && !Array.isArray(value)) ? value : {};
    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead><tr><th className="text-left p-2"></th>{cols.map((c: any) => <th key={c.id} className="text-center p-2 text-xs">{c.text}</th>)}</tr></thead>
          <tbody>{rows.map((r: any) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 text-sm">{r.text}</td>
              {cols.map((c: any) => (
                <td key={c.id} className="text-center p-2">
                  <RadioGroup value={mv[r.id] || ""} onValueChange={(v) => onChange({ ...mv, [r.id]: v })} className="flex justify-center">
                    <RadioGroupItem value={c.id} />
                  </RadioGroup>
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  if (q.question_type === "rank_order") {
    const choices = (q.choices || []) as any[];
    const ranked = Array.isArray(value) ? value : [];
    const unranked = choices.filter((c: any) => !ranked.includes(c.text));
    return (
      <div className="space-y-1.5">
        {ranked.map((item: string, idx: number) => (
          <div key={item} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded px-3 py-1.5 text-sm cursor-pointer" onClick={() => onChange(ranked.filter((r: string) => r !== item))}>
            <span className="text-xs font-bold text-primary w-5">{idx + 1}.</span>{item}
          </div>
        ))}
        {unranked.map((c: any) => (
          <div key={c.id} className="border rounded px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50" onClick={() => onChange([...ranked, c.text])}>{c.text}</div>
        ))}
      </div>
    );
  }
  if (q.question_type === "constant_sum") {
    const choices = (q.choices || []) as any[];
    const vals = (typeof value === "object" && value && !Array.isArray(value)) ? value : {};
    const total = Object.values(vals).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    const target = q.settings?.total ?? 100;
    return (
      <div className="space-y-2">
        {choices.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3">
            <Label className="text-sm min-w-[100px]">{c.text}</Label>
            <Input type="number" value={vals[c.id] || ""} onChange={(e) => onChange({ ...vals, [c.id]: Number(e.target.value) || 0 })} className="w-20" />
          </div>
        ))}
        <p className={`text-xs ${total === target ? "text-[hsl(var(--success))]" : "text-destructive"}`}>Total: {total} / {target}</p>
      </div>
    );
  }
  return null;
};

export default SurveyPreviewPanel;
