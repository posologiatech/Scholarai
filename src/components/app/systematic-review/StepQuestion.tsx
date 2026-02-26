import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import QuestionEvaluator, { type Evaluation } from "@/components/app/QuestionEvaluator";
import { ArrowRight, Lightbulb } from "lucide-react";
import { useState } from "react";

interface StepQuestionProps {
  question: string;
  onQuestionChange: (q: string) => void;
  onNext: () => void;
}

const StepQuestion = ({ question, onQuestionChange, onNext }: StepQuestionProps) => {
  const { locale } = useLanguage();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Lightbulb className="h-4 w-4" />
          {locale === "pt" ? "Etapa 1: Pergunta de Pesquisa" : "Step 1: Research Question"}
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Uma boa pergunta de pesquisa é fundamental para uma revisão sistemática de qualidade. Refine antes de prosseguir."
            : "A good research question is essential for a quality systematic review. Refine before proceeding."}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={
            locale === "pt"
              ? "Ex: Qual a associação entre exposição a microplásticos e desfechos adversos na gravidez?"
              : "E.g., What is the association between microplastic exposure and adverse pregnancy outcomes?"
          }
          rows={4}
          className="w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <QuestionEvaluator question={question} onEvaluation={setEvaluation} onRewrite={onQuestionChange} />
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!question.trim()} className="gap-2">
          {locale === "pt" ? "Próximo: Coleta de Artigos" : "Next: Article Collection"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepQuestion;
