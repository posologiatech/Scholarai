import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────

export interface SurveyChoice {
  id: string;
  text: string;
  value: string;
  order: number;
}

export interface MatrixItem {
  id: string;
  text: string;
  order: number;
}

export type QuestionType =
  | "multiple_choice"
  | "text_entry"
  | "matrix_table"
  | "slider"
  | "rank_order"
  | "constant_sum"
  | "date_time"
  | "nps"
  | "signature"
  | "file_upload";

export const QUESTION_TYPE_LABELS: Record<QuestionType, { pt: string; en: string }> = {
  multiple_choice: { pt: "Múltipla Escolha", en: "Multiple Choice" },
  text_entry: { pt: "Entrada de Texto", en: "Text Entry" },
  matrix_table: { pt: "Matriz / Likert", en: "Matrix / Likert" },
  slider: { pt: "Controle Deslizante", en: "Slider" },
  rank_order: { pt: "Classificação", en: "Rank Order" },
  constant_sum: { pt: "Soma Constante", en: "Constant Sum" },
  date_time: { pt: "Data / Hora", en: "Date / Time" },
  nps: { pt: "NPS / Nota", en: "NPS / Rating" },
  signature: { pt: "Assinatura", en: "Signature" },
  file_upload: { pt: "Upload de Arquivo", en: "File Upload" },
};

export interface SurveyQuestion {
  id: string;
  block_id: string;
  survey_id: string;
  question_type: QuestionType;
  question_text: string;
  description: string;
  question_order: number;
  is_required: boolean;
  validation_rules: Record<string, any>;
  choices: SurveyChoice[];
  matrix_rows: MatrixItem[];
  matrix_columns: MatrixItem[];
  settings: Record<string, any>;
}

export interface SurveyBlock {
  id: string;
  survey_id: string;
  title: string;
  description: string;
  block_order: number;
  randomize_questions: boolean;
  settings: Record<string, any>;
}

export interface LogicRule {
  id: string;
  survey_id: string;
  source_question_id: string | null;
  source_block_id: string | null;
  condition: { field: string; operator: string; value: any };
  action: string;
  target_id: string | null;
  rule_order: number;
}

export interface Survey {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  description: string;
  status: string;
  settings: Record<string, any>;
  research_project_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
}

interface SurveyBuilderState {
  survey: Survey | null;
  blocks: SurveyBlock[];
  questions: SurveyQuestion[];
  logicRules: LogicRule[];
  activeBlockId: string | null;
  activeQuestionId: string | null;
  isDirty: boolean;

  // Survey
  setSurvey: (survey: Survey) => void;
  updateSurveyField: (field: keyof Survey, value: any) => void;

  // Blocks
  setBlocks: (blocks: SurveyBlock[]) => void;
  addBlock: (surveyId: string, locale?: "pt" | "en") => string;
  updateBlock: (blockId: string, updates: Partial<SurveyBlock>) => void;
  removeBlock: (blockId: string) => void;
  reorderBlocks: (blockIds: string[]) => void;
  setActiveBlock: (blockId: string | null) => void;

  // Questions
  setQuestions: (questions: SurveyQuestion[]) => void;
  addQuestion: (blockId: string, surveyId: string, type?: QuestionType) => string;
  duplicateQuestion: (questionId: string) => void;
  updateQuestion: (questionId: string, updates: Partial<SurveyQuestion>) => void;
  removeQuestion: (questionId: string) => void;
  reorderQuestions: (blockId: string, questionIds: string[]) => void;
  setActiveQuestion: (questionId: string | null) => void;

  // Logic
  setLogicRules: (rules: LogicRule[]) => void;
  addLogicRule: (surveyId: string) => void;
  updateLogicRule: (ruleId: string, updates: Partial<LogicRule>) => void;
  removeLogicRule: (ruleId: string) => void;

