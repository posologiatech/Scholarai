import { cohensKappa } from "@/lib/systematicReview/dualScreening";
import type { Bilingual } from "./types";

export type Phase = "title_abstract" | "full_text";
export type Vote = "include" | "exclude" | "maybe";
export type ScreenStatus = "pending" | "ta_excluded" | "full_text" | "ft_excluded" | "included";

export interface DecisionRow {
  record_id: string;
  phase: Phase;
  decision: Vote;
  reason_code: string | null;
  source: "human" | "ai" | "adjudication";
  user_id: string | null;
  ai_score?: number | null;
}

/** Standard reasons for excluding at full text; the PRISMA diagram reports a count per reason. */
export const EXCLUSION_REASONS: { code: string; label: Bilingual; only?: string[] }[] = [
  { code: "wrong_population", label: { pt: "População diferente da pergunta", en: "Wrong population" } },
  { code: "wrong_intervention", label: { pt: "Intervenção, exposição ou conceito diferente", en: "Wrong intervention, exposure or concept" } },
  { code: "wrong_comparator", label: { pt: "Comparador inadequado", en: "Wrong comparator" }, only: ["systematic", "rapid", "umbrella"] },
  { code: "wrong_outcome", label: { pt: "Desfecho não avaliado", en: "Outcome not assessed" } },
  { code: "wrong_context", label: { pt: "Contexto fora do escopo", en: "Out-of-scope context" }, only: ["scoping", "integrative"] },
  { code: "wrong_design", label: { pt: "Desenho de estudo não elegível", en: "Ineligible study design" } },
  { code: "wrong_publication_type", label: { pt: "Tipo de publicação (editorial, resumo de congresso, carta)", en: "Publication type (editorial, conference abstract, letter)" } },
  { code: "wrong_language", label: { pt: "Idioma não elegível", en: "Ineligible language" } },
  { code: "no_full_text", label: { pt: "Texto completo indisponível", en: "Full text unavailable" } },
  { code: "duplicate_found", label: { pt: "Duplicata identificada na leitura", en: "Duplicate found while reading" } },
  { code: "other", label: { pt: "Outro motivo", en: "Other reason" } },
];

export const reasonsFor = (reviewType: string) => EXCLUSION_REASONS.filter((r) => !r.only || r.only.includes(reviewType));

/**
 * At title/abstract "maybe" and "include" both send the record on to full text, so a reviewer
 * saying "maybe" and another "include" is agreement, not a conflict.
 */
export const normalize = (phase: Phase, v: Vote): "advance" | "exclude" | "maybe" =>
  phase === "title_abstract" ? (v === "exclude" ? "exclude" : "advance") : v === "include" ? "advance" : v === "exclude" ? "exclude" : "maybe";

export type Reconciled =
  | { status: "pending" }
  | { status: "agreed"; outcome: "advance" | "exclude"; reasonCode: string | null }
  | { status: "conflict" }
  | { status: "adjudicated"; outcome: "advance" | "exclude"; reasonCode: string | null };

/**
 * One record, one phase. AI rows never count. With a single required reviewer that reviewer's
 * vote decides; with several, all must vote and agree, otherwise an adjudication breaks the tie.
 */
export function reconcile(votes: DecisionRow[], phase: Phase, reviewerIds: string[]): Reconciled {
  const humans = votes.filter((v) => v.phase === phase && v.source === "human" && v.user_id && reviewerIds.includes(v.user_id));
  const adjud = votes.find((v) => v.phase === phase && v.source === "adjudication");
  const voted = new Set(humans.map((v) => v.user_id));
  const outcomes = humans.map((v) => normalize(phase, v.decision));
  const firstReason = humans.find((v) => v.decision === "exclude" && v.reason_code)?.reason_code ?? null;

  if (voted.size < reviewerIds.length) {
    // A decision by the adjudicator can settle a record even before every reviewer has voted.
    if (adjud) return { status: "adjudicated", outcome: normalize(phase, adjud.decision) === "exclude" ? "exclude" : "advance", reasonCode: adjud.reason_code };
    return { status: "pending" };
  }
  if (outcomes.every((o) => o === outcomes[0]) && outcomes[0] !== "maybe") {
    return { status: "agreed", outcome: outcomes[0] === "exclude" ? "exclude" : "advance", reasonCode: outcomes[0] === "exclude" ? firstReason : null };
  }
  if (adjud) return { status: "adjudicated", outcome: normalize(phase, adjud.decision) === "exclude" ? "exclude" : "advance", reasonCode: adjud.reason_code ?? firstReason };
  return { status: "conflict" };
}

