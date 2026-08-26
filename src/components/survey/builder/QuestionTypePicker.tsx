import { useState } from "react";
import { QuestionType, QUESTION_TYPE_LABELS } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_META } from "./questionTypeMeta";

const TYPE_ORDER: QuestionType[] = [
  "multiple_choice",
  "text_entry",
  "matrix_table",
  "slider",
  "rank_order",
  "constant_sum",
  "date_time",
  "file_upload",
  "nps",
  "signature",
];

interface Props {
  onSelect: (type: QuestionType) => void;
}

const QuestionTypePicker = ({ onSelect }: Props) => {
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {locale === "pt" ? "Adicionar Questão" : "Add Question"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-3" align="center">
        <div className="grid grid-cols-2 gap-2">
          {TYPE_ORDER.map((type) => {
            const meta = QUESTION_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => { onSelect(type); setOpen(false); }}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                  "hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", meta.badgeBg)}>
                  <Icon className={cn("h-4 w-4", meta.badgeText)} />
                </span>
                <span className="text-xs font-medium text-foreground">
                  {QUESTION_TYPE_LABELS[type][locale]}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default QuestionTypePicker;
