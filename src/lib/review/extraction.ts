import type { ExtractionField, ReviewTypeDef } from "./types";
import type { ReviewRecord } from "./protocol";

export interface CustomField { key: string; label: string; kind: "text" | "number" | "list" }

export interface FieldSpec { key: string; label: string; kind: ExtractionField["kind"]; choices?: string[]; custom?: boolean }

export function getCustomFields(review: ReviewRecord): CustomField[] {
  return ((review.stage_state?.extraction as { fields?: CustomField[] } | undefined)?.fields) ?? [];
}

/** The definition's fields plus any the team added during the pilot (scoping reviews refine the form as they go). */
export function fieldsFor(def: ReviewTypeDef, review: ReviewRecord): FieldSpec[] {
  const base = def.extractionFields.map((f) => ({ key: f.key, label: f.label[review.locale], kind: f.kind, choices: f.choices }));
  return [...base, ...getCustomFields(review).map((f) => ({ key: f.key, label: f.label, kind: f.kind, custom: true }))];
}

export function slugKey(label: string, taken: Set<string>): string {
  const base = "x_" + (label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "campo");
  let k = base, i = 2;
  while (taken.has(k)) k = `${base}_${i++}`;
  return k;
}

export interface Proposal { value: string; quote: string | null; verified: boolean }

export type Data = Record<string, string>;

/** Share of fields that have a value. A record is only "verified" by the reviewer's explicit action. */
export function completeness(fields: FieldSpec[], data: Data): { filled: number; total: number } {
  return { filled: fields.filter((f) => (data[f.key] ?? "").trim() !== "").length, total: fields.length };
}

/** Fields the reviewer has not touched yet and the AI has a verified proposal for. */
export function acceptable(fields: FieldSpec[], data: Data, proposals: Record<string, Proposal>): string[] {
  return fields.filter((f) => !(data[f.key] ?? "").trim() && proposals[f.key]?.value && proposals[f.key].verified).map((f) => f.key);
}

export function validateValue(kind: FieldSpec["kind"], value: string, choices?: string[]): string | null {
  const v = value.trim();
  if (!v) return null;
  if (kind === "number" && !Number.isFinite(Number(v.replace(",", ".")))) return "number";
  if (kind === "choice" && choices && !choices.includes(v)) return "choice";
  return null;
}