export function reconcileAll(recordIds: string[], decisions: DecisionRow[], phase: Phase, reviewerIds: string[]): Map<string, Reconciled> {
  const byRecord = new Map<string, DecisionRow[]>();
  for (const d of decisions) (byRecord.get(d.record_id) ?? byRecord.set(d.record_id, []).get(d.record_id)!).push(d);
  const out = new Map<string, Reconciled>();
  for (const id of recordIds) out.set(id, reconcile(byRecord.get(id) ?? [], phase, reviewerIds));
  return out;
}

export interface PhaseSummary { total: number; pending: number; conflicts: number; advance: number; exclude: number; closable: boolean }

export function summarizePhase(rec: Map<string, Reconciled>): PhaseSummary {
  let pending = 0, conflicts = 0, advance = 0, exclude = 0;
  for (const r of rec.values()) {
    if (r.status === "pending") pending++;
    else if (r.status === "conflict") conflicts++;
    else if (r.outcome === "advance") advance++;
    else exclude++;
  }
  return { total: rec.size, pending, conflicts, advance, exclude, closable: rec.size > 0 && pending === 0 && conflicts === 0 };
}

/** Cohen's kappa between the first two reviewers over records both have voted on. */
export function agreement(decisions: DecisionRow[], phase: Phase, reviewerIds: string[]): { kappa: number | null; compared: number } {
  if (reviewerIds.length < 2) return { kappa: null, compared: 0 };
  const [a, b] = reviewerIds;
  const va = new Map<string, string>(), vb = new Map<string, string>();
  for (const d of decisions) {
    if (d.phase !== phase || d.source !== "human") continue;
    if (d.user_id === a) va.set(d.record_id, normalize(phase, d.decision));
    if (d.user_id === b) vb.set(d.record_id, normalize(phase, d.decision));
  }
  const pairs: [string, string][] = [];
  for (const [id, x] of va) if (vb.has(id)) pairs.push([x, vb.get(id)!]);
  return { kappa: cohensKappa(pairs), compared: pairs.length };
}

/**
 * Reason recorded for a full-text exclusion: the adjudicator's if there is one, else the first
 * reviewer's. PRISMA counts each excluded report under a single reason.
 */
export const reasonOf = (r: Reconciled): string | null => (r.status === "agreed" || r.status === "adjudicated" ? r.reasonCode : null);

export interface PrismaCounts {
  identified: number; duplicatesRemoved: number; screened: number; excludedScreening: number;
  includedFullText: number; excludedFullText: number; finalIncluded: number; excludedReasons: Record<string, number>;
}

/** PRISMA numbers from the stored status of every record, so the diagram can never disagree with the data. */
export function prismaCounts(rows: { duplicate_of: string | null; screen_status: ScreenStatus; exclusion_reason_code: string | null }[]): PrismaCounts {
  const c: PrismaCounts = { identified: rows.length, duplicatesRemoved: 0, screened: 0, excludedScreening: 0, includedFullText: 0, excludedFullText: 0, finalIncluded: 0, excludedReasons: {} };
  for (const r of rows) {
    if (r.duplicate_of) { c.duplicatesRemoved++; continue; }
    c.screened++;
    if (r.screen_status === "ta_excluded") c.excludedScreening++;
    if (r.screen_status === "full_text" || r.screen_status === "ft_excluded" || r.screen_status === "included") c.includedFullText++;
    if (r.screen_status === "ft_excluded") {
      c.excludedFullText++;
      const k = r.exclusion_reason_code ?? "other";
      c.excludedReasons[k] = (c.excludedReasons[k] ?? 0) + 1;
    }
    if (r.screen_status === "included") c.finalIncluded++;
  }
  return c;
}
