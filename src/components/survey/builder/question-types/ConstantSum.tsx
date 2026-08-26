import { SurveyQuestion, useSurveyStore } from "@/hooks/useSurveyStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any; // { [choiceId]: number }
  onChange?: (value: any) => void;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const ConstantSum = ({ question, editable, respondMode, value, onChange }: Props) => {
  const { updateQuestion } = useSurveyStore();
  const choices = [...(question.choices || [])].sort((a, b) => a.order - b.order);
  const answers = value || {};
  const total = Object.values(answers).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  const target = question.settings?.targetSum ?? 100;

  const addChoice = () => {
    updateQuestion(question.id, {
      choices: [
        ...choices,
        { id: genId(), text: `Category ${choices.length + 1}`, value: String(choices.length + 1), order: choices.length },
      ],
    });
  };

  return (
    <div className="space-y-2">
      {choices.map((c) => (
        <div key={c.id} className="flex items-center gap-3 group">
          {editable ? (
            <Input
              value={c.text}
              onChange={(e) =>
                updateQuestion(question.id, {
                  choices: choices.map((ch) => (ch.id === c.id ? { ...ch, text: e.target.value } : ch)),
                })
              }
              className="h-8 text-sm border-dashed flex-1"
            />
          ) : (
            <span className="text-sm flex-1">{c.text}</span>
          )}
          {respondMode ? (
            <Input
              type="number"
              className="h-8 w-20 text-sm text-right"
              value={answers[c.id] ?? ""}
              onChange={(e) => onChange?.({ ...answers, [c.id]: Number(e.target.value) || 0 })}
            />
          ) : (
            <div className="w-20 h-8 border border-dashed rounded-md bg-muted/20" />
          )}
          {editable && choices.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 shrink-0"
              aria-label="Remove category"
              onClick={() => updateQuestion(question.id, { choices: choices.filter((ch) => ch.id !== c.id) })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
        <span>Total: {respondMode ? total : "—"} / {target}</span>
        {editable && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={addChoice}>
            <Plus className="h-3 w-3 mr-1" />
            Add Category
          </Button>
        )}
      </div>
    </div>
  );
};

export default ConstantSum;
