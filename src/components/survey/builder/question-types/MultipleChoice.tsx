import { SurveyQuestion, SurveyChoice, useSurveyStore } from "@/hooks/useSurveyStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const MultipleChoice = ({ question, editable, respondMode, value, onChange }: Props) => {
  const { updateQuestion } = useSurveyStore();
  const choices = [...(question.choices || [])].sort((a, b) => a.order - b.order);
  const allowMultiple = question.settings?.allowMultiple;

  const addChoice = () => {
    const newChoice: SurveyChoice = {
      id: genId(),
      text: `Option ${choices.length + 1}`,
      value: String(choices.length + 1),
      order: choices.length,
    };
    updateQuestion(question.id, { choices: [...choices, newChoice] });
  };

  const removeChoice = (id: string) => {
    updateQuestion(question.id, { choices: choices.filter((c) => c.id !== id) });
  };

  const updateChoice = (id: string, text: string) => {
    updateQuestion(question.id, {
      choices: choices.map((c) => (c.id === id ? { ...c, text } : c)),
    });
  };

  if (respondMode) {
    if (allowMultiple) {
      const selected: string[] = value || [];
      return (
        <div className="space-y-2">
          {choices.map((c) => (
            <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={selected.includes(c.id)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selected, c.id]
                    : selected.filter((s) => s !== c.id);
                  onChange?.(next);
                }}
              />
              <span className="text-sm">{c.text}</span>
            </label>
          ))}
        </div>
      );
    }
    return (
      <RadioGroup value={value || ""} onValueChange={(v) => onChange?.(v)}>
        {choices.map((c) => (
          <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value={c.id} />
            <span className="text-sm">{c.text}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }

  // Builder mode
  return (
    <div className="space-y-2">
      {choices.map((choice) => (
        <div key={choice.id} className="flex items-center gap-2 group">
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
          {editable ? (
            <Input
              value={choice.text}
              onChange={(e) => updateChoice(choice.id, e.target.value)}
              className="h-8 text-sm border-dashed"
            />
          ) : (
            <span className="text-sm">{choice.text}</span>
          )}
          {editable && choices.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={() => removeChoice(choice.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {editable && (
        <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={addChoice}>
          <Plus className="h-3 w-3 mr-1" />
          Add Choice
        </Button>
      )}
    </div>
  );
};

export default MultipleChoice;
