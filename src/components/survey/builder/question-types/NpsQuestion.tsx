import { SurveyQuestion } from "@/hooks/useSurveyStore";
import { cn } from "@/lib/utils";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const SCORES = Array.from({ length: 11 }, (_, i) => i);

// Standard NPS red→amber→green read: 0-6 detractor, 7-8 passive, 9-10 promoter.
const scoreColor = (score: number, selected: boolean) => {
  const band = score <= 6 ? "rose" : score <= 8 ? "amber" : "emerald";
  if (!selected) return "border-border text-foreground hover:border-foreground/40";
  return {
    rose: "bg-rose-500 border-rose-500 text-white",
    amber: "bg-amber-500 border-amber-500 text-white",
    emerald: "bg-emerald-500 border-emerald-500 text-white",
  }[band];
};

const NpsQuestion = ({ question, respondMode, value, onChange }: Props) => {
  const labelLow = question.settings?.labelLow || "Pouco provável";
  const labelHigh = question.settings?.labelHigh || "Muito provável";

  if (!respondMode) {
    return (
      <div className="border border-dashed rounded-md p-3 text-sm text-muted-foreground bg-muted/20">
        Escala NPS de 0 a 10
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange?.(score)}
            className={cn(
              "h-9 w-9 rounded-md border text-sm font-medium transition-colors",
              scoreColor(score, value === score)
            )}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{labelLow}</span>
        <span>{labelHigh}</span>
      </div>
    </div>
  );
};

export default NpsQuestion;
