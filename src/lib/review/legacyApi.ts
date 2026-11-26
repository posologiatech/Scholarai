import { supabase } from "@/integrations/supabase/client";
import { createEditorDocument } from "./writeApi";
import { logEvent } from "./api";
import { insertRecords } from "./records";
import { mapLegacy, type LegacyReview, type Migration } from "./legacy";
import { SOURCES } from "./databases";
import { getReviewType } from "./types";

const db = supabase as unknown as { from: (t: string) => any };

export async function listLegacyReviews(): Promise<LegacyReview[]> {
  const { data, error } = await db.from("systematic_reviews").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as LegacyReview[];
}

export interface MigrationResult { reviewId: string; warnings: string[]; records: number; documentId: string | null }

/**
 * Copies one legacy review into the guided-reviews module. The legacy row is left untouched. If any
 * step fails the half-built review is deleted (its children go with it), so nothing partial is left.
 */
export async function migrateLegacyReview(legacy: LegacyReview, userId: string, locale: "pt" | "en"): Promise<MigrationResult> {
  const plan: Migration = mapLegacy(legacy);
  const def = getReviewType("systematic")!;
  const { data: review, error } = await db.from("reviews").insert({
    owner_id: userId, review_type: "systematic", definition_version: def.version, locale, area: "health", legacy_systematic_review_id: legacy.id, ...plan.review,
  }).select("id").single();
  if (error) throw error;
  const reviewId: string = review.id;

  try {
    const searchIds = new Map<string, string>();
    for (const s of plan.searches) {
      const { data, error: e } = await db.from("review_searches").insert({
        review_id: reviewId, source: s.source, method: "import", interface: "migrated", query: legacy.search_strategy ?? "", imported_count: s.count,
        notes: `Migrada da revisão sistemática anterior (${SOURCES.find((x) => x.id === s.source)?.label ?? s.source}); a data original da busca não foi guardada.`, created_by: userId,
      }).select("id").single();
      if (e) throw e;
      searchIds.set(s.source, data.id);
    }

    await insertRecords(plan.records.map((r) => ({
      review_id: reviewId, search_id: searchIds.get(r.source)!, source: r.source, external_id: r.legacyId, doi: r.doi, title: r.title, authors: r.authors, year: r.year,
      abstract: r.abstract, journal: r.journal, url: r.url, study_design: r.study_design, dedupe_key: r.dedupe_key,
    })));

    // Screening outcome: set per group so the PRISMA numbers match the legacy review's decisions.
    const byLegacy = new Map<string, string>();
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await db.from("review_records").select("id,external_id").eq("review_id", reviewId).order("id").range(from, from + 999);
      if (e) throw e;
      for (const r of data) byLegacy.set(r.external_id, r.id);
      if (data.length < 1000) break;
    }
    for (const status of ["included", "ta_excluded"] as const) {
      const ids = plan.records.filter((r) => r.screen_status === status).map((r) => byLegacy.get(r.legacyId)!).filter(Boolean);
      for (let i = 0; i < ids.length; i += 100) {
        const { error: e } = await db.from("review_records").update({ screen_status: status }).in("id", ids.slice(i, i + 100));
        if (e) throw e;
      }
    }

    if (plan.extraction.rows.length) {
      const rows = plan.extraction.rows.filter((r) => byLegacy.has(r.legacyId)).map((r) => ({ review_id: reviewId, record_id: byLegacy.get(r.legacyId), user_id: userId, data: r.data, evidence: {}, ai_proposed: {}, status: "draft" }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error: e } = await db.from("review_extractions").insert(rows.slice(i, i + 200));
        if (e) throw e;
      }
    }

    let documentId: string | null = null;
    if (plan.reportHtml) documentId = await createEditorDocument(userId, `Relatório anterior: ${legacy.research_question.slice(0, 80)}`, plan.reportHtml, legacy.research_project_id);
    await logEvent(reviewId, userId, "migrated_from_legacy", { legacy_id: legacy.id, records: plan.records.length, warnings: plan.warnings.length });
    return { reviewId, warnings: plan.warnings, records: plan.records.length, documentId };
  } catch (e) {
    await db.from("reviews").delete().eq("id", reviewId);
    throw e;
  }
}
