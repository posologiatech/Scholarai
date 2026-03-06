import { useSurveyStore, QuestionType } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2 } from "lucide-react";

const questionTypes: { value: QuestionType; label: string; labelPt: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice", labelPt: "Múltipla Escolha" },
  { value: "text_entry", label: "Text Entry", labelPt: "Entrada de Texto" },
  { value: "matrix_table", label: "Matrix / Likert", labelPt: "Matriz / Likert" },
  { value: "slider", label: "Slider", labelPt: "Controle Deslizante" },
  { value: "rank_order", label: "Rank Order", labelPt: "Classificação" },
  { value: "constant_sum", label: "Constant Sum", labelPt: "Soma Constante" },
];

const QuestionContextPanel = () => {
  const { locale } = useLanguage();
  const { questions, activeQuestionId, updateQuestion } = useSurveyStore();
  const question = questions.find((q) => q.id === activeQuestionId);

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
        <Settings2 className="h-8 w-8 mb-3 text-muted-foreground/40" />
        {locale === "pt"
          ? "Selecione uma questão para editar suas propriedades"
          : "Select a question to edit its properties"}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">
          {locale === "pt" ? "Propriedades" : "Properties"}
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Question type */}
          <div className="space-y-2">
            <Label className="text-xs">{locale === "pt" ? "Tipo de Questão" : "Question Type"}</Label>
            <Select
              value={question.question_type}
              onValueChange={(v) => updateQuestion(question.id, { question_type: v as QuestionType })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {locale === "pt" ? t.labelPt : t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs">{locale === "pt" ? "Descrição" : "Description"}</Label>
            <Input
              value={question.description || ""}
              onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
              placeholder={locale === "pt" ? "Texto auxiliar..." : "Help text..."}
              className="h-9"
            />
          </div>

          <Separator />

          {/* Validation */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold">
              {locale === "pt" ? "Validação" : "Validation"}
            </Label>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                {locale === "pt" ? "Resposta obrigatória" : "Force Response"}
              </Label>
              <Switch
                checked={question.is_required}
                onCheckedChange={(v) => updateQuestion(question.id, { is_required: v })}
              />
            </div>
          </div>

          {/* Type-specific settings */}
          {question.question_type === "slider" && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-semibold">
                  {locale === "pt" ? "Configurações do Slider" : "Slider Settings"}
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Min</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={question.settings?.min ?? 0}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          settings: { ...question.settings, min: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Max</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={question.settings?.max ?? 100}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          settings: { ...question.settings, max: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Step</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={question.settings?.step ?? 1}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          settings: { ...question.settings, step: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {question.question_type === "text_entry" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  {locale === "pt" ? "Multilinha" : "Multi-line"}
                </Label>
                <Switch
                  checked={question.settings?.multiline ?? false}
                  onCheckedChange={(v) =>
                    updateQuestion(question.id, {
                      settings: { ...question.settings, multiline: v },
                    })
                  }
                />
              </div>
            </>
          )}

          {question.question_type === "multiple_choice" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  {locale === "pt" ? "Randomizar opções" : "Randomize Choices"}
                </Label>
                <Switch
                  checked={question.settings?.randomize ?? false}
                  onCheckedChange={(v) =>
                    updateQuestion(question.id, {
                      settings: { ...question.settings, randomize: v },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  {locale === "pt" ? "Múltiplas respostas" : "Allow Multiple"}
                </Label>
                <Switch
                  checked={question.settings?.allowMultiple ?? false}
                  onCheckedChange={(v) =>
                    updateQuestion(question.id, {
                      settings: { ...question.settings, allowMultiple: v },
                    })
                  }
                />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default QuestionContextPanel;
