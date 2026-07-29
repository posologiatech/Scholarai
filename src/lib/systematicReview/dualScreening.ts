export type ScreeningDecisionValue = "include" | "exclude" | "maybe" | "pending";

export interface ScreeningDecisionRow {
  id: string;
  review_id: string;
  paper_id: string;
  user_id: string;
  decision: string;
  notes: string | null;
}

export interface ReviewerAssignment {
  id: string;
  review_id: string;
  user_id: string;
  role: "reviewer" | "adjudicator";
  project_member_id: string | null;
}

export type PaperReconciliation =
  | { status: "pending" }
  | { status: "agreed"; decision: ScreeningDecisionValue }
  | { status: "conflict" }
  | { status: "resolved"; decision: ScreeningDecisionValue };

/**
 * Reconciles independent reviewer decisions for one paper: agreement wins outright,
 * disagreement is a conflict unless an adjudicator decision is present to break the tie.
 */
export function reconcilePaper(
  decisions: ScreeningDecisionRow[],
  reviewerUserIds: string[],
  adjudicatorUserId?: string | null,
): PaperReconciliation {
  const reviewerDecisions = decisions.filter(
    (d) => reviewerUserIds.includes(d.user_id) && d.decision !== "pending",
  );
  if (reviewerDecisions.length < reviewerUserIds.length) return { status: "pending" };

  const distinct = new Set(reviewerDecisions.map((d) => d.decision));
  if (distinct.size === 1) {
    return { status: "agreed", decision: reviewerDecisions[0].decision as ScreeningDecisionValue };
  }

  const adjudication = adjudicatorUserId
    ? decisions.find((d) => d.user_id === adjudicatorUserId && d.decision !== "pending")
    : undefined;
  if (adjudication) return { status: "resolved", decision: adjudication.decision as ScreeningDecisionValue };

  return { status: "conflict" };
}

/** Cohen's kappa for two raters over an arbitrary set of categorical decisions. */
export function cohensKappa(pairs: [string, string][]): number | null {
  if (pairs.length < 2) return null;
  const categories = new Set<string>();
  pairs.forEach(([a, b]) => { categories.add(a); categories.add(b); });
  const n = pairs.length;
  let agree = 0;
  const countA: Record<string, number> = {};
  const countB: Record<string, number> = {};
  for (const [a, b] of pairs) {
    if (a === b) agree++;
    countA[a] = (countA[a] || 0) + 1;
    countB[b] = (countB[b] || 0) + 1;
  }
  const po = agree / n;
  let pe = 0;
  for (const c of categories) {
    pe += ((countA[c] || 0) / n) * ((countB[c] || 0) / n);
  }
  if (pe === 1) return 1;
  return (po - pe) / (1 - pe);
}
