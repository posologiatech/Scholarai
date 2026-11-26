import type { ReviewTypeId } from "../databases";
import { integrative } from "./integrative";
import { narrative } from "./narrative";
import { qualitative } from "./qualitative";
import { rapid } from "./rapid";
import { realist } from "./realist";
import { scoping } from "./scoping";
import type { ReviewTypeDef } from "./schema";
import { systematic } from "./systematic";
import { umbrella } from "./umbrella";

export * from "./schema";
export { RAPID_SHORTCUTS } from "./rapid";

export const REVIEW_TYPES: Record<ReviewTypeId, ReviewTypeDef> = { systematic, scoping, integrative, rapid, umbrella, narrative, qualitative, realist };

/** In the order the picker shows them: the three the module launched with, then the rest. */
export const AVAILABLE_TYPES: ReviewTypeDef[] = [systematic, scoping, integrative, rapid, umbrella, narrative, qualitative, realist];

export function getReviewType(id: string): ReviewTypeDef | undefined {
  return REVIEW_TYPES[id as ReviewTypeId];
}
