export type AnswerMap = Record<string, any>;

// Structural (not imported) on purpose: this same engine has to run against both the
// strongly-typed builder store (SurveyQuestion/SurveyBlock/LogicRule in useSurveyStore.ts)
// and raw Supabase rows on the public respond page, where JSON columns come back as `Json`,
// not the store's concrete array/object shapes. Generics below preserve whichever concrete
// type the caller passes in.
export interface VisibilityQuestion {
  id: string;
  block_id: string;
  question_order: number;
}

export interface VisibilityBlock {
  id: string;
}

export interface VisibilityRule {
  source_question_id: string | null;
  target_id: string | null;
  action: string;
  condition: { field?: string; operator?: string; value?: any } | any;
}

export interface VisibilityResult<Q extends VisibilityQuestion, B extends VisibilityBlock> {
  visibleQuestions: Q[];
  visibleBlocks: B[];
}

/**
 * Single source of truth for "SE <condição> ENTÃO <ação>" rules. Both the researcher-facing
 * preview and the real public response page must resolve a given (questions, rules, answers)
 * triple to the exact same visible set — otherwise a rule can look fine in preview and behave
 * differently for the actual respondent.
 */
export function evaluateVisibility<Q extends VisibilityQuestion, B extends VisibilityBlock>(
  questions: Q[],
  blocks: B[],
  rules: VisibilityRule[],
  answers: AnswerMap
): VisibilityResult<Q, B> {
  const sortedQuestions = [...questions].sort((a, b) => a.question_order - b.question_order);
  const hiddenQuestionIds = new Set<string>();

  // A block is only ever a "show_block" target because someone wants it hidden until its
  // condition fires — so any block referenced that way starts hidden by default. Blocks
  // nobody conditions on stay visible.
  const hiddenBlockIds = new Set<string>(
    rules.filter((r) => r.action === "show_block" && r.target_id).map((r) => r.target_id as string)
  );

  rules.forEach((rule) => {
    const condition = rule.condition as { field?: string; operator?: string; value?: any } | null;
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

  return {
    visibleQuestions: questions.filter((q) => !hiddenQuestionIds.has(q.id) && !hiddenBlockIds.has(q.block_id)),
    visibleBlocks: blocks.filter((b) => !hiddenBlockIds.has(b.id)),
  };
}

export interface AnsweredCheckQuestion {
  question_type: string;
  choices?: any;
  matrix_rows?: any;
  settings?: any;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A phone is "valid enough" once it has at least 8 digits, regardless of punctuation/mask. */
function isValidPhone(value: string): boolean {
  return (value.match(/\d/g) || []).length >= 8;
}

/** Whether a required question has a real, submittable answer — not just a truthy default. */
export function isQuestionAnswered(question: AnsweredCheckQuestion, answer: any): boolean {
  switch (question.question_type) {
    case "multiple_choice":
      return question.settings?.allowMultiple
        ? Array.isArray(answer) && answer.length > 0
        : typeof answer === "string" && answer.trim().length > 0;
    case "text_entry": {
      if (typeof answer !== "string" || answer.trim().length === 0) return false;
      const format = question.settings?.format;
      if (format === "email") return EMAIL_RE.test(answer.trim());
      if (format === "phone") return isValidPhone(answer);
      return true;
    }
    case "matrix_table": {
      const rows = (question.matrix_rows || []) as { id: string }[];
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
      return rows.length > 0 && rows.every((r) => answer[r.id] !== undefined && answer[r.id] !== "");
    }
    case "rank_order": {
      const total = ((question.choices || []) as unknown[]).length;
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

/** Required, visible questions that still don't have a submittable answer. */
export function findMissingRequired<Q extends AnsweredCheckQuestion & { id: string; is_required: boolean }>(
  questions: Q[],
  answers: AnswerMap
): Q[] {
  return questions.filter((q) => q.is_required && !isQuestionAnswered(q, answers[q.id]));
}
