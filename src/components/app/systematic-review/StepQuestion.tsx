import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import QuestionEvaluator, { type Evaluation } from "@/components/app/QuestionEvaluator";
import { ArrowRight, Lightbulb } from "lucide-react";
import { useState } from "react";
import type { Pico } from "@/lib/systematicReview/protocol";

interface StepQuestionProps {
  question: string;
  onQuestionChange: (q: string) => void;
  pico: Pico;
  onPicoChange: (pico: Pico) => void;
  locked?: boolean;
  onNext: () => void;
}

const StepQuestion = ({ question, onQuestionChange, pico, onPicoChange, locked, onNext }: StepQuestionProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  const picoField = (key: keyof Pico, label: string, placeholder: string) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={pico[key] || ""}
        onChange={(e) => onPicoChange({ ...pico, [key]: e.target.value })}
        placeholder={placeholder}
        disabled={locked}
        className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Lightbulb className="h-4 w-4" />
          {pt ? "Etapa 1: Pergunta de Pesquisa" : "Step 1: Research Question"}
        </div>
        <p className="text-sm text-muted-foreground">
          {pt
            ? "Uma boa pergunta de pesquisa é fundamental para uma revisão sistemática de qualidade. Refine antes de prosseguir."
            : "A good research question is essential for a quality systematic review. Refine before proceeding."}
        </p>
        {locked && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {pt ? "Protocolo registrado — pergunta e PICO bloqueados" : "Protocol registered — question and PICO locked"}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={
            pt
              ? "Ex: Qual a associação entre exposição a microplásticos e desfechos adversos na gravidez?"
              : "E.g., What is the association between microplastic exposure and adverse pregnancy outcomes?"
          }
          rows={4}
          disabled={locked}
          className="w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <QuestionEvaluator question={question} onEvaluation={setEvaluation} onRewrite={locked ? () => {} : onQuestionChange} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-foreground">PICO</h3>
        <div className="grid grid-cols-2 gap-3">
          {picoField("population", pt ? "População" : "Population", pt ? "Ex: Gestantes" : "E.g., Pregnant women")}
          {picoField("intervention", pt ? "Intervenção" : "Intervention", pt ? "Ex: Exposição a microplásticos" : "E.g., Microplastic exposure")}
          {picoField("comparison", pt ? "Comparação" : "Comparison", pt ? "Ex: Sem exposição" : "E.g., No exposure")}
          {picoField("outcome", "Outcome", pt ? "Ex: Desfechos adversos na gravidez" : "E.g., Adverse pregnancy outcomes")}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!question.trim()} className="gap-2">
          {pt ? "Próximo: Coleta de Artigos" : "Next: Article Collection"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepQuestion;
