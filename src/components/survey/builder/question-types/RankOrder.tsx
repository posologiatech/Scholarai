import { SurveyQuestion, useSurveyStore } from "@/hooks/useSurveyStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, GripVertical } from "lucide-react";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const RankOrder = ({ question, editable }: Props) => {
  const { updateQuestion } = useSurveyStore();
  const choices = [...(question.choices || [])].sort((a, b) => a.order - b.order);

  const addChoice = () => {
    updateQuestion(question.id, {
      choices: [
        ...choices,
        { id: genId(), text: `Item ${choices.length + 1}`, value: String(choices.length + 1), order: choices.length },
      ],
    });
  };

  return (
    <div className="space-y-2">
      {choices.map((c, idx) => (
        <div key={c.id} className="flex items-center gap-2 group">
          <span className="text-xs font-medium text-muted-foreground w-5 text-center">{idx + 1}</span>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
          {editable ? (
            <Input
              value={c.text}
              onChange={(e) =>
                updateQuestion(question.id, {
                  choices: choices.map((ch) => (ch.id === c.id ? { ...ch, text: e.target.value } : ch)),
                })
              }
              className="h-8 text-sm border-dashed"
            />
          ) : (
            <span className="text-sm">{c.text}</span>
          )}
          {editable && choices.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={() => updateQuestion(question.id, { choices: choices.filter((ch) => ch.id !== c.id) })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {editable && (
        <Button variant="ghost" size="sm" className="text-xs" onClick={addChoice}>
          <Plus className="h-3 w-3 mr-1" />
          Add Item
        </Button>
      )}
    </div>
  );
};

export default RankOrder;