  // Utility
  resetStore: () => void;
  markClean: () => void;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export const useSurveyStore = create<SurveyBuilderState>((set, get) => ({
  survey: null,
  blocks: [],
  questions: [],
  logicRules: [],
  activeBlockId: null,
  activeQuestionId: null,
  isDirty: false,

  setSurvey: (survey) => set({ survey }),
  updateSurveyField: (field, value) =>
    set((s) => ({
      survey: s.survey ? { ...s.survey, [field]: value } : null,
      isDirty: true,
    })),

  setBlocks: (blocks) => set({ blocks }),
  addBlock: (surveyId, locale = "en") => {
    const id = genId();
    set((s) => ({
      blocks: [
        ...s.blocks,
        {
          id,
          survey_id: surveyId,
          title: `${locale === "pt" ? "Bloco" : "Block"} ${s.blocks.length + 1}`,
          description: "",
          block_order: s.blocks.length,
          randomize_questions: false,
          settings: {},
        },
      ],
      activeBlockId: id,
      isDirty: true,
    }));
    return id;
  },
  updateBlock: (blockId, updates) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
      isDirty: true,
    })),
  removeBlock: (blockId) =>
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== blockId),
      questions: s.questions.filter((q) => q.block_id !== blockId),
      activeBlockId: s.activeBlockId === blockId ? null : s.activeBlockId,
      isDirty: true,
    })),
  reorderBlocks: (blockIds) =>
    set((s) => ({
      blocks: blockIds.map((id, i) => {
        const b = s.blocks.find((bl) => bl.id === id)!;
        return { ...b, block_order: i };
      }),
      isDirty: true,
    })),
  setActiveBlock: (blockId) => set({ activeBlockId: blockId }),

  setQuestions: (questions) => set({ questions }),
  addQuestion: (blockId, surveyId, type = "multiple_choice") => {
    const id = genId();
    const blockQuestions = get().questions.filter((q) => q.block_id === blockId);
    set((s) => ({
      questions: [
        ...s.questions,
        {
          id,
          block_id: blockId,
          survey_id: surveyId,
          question_type: type,
          question_text: "",
          description: "",
          question_order: blockQuestions.length,
          is_required: false,
          validation_rules: {},
          choices:
            type === "multiple_choice"
              ? [
                  { id: genId(), text: "Option 1", value: "1", order: 0 },
                  { id: genId(), text: "Option 2", value: "2", order: 1 },
                ]
              : [],
          matrix_rows:
            type === "matrix_table"
              ? [
                  { id: genId(), text: "Statement 1", order: 0 },
                  { id: genId(), text: "Statement 2", order: 1 },
                ]
              : [],
          matrix_columns:
            type === "matrix_table"
              ? [
                  { id: genId(), text: "Strongly Disagree", order: 0 },
                  { id: genId(), text: "Disagree", order: 1 },
                  { id: genId(), text: "Neutral", order: 2 },
                  { id: genId(), text: "Agree", order: 3 },
                  { id: genId(), text: "Strongly Agree", order: 4 },
                ]
              : [],
          settings:
            type === "slider"
              ? { min: 0, max: 100, step: 1 }
              : type === "text_entry"
              ? { multiline: false, format: "none" }
              : type === "date_time"
              ? { mode: "date" }
              : {},
        },
      ],
      activeQuestionId: id,
      isDirty: true,
    }));
    return id;
  },
  duplicateQuestion: (questionId) =>
    set((s) => {
      const original = s.questions.find((q) => q.id === questionId);
      if (!original) return s;
      const copy: SurveyQuestion = {
        ...original,
        id: genId(),
        choices: original.choices.map((c) => ({ ...c, id: genId() })),
        matrix_rows: original.matrix_rows.map((r) => ({ ...r, id: genId() })),
        matrix_columns: original.matrix_columns.map((c) => ({ ...c, id: genId() })),
      };
      // Insert right after the original and shift every later question in the same
      // block down one slot, so the copy lands next to what it duplicates.
      const questions = s.questions.map((q) =>
        q.block_id === original.block_id && q.question_order > original.question_order
          ? { ...q, question_order: q.question_order + 1 }
          : q
      );
      copy.question_order = original.question_order + 1;
      return {
        questions: [...questions, copy],
        activeQuestionId: copy.id,
        isDirty: true,
      };
    }),
  updateQuestion: (questionId, updates) =>
    set((s) => ({
      questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)),
      isDirty: true,
    })),
  removeQuestion: (questionId) =>
    set((s) => ({
      questions: s.questions.filter((q) => q.id !== questionId),
      activeQuestionId: s.activeQuestionId === questionId ? null : s.activeQuestionId,
      isDirty: true,
    })),
  reorderQuestions: (blockId, questionIds) =>
    set((s) => ({
      questions: s.questions.map((q) => {
        if (q.block_id !== blockId) return q;
        const idx = questionIds.indexOf(q.id);
        return idx >= 0 ? { ...q, question_order: idx } : q;
      }),
      isDirty: true,
    })),
  setActiveQuestion: (questionId) => set({ activeQuestionId: questionId }),

  setLogicRules: (rules) => set({ logicRules: rules }),
  addLogicRule: (surveyId) =>
    set((s) => ({
      logicRules: [
        ...s.logicRules,
        {
          id: genId(),
          survey_id: surveyId,
          source_question_id: null,
          source_block_id: null,
          condition: { field: "", operator: "equal", value: "" },
          action: "show_block",
          target_id: null,
          rule_order: s.logicRules.length,
        },
      ],
      isDirty: true,
    })),
  updateLogicRule: (ruleId, updates) =>
    set((s) => ({
      logicRules: s.logicRules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)),
      isDirty: true,
    })),
  removeLogicRule: (ruleId) =>
    set((s) => ({
      logicRules: s.logicRules.filter((r) => r.id !== ruleId),
      isDirty: true,
    })),

  resetStore: () =>
    set({
      survey: null,
      blocks: [],
      questions: [],
      logicRules: [],
      activeBlockId: null,
      activeQuestionId: null,
      isDirty: false,
    }),
  markClean: () => set({ isDirty: false }),
}));
