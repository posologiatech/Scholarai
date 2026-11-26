import { SOURCES } from "./databases";
import { fieldsFor } from "./extraction";
import { loadIncluded, loadMyAppraisals, loadMyExtractions, type IncludedRecord } from "./extractionApi";
import { withKeys, type FactsInput } from "./facts";
import type { ReviewRecord } from "./protocol";
import { listSearches } from "./records";
import { agreement, prismaCounts, reasonsFor } from "./screening";
import { listMembers, loadDecisions, loadStatusRows } from "./screeningApi";
import { getFlags } from "./strategy";
import { overlapOf } from "./overlap";
import { getSynthesis, loadExcluded } from "./synthesis";
import type { ReviewTypeDef } from "./types";
import type { WritingState } from "./manuscript";

export interface WritingData { input: FactsInput; records: IncludedRecord[]; excluded: Awaited<ReturnType<typeof loadExcluded>>; statusRows: Awaited<ReturnType<typeof loadStatusRows>> }

/** Everything the manuscript needs, read as the review owner (the only person who can see all the votes). */
export async function loadWritingData(def: ReviewTypeDef, review: ReviewRecord, userId: string): Promise<WritingData> {
  const [records, extractions, appraisals, searches, excluded, statusRows, members, decisions] = await Promise.all([
    loadIncluded(review.id), loadMyExtractions(review.id, userId), loadMyAppraisals(review.id, userId), listSearches(review.id), loadExcluded(review.id), loadStatusRows(review.id),
    listMembers(review.id), loadDecisions(review.id, "title_abstract"),
  ]);
  const reviewerIds = [review.owner_id, ...members.filter((m) => m.role === "reviewer").map((m) => m.user_id)];
  const syn = getSynthesis(review);
  const writing = (review.stage_state?.writing as WritingState | undefined) ?? {};
  const disclosure = review.ai_disclosure ?? [];
  const aiUses = [
    ...(disclosure.some((d) => d.feature === "title_abstract_screening") ? ["screening"] : []),
    ...(extractions.some((e) => Object.keys(e.ai_proposed ?? {}).length > 0) ? ["extraction"] : []),
    ...((writing.aiDrafted ?? []).length ? ["drafting"] : []),
  ];
  const k = agreement(decisions, "title_abstract", reviewerIds);
  const input: FactsInput = {
    locale: review.locale, def, review, studies: withKeys(records), fields: fieldsFor(def, review),
    extraction: new Map(extractions.map((e) => [e.record_id, e.data])), appraisals, grade: syn.grade ?? [], themes: syn.themes ?? [], assign: syn.assign ?? {}, synthesis: syn,
    prisma: prismaCounts(statusRows), reasonLabels: Object.fromEntries(reasonsFor(review.review_type).map((r) => [r.code, r.label[review.locale]])),
    searches: searches.map((s) => ({ source: s.source, label: SOURCES.find((x) => x.id === s.source)?.label ?? s.source, method: s.method, query: s.query, run_at: s.run_at, results_count: s.results_count, imported_count: s.imported_count })),
    screening: { reviewers: reviewerIds.length, kappaTitleAbstract: k.kappa, aiScreening: aiUses.includes("screening"), pilot: getFlags(review).pilot_done === true },
    aiUses,
    shortcuts: (review.stage_state?.rapid as { shortcuts?: string[] } | undefined)?.shortcuts ?? [],
    cmo: syn.cmo ?? [], programTheory: syn.programTheory ?? "",
    overlap: def.id === "umbrella" ? (() => {
      const o = overlapOf(records.map((r) => ({ id: r.id, label: r.title, studies: (extractions.find((e) => e.record_id === r.id)?.data.primary_studies ?? "").split(/\n+/) })));
      return { cca: o.cca, unique: o.unique, inclusions: o.inclusions, reviews: o.reviews };
    })() : null,
  };
  return { input, records, excluded, statusRows };
}
