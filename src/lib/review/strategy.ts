import type { ReviewRecord } from "./protocol";
import type { QueryBlock, QueryFilters } from "./query";
import type { ReviewTypeDef } from "./types";

export interface Strategy {
  sources: string[];
  blocks: QueryBlock[];
  filters: QueryFilters;
}

/** Sources the review-harvest edge function can page through. Everything else is imported. */
export const HARVESTABLE = new Set(["pubmed", "europe_pmc", "openalex", "clinical_trials", "bdtd"]);

/** Framework fields that become search blocks (comparison and design are rarely searched). */
const SKIP = new Set(["comparison", "design"]);

export function blocksFromFramework(def: ReviewTypeDef, framework: Record<string, string>, locale: "pt" | "en"): QueryBlock[] {
  return def.framework.fields
    .filter((f) => !SKIP.has(f.key))
    .map((f) => ({
      id: f.key,
      label: f.label[locale],
      terms: framework?.[f.key]?.trim() ? [framework[f.key].trim()] : [],
      headings: [],
    }));
}

export function getStrategy(review: ReviewRecord, def: ReviewTypeDef): Strategy {
  const saved = (review.stage_state?.strategy as Partial<Strategy> | undefined) ?? {};
  return {
    sources: saved.sources ?? [],
    blocks: saved.blocks?.length ? saved.blocks : blocksFromFramework(def, review.framework, review.locale),
    filters: saved.filters ?? {},
  };
}

export function withStrategy(review: ReviewRecord, strategy: Strategy): Partial<ReviewRecord> {
  return { stage_state: { ...review.stage_state, strategy } };
}

export function getFlags(review: ReviewRecord): Record<string, boolean> {
  return (review.stage_state?.flags as Record<string, boolean> | undefined) ?? {};
}

export function withFlags(review: ReviewRecord, patch: Record<string, boolean>): Partial<ReviewRecord> {
  return { stage_state: { ...review.stage_state, flags: { ...getFlags(review), ...patch } } };
}
