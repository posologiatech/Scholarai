import { SurveyQuestion } from "@/hooks/useSurveyStore";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const FORMAT_PLACEHOLDER: Record<string, string> = {
  email: "nome@exemplo.com",
  phone: "(00) 00000-0000",
};

const TextEntry = ({ question, respondMode, value, onChange }: Props) => {
  const multiline = question.settings?.multiline;
  const format = question.settings?.format;

  if (respondMode) {
    if (format === "email" || format === "phone") {
      return (
        <Input
          type={format === "email" ? "email" : "tel"}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={FORMAT_PLACEHOLDER[format]}
        />
      );
    }
    return multiline ? (
      <Textarea
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Type your answer..."
        rows={4}
      />
    ) : (
      <Input
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Type your answer..."
      />
    );
  }

  // Builder preview
  return (
    <div className="border border-dashed rounded-md p-3 text-sm text-muted-foreground bg-muted/20">
      {multiline ? "Multi-line text response area" : "Single-line text response"}
    </div>
  );
};

export default TextEntry;
