import type { ReviewTypeId } from "../databases";

export type Bilingual = { pt: string; en: string };

/** The eight stages every review type passes through; types differ in how each one is run. */
export const UNIVERSAL_STAGES = [
  "scope", "protocol", "strategy", "search", "screening", "appraisal", "synthesis", "writing",
] as const;
export type StageKey = (typeof UNIVERSAL_STAGES)[number];

/** A condition the review state must meet before the user may leave a stage. */
export type GateCheck =
  | { kind: "field"; field: string; label: Bilingual }                  // non-empty field on the review
  | { kind: "count"; metric: string; min: number; label: Bilingual }     // numeric metric >= min
  | { kind: "flag"; flag: string; label: Bilingual };                    // explicit user confirmation/decision

export interface StageDef {
  key: StageKey;
  title: Bilingual;
  description: Bilingual;
  /** What the AI may do here. Humans always approve. */
  aiRole: Bilingual;
  gate: GateCheck[];
  /** Existing component/function this stage is wired to (phase 1+ resolves it). */
  uses: string[];
  /** Stage is offered but may be skipped with a recorded justification. */
  optional?: boolean;
}

export interface FrameworkField { key: string; label: Bilingual; hint: Bilingual; required: boolean }

export interface Reference { citation: string; role: "method" | "reporting" | "appraisal" | "registry" | "synthesis" }

export interface AppraisalTool { id: string; label: string; appliesTo: Bilingual; required: boolean }

export interface ExtractionField { key: string; label: Bilingual; kind: "text" | "number" | "choice" | "list"; choices?: string[] }

export interface ArtifactDef { kind: string; label: Bilingual; type: "figure" | "table" }

export interface ReviewTypeDef {
  id: ReviewTypeId;
  /** Bump when the process definition changes; stored on each review. */
  version: string;
  label: Bilingual;
  summary: Bilingual;
  framework: { name: string; fields: FrameworkField[] };
  registry: { name: string; url: string; required: boolean } | null;
  reportingGuideline: { id: string; name: string };
  appraisal: { tools: AppraisalTool[]; required: boolean };
  screening: { dual: "required" | "recommended" | "optional"; phases: ("title_abstract" | "full_text")[] };
  synthesis: Bilingual;
  extractionFields: ExtractionField[];
  artifacts: ArtifactDef[];
  stages: StageDef[];
  references: Reference[];
  /**
   * Methodological content here was written from the published guidance but has NOT yet been
   * checked by a domain expert against the current guideline versions. The UI must show this
   * until an expert signs off (phase 0 exit criterion).
   */
  review: { status: "pending-expert-review" | "verified"; verifiedBy?: string; verifiedAt?: string };
}

export function validateDefinition(def: ReviewTypeDef): string[] {
  const errors: string[] = [];
  const keys = def.stages.map((s) => s.key);
  if (new Set(keys).size !== keys.length) errors.push("duplicate stage key");
  const order = keys.map((k) => UNIVERSAL_STAGES.indexOf(k));
  if (order.some((i) => i < 0)) errors.push("unknown stage key");
  if (order.some((v, i) => i > 0 && v <= order[i - 1])) errors.push("stages out of order");
  for (const must of ["scope", "search", "screening", "writing"] as StageKey[]) {
    if (!keys.includes(must)) errors.push(`missing mandatory stage: ${must}`);
  }
  if (def.stages.some((s) => s.key !== "writing" && s.gate.length === 0 && !s.optional)) {
    errors.push("non-optional stage without a gate");
  }
  if (!def.references.length) errors.push("no cited methodological source");
  if (!def.framework.fields.some((f) => f.required)) errors.push("framework has no required field");
  if (new Set(def.extractionFields.map((f) => f.key)).size !== def.extractionFields.length) errors.push("duplicate extraction field");
  if (def.appraisal.required && def.appraisal.tools.length === 0) errors.push("appraisal required but no tool");
  return errors;
}

/** Snapshot the engine evaluates gates against; filled from the database by the hook in phase 1. */
export interface ReviewState {
  fields: Record<string, unknown>;
  metrics: Record<string, number>;
  flags: Record<string, boolean>;
}

export interface GateResult { ok: boolean; missing: Bilingual[] }

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v != null);

export function evaluateGate(stage: StageDef, state: ReviewState): GateResult {
  const missing: Bilingual[] = [];
  for (const c of stage.gate) {
    const ok =
      c.kind === "field" ? filled(state.fields[c.field])
      : c.kind === "count" ? (state.metrics[c.metric] ?? 0) >= c.min
      : state.flags[c.flag] === true;
    if (!ok) missing.push(c.label);
  }
  return { ok: missing.length === 0, missing };
}

/** First stage whose gate is not met, i.e. where the guided flow should resume. */
export function currentStage(def: ReviewTypeDef, state: ReviewState): StageDef {
  for (const s of def.stages) {
    if (s.optional && state.flags[`skip:${s.key}`]) continue;
    if (!evaluateGate(s, state).ok) return s;
  }
  return def.stages[def.stages.length - 1];
}
