import { useSurveyStore, QuestionType, QUESTION_TYPE_LABELS } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2, Stethoscope } from "lucide-react";
import { clinicalValidationTemplates } from "@/components/survey/ecrf/ClinicalValidationTemplates";

const questionTypeOrder: QuestionType[] = [
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

  const validationRules = question.validation_rules || {};

  const applyClinicalTemplate = (templateId: string) => {
    if (templateId === "none") {
      updateQuestion(question.id, {
        validation_rules: {},
      });
      return;
    }
    const template = clinicalValidationTemplates.find((t) => t.id === templateId);
    if (!template) return;
    updateQuestion(question.id, {
      validation_rules: {
        clinical_template: template.id,
        min: template.min,
        max: template.max,
        unit: template.unit,
      },
    });
  };

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
                {questionTypeOrder.map((type) => (
                  <SelectItem key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type][locale]}
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

          {/* Clinical Validation Templates */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-primary" />
              <Label className="text-xs font-semibold">
                {locale === "pt" ? "Validação Clínica" : "Clinical Validation"}
              </Label>
            </div>

            <Select
              value={validationRules.clinical_template || "none"}
              onValueChange={applyClinicalTemplate}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={locale === "pt" ? "Selecionar template..." : "Select template..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {locale === "pt" ? "Sem validação clínica" : "No clinical validation"}
                </SelectItem>
                {clinicalValidationTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {locale === "pt" ? t.labelPt : t.label} ({t.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {validationRules.clinical_template && (
              <div className="space-y-2 p-3 border rounded-md bg-card">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {validationRules.unit}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {locale === "pt" ? "Faixa aceita:" : "Accepted range:"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Min</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={validationRules.min ?? ""}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          validation_rules: { ...validationRules, min: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Max</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={validationRules.max ?? ""}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          validation_rules: { ...validationRules, max: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {locale === "pt"
                    ? "Valores fora desta faixa serão sinalizados como possível erro"
                    : "Values outside this range will be flagged as potential error"}
                </p>
              </div>
            )}
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
              <div className="space-y-2">
                <Label className="text-xs">{locale === "pt" ? "Formato validado" : "Validated format"}</Label>
                <Select
                  value={question.settings?.format || "none"}
                  onValueChange={(v) =>
                    updateQuestion(question.id, { settings: { ...question.settings, format: v } })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{locale === "pt" ? "Nenhum" : "None"}</SelectItem>
                    <SelectItem value="email">{locale === "pt" ? "E-mail" : "Email"}</SelectItem>
                    <SelectItem value="phone">{locale === "pt" ? "Telefone" : "Phone"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {question.question_type === "date_time" && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-semibold">
                  {locale === "pt" ? "Configurações de Data/Hora" : "Date/Time Settings"}
                </Label>
                <Select
                  value={question.settings?.mode || "date"}
                  onValueChange={(v) =>
                    updateQuestion(question.id, { settings: { ...question.settings, mode: v } })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">{locale === "pt" ? "Data" : "Date"}</SelectItem>
                    <SelectItem value="datetime">{locale === "pt" ? "Data e hora" : "Date and time"}</SelectItem>
                    <SelectItem value="time">{locale === "pt" ? "Hora" : "Time"}</SelectItem>
                  </SelectContent>
                </Select>
                {question.settings?.mode !== "time" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">{locale === "pt" ? "Data mín." : "Min date"}</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={validationRules.minDate || ""}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            validation_rules: { ...validationRules, minDate: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">{locale === "pt" ? "Data máx." : "Max date"}</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={validationRules.maxDate || ""}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            validation_rules: { ...validationRules, maxDate: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {question.question_type === "nps" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  {locale === "pt" ? "Rótulos da escala" : "Scale labels"}
                </Label>
                <Input
                  className="h-8 text-xs"
                  placeholder={locale === "pt" ? "Pouco provável" : "Not likely"}
                  value={question.settings?.labelLow || ""}
                  onChange={(e) =>
                    updateQuestion(question.id, { settings: { ...question.settings, labelLow: e.target.value } })
                  }
                />
                <Input
                  className="h-8 text-xs"
                  placeholder={locale === "pt" ? "Muito provável" : "Very likely"}
                  value={question.settings?.labelHigh || ""}
                  onChange={(e) =>
                    updateQuestion(question.id, { settings: { ...question.settings, labelHigh: e.target.value } })
                  }
                />
              </div>
            </>
          )}

          {question.question_type === "file_upload" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {locale === "pt" ? "Tipos aceitos (opcional)" : "Accepted types (optional)"}
                </Label>
                <Input
                  className="h-8 text-xs"
                  placeholder=".pdf,.jpg,.png"
                  value={question.settings?.accept || ""}
                  onChange={(e) =>
                    updateQuestion(question.id, { settings: { ...question.settings, accept: e.target.value } })
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  {locale === "pt" ? "Tamanho máximo: 20MB por arquivo" : "Max size: 20MB per file"}
                </p>
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

          {question.question_type === "constant_sum" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {locale === "pt" ? "Soma alvo" : "Target Sum"}
                </Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={question.settings?.targetSum ?? 100}
                  onChange={(e) =>
                    updateQuestion(question.id, {
                      settings: { ...question.settings, targetSum: Number(e.target.value) },
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
