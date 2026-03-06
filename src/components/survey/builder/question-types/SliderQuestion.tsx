import { SurveyQuestion } from "@/hooks/useSurveyStore";
import { Slider } from "@/components/ui/slider";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const SliderQuestion = ({ question, respondMode, value, onChange }: Props) => {
  const min = question.settings?.min ?? 0;
  const max = question.settings?.max ?? 100;
  const step = question.settings?.step ?? 1;
  const current = value ?? Math.round((min + max) / 2);

  return (
    <div className="space-y-3 py-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span className="font-medium text-foreground text-sm">{respondMode ? current : "—"}</span>
        <span>{max}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[respondMode ? current : Math.round((min + max) / 2)]}
        onValueChange={(v) => respondMode && onChange?.(v[0])}
        disabled={!respondMode}
      />
    </div>
  );
};

export default SliderQuestion;
