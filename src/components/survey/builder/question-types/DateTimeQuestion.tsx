import { SurveyQuestion } from "@/hooks/useSurveyStore";
import { Input } from "@/components/ui/input";
import { CalendarClock } from "lucide-react";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const INPUT_TYPE: Record<string, string> = {
  date: "date",
  datetime: "datetime-local",
  time: "time",
};

const DateTimeQuestion = ({ question, respondMode, value, onChange }: Props) => {
  const mode = question.settings?.mode || "date";
  const rules = question.validation_rules || {};

  if (respondMode) {
    return (
      <Input
        type={INPUT_TYPE[mode] || "date"}
        value={value || ""}
        min={mode !== "time" ? rules.minDate || undefined : undefined}
        max={mode !== "time" ? rules.maxDate || undefined : undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className="max-w-xs"
      />
    );
  }

  return (
    <div className="border border-dashed rounded-md p-3 text-sm text-muted-foreground bg-muted/20 flex items-center gap-2">
      <CalendarClock className="h-4 w-4" />
      {mode === "time" ? "Hora" : mode === "datetime" ? "Data e hora" : "Data"}
    </div>
  );
};

export default DateTimeQuestion;
