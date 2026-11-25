import type { ReviewTypeId } from "../databases";
import { integrative } from "./integrative";
import { scoping } from "./scoping";
import type { ReviewTypeDef } from "./schema";
import { systematic } from "./systematic";

export * from "./schema";

/** Types implemented so far. The remaining ids in ReviewTypeId arrive in phase 7. */
export const REVIEW_TYPES: Partial<Record<ReviewTypeId, ReviewTypeDef>> = { systematic, scoping, integrative };

export const AVAILABLE_TYPES: ReviewTypeDef[] = Object.values(REVIEW_TYPES) as ReviewTypeDef[];

export function getReviewType(id: string): ReviewTypeDef | undefined {
  return REVIEW_TYPES[id as ReviewTypeId];
}
