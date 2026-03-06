import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Circle, Loader2 } from "lucide-react";

interface MissingElement {
  label: string;
  rewritten_question: string;
}

interface Evaluation {
  quality: "good" | "fair" | "poor";
  message: string;
  missing_elements: MissingElement[];
  suggested_columns: { name: string; description: string }[];
}

interface QuestionEvaluatorProps {
  question: string;
  onEvaluation?: (evaluation: Evaluation | null) => void;
  onRewrite?: (newQuestion: string) => void;
}

const EVALUATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-question`;

const QuestionEvaluator = ({ question, onEvaluation, onRewrite }: QuestionEvaluatorProps) => {
  const { locale } = useLanguage();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastQuestion = useRef("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!question || question.trim().length < 15) {
      setEvaluation(null);
      onEvaluation?.(null);
      return;
    }

    if (question === lastQuestion.current) return;

    debounceRef.current = setTimeout(async () => {
      lastQuestion.current = question;
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("No session");
        const resp = await fetch(EVALUATE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question, locale }),
        });
        if (!resp.ok) throw new Error("Failed");
        const data: Evaluation = await resp.json();
        setEvaluation(data);
        onEvaluation?.(data);
      } catch {
        setEvaluation(null);
        onEvaluation?.(null);
      } finally {
        setLoading(false);
      }
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [question]);

  if (!question || question.trim().length < 15) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 pt-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {locale === "pt" ? "Avaliando pergunta..." : "Evaluating question..."}
      </div>
    );
  }

  if (!evaluation) return null;

  const qualityColors = {
    good: "text-green-600 dark:text-green-400",
    fair: "text-yellow-600 dark:text-yellow-400",
    poor: "text-red-500 dark:text-red-400",
  };

  const dotColors = {
    good: "fill-green-500",
    fair: "fill-yellow-500",
    poor: "fill-red-500",
  };

  return (
    <div className="space-y-2 px-1 pt-3">
      <div className={`flex items-center gap-2 text-sm ${qualityColors[evaluation.quality]}`}>
        <Circle className={`h-2.5 w-2.5 ${dotColors[evaluation.quality]}`} />
        {evaluation.message}
      </div>
      {evaluation.missing_elements.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {evaluation.missing_elements.map((el, i) => (
            <button
              key={i}
              onClick={() => onRewrite?.(el.rewritten_question)}
              className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-colors cursor-pointer"
              title={el.rewritten_question}
            >
              {el.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionEvaluator;
export type { Evaluation };
