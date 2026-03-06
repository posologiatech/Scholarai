import { LogicRule, useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  rule: LogicRule;
}

const operators = [
  { value: "equal", en: "is equal to", pt: "é igual a" },
  { value: "not_equal", en: "is not equal to", pt: "não é igual a" },
  { value: "greater_than", en: "is greater than", pt: "é maior que" },
  { value: "less_than", en: "is less than", pt: "é menor que" },
  { value: "contains", en: "contains", pt: "contém" },
];

const actions = [
  { value: "show_block", en: "Show Block", pt: "Mostrar Bloco" },
  { value: "hide_question", en: "Hide Question", pt: "Ocultar Questão" },
  { value: "skip_to", en: "Skip to Question", pt: "Pular para Questão" },
  { value: "end_survey", en: "End Survey", pt: "Encerrar Pesquisa" },
];

const ConditionBuilder = ({ rule }: Props) => {
  const { locale } = useLanguage();
  const { questions, blocks, updateLogicRule } = useSurveyStore();

  const allQuestions = [...questions].sort((a, b) => a.question_order - b.question_order);
  const sortedBlocks = [...blocks].sort((a, b) => a.block_order - b.block_order);

  // Get choices for selected source question
  const sourceQ = questions.find((q) => q.id === rule.source_question_id);
  const hasChoices = sourceQ && (sourceQ.question_type === "multiple_choice" || sourceQ.question_type === "rank_order" || sourceQ.question_type === "constant_sum");

  return (
    <div className="space-y-3">
      {/* IF condition */}
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {locale === "pt" ? "SE" : "IF"}
        </Label>

        {/* Source question */}
        <Select
          value={rule.source_question_id || ""}
          onValueChange={(v) =>
            updateLogicRule(rule.id, {
              source_question_id: v,
              condition: { ...rule.condition, field: v },
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={locale === "pt" ? "Selecionar questão..." : "Select question..."} />
          </SelectTrigger>
          <SelectContent>
            {allQuestions.map((q, idx) => (
              <SelectItem key={q.id} value={q.id} className="text-xs">
                Q{idx + 1}: {q.question_text || (locale === "pt" ? "Sem título" : "Untitled")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator */}
        <Select
          value={rule.condition.operator || "equal"}
          onValueChange={(v) =>
            updateLogicRule(rule.id, {
              condition: { ...rule.condition, operator: v },
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {locale === "pt" ? op.pt : op.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value */}
        {hasChoices ? (
          <Select
            value={rule.condition.value || ""}
            onValueChange={(v) =>
              updateLogicRule(rule.id, {
                condition: { ...rule.condition, value: v },
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={locale === "pt" ? "Selecionar valor..." : "Select value..."} />
            </SelectTrigger>
            <SelectContent>
              {(sourceQ?.choices || []).map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="h-8 text-xs"
            placeholder={locale === "pt" ? "Valor..." : "Value..."}
            value={rule.condition.value || ""}
            onChange={(e) =>
              updateLogicRule(rule.id, {
                condition: { ...rule.condition, value: e.target.value },
              })
            }
          />
        )}
      </div>

      {/* THEN action */}
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {locale === "pt" ? "ENTÃO" : "THEN"}
        </Label>

        {/* Action type */}
        <Select
          value={rule.action}
          onValueChange={(v) => updateLogicRule(rule.id, { action: v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actions.map((a) => (
              <SelectItem key={a.value} value={a.value} className="text-xs">
                {locale === "pt" ? a.pt : a.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Target (block or question) */}
        {(rule.action === "show_block" || rule.action === "hide_question" || rule.action === "skip_to") && (
          <Select
            value={rule.target_id || ""}
            onValueChange={(v) => updateLogicRule(rule.id, { target_id: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue
                placeholder={
                  rule.action === "show_block"
                    ? locale === "pt" ? "Selecionar bloco..." : "Select block..."
                    : locale === "pt" ? "Selecionar questão..." : "Select question..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {rule.action === "show_block"
                ? sortedBlocks.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.title}
                    </SelectItem>
                  ))
                : allQuestions.map((q, idx) => (
                    <SelectItem key={q.id} value={q.id} className="text-xs">
                      Q{idx + 1}: {q.question_text || "Untitled"}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
};

export default ConditionBuilder;
