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

// Standard NPS red→amber→green read: 0-6 detractor, 7-8 passive, 9-10 promoter. Selection is
// also marked with a ring independent of the band color — color alone (fill vs. outline) isn't
// a reliable signal for colorblind users (WCAG 1.4.1).
const scoreColor = (score: number, selected: boolean) => {
  const band = score <= 6 ? "rose" : score <= 8 ? "amber" : "emerald";
  const base = {
    rose: "bg-rose-500 border-rose-500 text-white",
    amber: "bg-amber-500 border-amber-500 text-white",
    emerald: "bg-emerald-500 border-emerald-500 text-white",
  }[band];
  if (!selected) return "border-border text-foreground hover:border-foreground/40";
  return cn(base, "ring-2 ring-offset-2 ring-offset-background ring-foreground");
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
      {/* role="radiogroup"/"radio" matches the actual interaction (pick one of 11 mutually
          exclusive scores) — each button stays independently tabbable rather than the full
          roving-tabindex APG pattern, a common simplification that still gives screen readers
          the group label, per-option state (aria-checked), and correct semantics. */}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={question.question_text || (labelLow + " – " + labelHigh)}>
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={String(score)}
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
