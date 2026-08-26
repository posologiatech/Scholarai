// Server-side mirror of src/lib/survey/surveyLogic.ts. Edge functions can't import from src/,
// so this is intentionally kept in lockstep by hand — it exists so survey-respond can enforce
// required-question visibility with the same rules the respondent actually saw, instead of
// trusting the client to have applied them.

export interface LogicCondition {
  field?: string;
  operator?: string;
  value?: any;
}

export interface LogicRuleRow {
  source_question_id: string | null;
  target_id: string | null;
  action: string;
  condition: LogicCondition | null;
}

export interface QuestionRow {
  id: string;
  block_id: string;
  question_order: number;
  is_required: boolean;
  question_type: string;
  choices: any[] | null;
  matrix_rows: { id: string }[] | null;
  matrix_columns: unknown[] | null;
  settings: Record<string, any> | null;
}

export interface BlockRow {
  id: string;
}

export function evaluateVisibleQuestionIds(
  questions: QuestionRow[],
  rules: LogicRuleRow[],
  answers: Record<string, any>
): Set<string> {
  const sortedQuestions = [...questions].sort((a, b) => a.question_order - b.question_order);
  const hiddenQuestionIds = new Set<string>();

  const hiddenBlockIds = new Set<string>(
    rules.filter((r) => r.action === "show_block" && r.target_id).map((r) => r.target_id as string)
  );

  rules.forEach((rule) => {
    const condition = rule.condition;
    if (!condition?.field) return;

    const answer = answers[condition.field];
    let conditionMet = false;

    switch (condition.operator) {
      case "equal":
        conditionMet = String(answer) === String(condition.value);
        break;
      case "not_equal":
        conditionMet = String(answer) !== String(condition.value);
        break;
      case "greater_than":
        conditionMet = Number(answer) > Number(condition.value);
        break;
      case "less_than":
        conditionMet = Number(answer) < Number(condition.value);
        break;
      case "contains":
        conditionMet = String(answer || "").toLowerCase().includes(String(condition.value).toLowerCase());
        break;
    }

    if (!conditionMet) return;

    if (rule.action === "hide_question" && rule.target_id) {
      hiddenQuestionIds.add(rule.target_id);
    }
    if (rule.action === "show_block" && rule.target_id) {
      hiddenBlockIds.delete(rule.target_id);
    }
    if (rule.action === "skip_to" && rule.target_id) {
      const sourceQ = sortedQuestions.find((q) => q.id === rule.source_question_id);
      const targetQ = sortedQuestions.find((q) => q.id === rule.target_id);
      if (sourceQ && targetQ && targetQ.question_order > sourceQ.question_order) {
        sortedQuestions.forEach((q) => {
          if (q.question_order > sourceQ.question_order && q.question_order < targetQ.question_order) {
            hiddenQuestionIds.add(q.id);
          }
        });
      }
    }
    if (rule.action === "end_survey") {
      const sourceQ = sortedQuestions.find((q) => q.id === rule.source_question_id);
      if (sourceQ) {
        sortedQuestions.forEach((q) => {
          if (q.question_order > sourceQ.question_order) hiddenQuestionIds.add(q.id);
        });
      }
    }
  });

  const visible = new Set<string>();
  questions.forEach((q) => {
    if (!hiddenQuestionIds.has(q.id) && !hiddenBlockIds.has(q.block_id)) visible.add(q.id);
  });
  return visible;
}

export function isQuestionAnswered(question: QuestionRow, answer: any): boolean {
  switch (question.question_type) {
    case "multiple_choice":
      return question.settings?.allowMultiple
        ? Array.isArray(answer) && answer.length > 0
        : typeof answer === "string" && answer.trim().length > 0;
    case "text_entry":
      return typeof answer === "string" && answer.trim().length > 0;
    case "matrix_table": {
      const rows = question.matrix_rows || [];
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
      return rows.length > 0 && rows.every((r) => answer[r.id] !== undefined && answer[r.id] !== "");
    }
    case "rank_order": {
      const total = (question.choices || []).length;
      return total > 0 && Array.isArray(answer) && answer.length === total;
    }
    case "constant_sum":
      return !!answer && typeof answer === "object" && !Array.isArray(answer) && Object.keys(answer).length > 0;
    case "slider":
      return answer !== undefined && answer !== null;
    default:
      return answer !== undefined && answer !== null && answer !== "";
  }
}
