/**
 * Multi-step analysis plans.
 *
 * A single research question ("compare os grupos e diga se a diferença se sustenta
 * ajustando por idade") is rarely one cell of code: it is a descriptive pass, an
 * assumption check, the test itself, and a model. Until now the assistant answered
 * every question with exactly one block of code, so the researcher had to drive the
 * chaining by hand and each follow-up started from a colder context.
 *
 * This module holds the plan contract: the model may answer with a `plan` instead of
 * `code`, and the client then runs each step as its own cell, feeding the results of
 * the previous steps into the next one.
 */

export interface AnalysisStep {
  /** Short label shown as the cell heading. */
  title: string;
  /** Self-contained instruction for the step, written for the model. */
  goal: string;
}

/**
 * A plan only pays for itself from two steps up — a one-step "plan" is just a normal
 * answer wearing a hat, and running it through the chain would cost an extra AI call
 * for nothing.
 */
export const MIN_PLAN_STEPS = 2;

/**
 * Each step is one code-generation call plus one execution (plus repairs), so the
 * ceiling is what keeps a single question from turning into a dozen billed calls.
 */
export const MAX_PLAN_STEPS = 6;

const MAX_TITLE_CHARS = 120;
const MAX_GOAL_CHARS = 600;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

/**
 * Accepts the loose shapes models actually emit — an array of strings, of
 * {title, goal}, or of {title, description} — and returns [] for anything that
 * isn't a usable plan, so the caller can fall back to a normal single-cell answer.
 */
export function normalizePlan(raw: unknown): AnalysisStep[] {
  if (!Array.isArray(raw)) return [];

  const steps: AnalysisStep[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    let title = "";
    let goal = "";

    if (typeof entry === "string") {
      title = clean(entry, MAX_TITLE_CHARS);
      goal = clean(entry, MAX_GOAL_CHARS);
    } else if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      title = clean(obj.title ?? obj.name ?? obj.step, MAX_TITLE_CHARS);
      goal = clean(obj.goal ?? obj.description ?? obj.instruction ?? obj.detail, MAX_GOAL_CHARS);
      // Either field alone is enough: a step with only a title still says what to do.
      if (!goal) goal = clean(obj.title ?? obj.name ?? obj.step, MAX_GOAL_CHARS);
      if (!title) title = clean(goal, MAX_TITLE_CHARS);
    }

    if (!goal) continue;
    const key = goal.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    steps.push({ title: title || goal, goal });
    if (steps.length === MAX_PLAN_STEPS) break;
  }

  return steps.length >= MIN_PLAN_STEPS ? steps : [];
}

/** Finds the `plan` array in raw text whose JSON did not parse (truncation, fences). */
export function extractPlanArray(text: string): unknown {
  const key = /"plan"\s*:\s*\[/.exec(text);
  if (!key) return null;

  const start = key.index + key[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null; // array still open: the plan has not finished arriving
}

/** The plan as the researcher sees it, before any step runs. */
export function formatPlanAnnouncement(steps: AnalysisStep[]): string {
  const lines = steps.map((s, i) => `${i + 1}. **${s.title}**${s.goal !== s.title ? ` — ${s.goal}` : ""}`);
  return [
    "## Plano de análise",
    "",
    `Esta pergunta precisa de ${steps.length} etapas encadeadas. Vou executar uma de cada vez, usando o resultado de cada etapa na seguinte:`,
    "",
    ...lines,
  ].join(String.fromCharCode(10));
}

/** Heading prepended to the message of each executed step. */
export function formatStepHeading(step: AnalysisStep, index: number, total: number): string {
  return `### Etapa ${index + 1} de ${total} — ${step.title}`;
}

/** Short status line for the loading indicator while a step runs. */
export function formatStepStage(step: AnalysisStep, index: number, total: number): string {
  return `Etapa ${index + 1} de ${total}: ${step.title}`;
}

/**
 * The original question is restated on every step, so a pasted block (the spreadsheet
 * selection is appended as CSV) would otherwise be billed once per step. It was
 * already read in full by the turn that produced the plan.
 */
const MAX_QUESTION_CHARS = 2000;

function restateQuestion(question: string): string {
  const text = question.trim();
  if (text.length <= MAX_QUESTION_CHARS) return text;
  return `${text.slice(0, MAX_QUESTION_CHARS).trim()}${String.fromCharCode(10)}[...trecho colado omitido aqui; ele já foi considerado ao montar o plano...]`;
}

/**
 * The user-role message for one step. It restates the original question because the
 * history is condensed, and states the step's position so the model does not redo
 * work that already ran.
 */
export function buildStepMessage(
  question: string,
  steps: AnalysisStep[],
  index: number
): string {
  const NL = String.fromCharCode(10);
  const total = steps.length;
  const remaining = steps
    .slice(index + 1)
    .map((s, i) => `${index + i + 2}. ${s.title}`)
    .join(NL);

  const parts = [
    `Pergunta original do pesquisador: ${restateQuestion(question)}`,
    `Você está executando a ETAPA ${index + 1} DE ${total} do plano acordado.`,
    `Objetivo desta etapa: ${steps[index].goal}`,
  ];

  if (remaining) {
    parts.push(`Etapas que ainda virão depois desta (NÃO as execute agora):${NL}${remaining}`);
  } else {
    parts.push("Esta é a última etapa de análise do plano.");
  }

  return parts.join(NL + NL);
}

/** The closing turn: reads the numbers the steps produced and answers the question. */
export function buildSynthesisMessage(question: string, steps: AnalysisStep[]): string {
  const NL = String.fromCharCode(10);
  return [
    `Pergunta original do pesquisador: ${restateQuestion(question)}`,
    `As ${steps.length} etapas do plano já foram executadas e seus resultados estão no histórico.`,
    "Escreva agora a SÍNTESE FINAL: responda à pergunta original citando os números concretos que saíram das etapas, aponte as limitações reais encontradas (ausentes, pressupostos violados, tamanho de amostra) e não gere código.",
  ].join(NL + NL);
}
