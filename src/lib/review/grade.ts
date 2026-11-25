import type { Bilingual } from "./types";

export type Design = "rct" | "observational";
export type Level = 0 | 1 | 2;

export const DOWNGRADE_DOMAINS = ["risk_of_bias", "inconsistency", "indirectness", "imprecision", "publication_bias"] as const;
export type DowngradeDomain = (typeof DOWNGRADE_DOMAINS)[number];
export const UPGRADE_FACTORS = ["large_effect", "dose_response", "plausible_confounding"] as const;
export type UpgradeFactor = (typeof UPGRADE_FACTORS)[number];

export const DOMAIN_LABEL: Record<DowngradeDomain | UpgradeFactor, Bilingual> = {
  risk_of_bias: { pt: "Risco de viés", en: "Risk of bias" },
  inconsistency: { pt: "Inconsistência", en: "Inconsistency" },
  indirectness: { pt: "Evidência indireta", en: "Indirectness" },
  imprecision: { pt: "Imprecisão", en: "Imprecision" },
  publication_bias: { pt: "Viés de publicação", en: "Publication bias" },
  large_effect: { pt: "Efeito grande", en: "Large effect" },
  dose_response: { pt: "Gradiente dose-resposta", en: "Dose-response gradient" },
  plausible_confounding: { pt: "Confusão residual a favor do efeito", en: "Plausible confounding" },
};

export interface GradeEntry {
  id: string;
  outcome: string;
  studies: number | null;
  design: Design;
  effect: string;
  /** Undefined means the domain has not been judged yet. */
  downgrades: Partial<Record<DowngradeDomain, Level>>;
  upgrades: Partial<Record<UpgradeFactor, Level>>;
  notes: string;
}

export type Certainty = 1 | 2 | 3 | 4;
export const CERTAINTY_LABEL: Record<Certainty, Bilingual> = {
  4: { pt: "Alta", en: "High" }, 3: { pt: "Moderada", en: "Moderate" }, 2: { pt: "Baixa", en: "Low" }, 1: { pt: "Muito baixa", en: "Very low" },
};
export const CERTAINTY_SYMBOL: Record<Certainty, string> = { 4: "⊕⊕⊕⊕", 3: "⊕⊕⊕◯", 2: "⊕⊕◯◯", 1: "⊕◯◯◯" };

export const isGraded = (e: GradeEntry): boolean => e.outcome.trim() !== "" && DOWNGRADE_DOMAINS.every((d) => e.downgrades[d] !== undefined);

/**
 * Certainty of the evidence for one outcome. Randomised trials start high and observational
 * studies low. Each downgrade domain removes up to two levels. Upgrades only apply to
 * observational evidence with no concern about bias, inconsistency or imprecision, since a
 * large effect cannot rescue a body of evidence that is already doubtful.
 */
export function certaintyOf(e: GradeEntry): Certainty | null {
  if (!isGraded(e)) return null;
  const start = e.design === "rct" ? 4 : 2;
  const down = DOWNGRADE_DOMAINS.reduce((n, d) => n + (e.downgrades[d] ?? 0), 0);
  const upAllowed = e.design === "observational" && (["risk_of_bias", "inconsistency", "imprecision"] as const).every((d) => (e.downgrades[d] ?? 0) === 0);
  const up = upAllowed ? UPGRADE_FACTORS.reduce((n, f) => n + (e.upgrades[f] ?? 0), 0) : 0;
  return Math.min(4, Math.max(1, start - down + up)) as Certainty;
}

export function downgradeReasons(e: GradeEntry, locale: "pt" | "en"): string[] {
  return DOWNGRADE_DOMAINS.filter((d) => (e.downgrades[d] ?? 0) > 0).map((d) => `${DOMAIN_LABEL[d][locale]} (${e.downgrades[d] === 2 ? (locale === "pt" ? "muito grave" : "very serious") : (locale === "pt" ? "grave" : "serious")})`);
}

export const newGradeEntry = (id: string): GradeEntry => ({ id, outcome: "", studies: null, design: "rct", effect: "", downgrades: {}, upgrades: {}, notes: "" });
