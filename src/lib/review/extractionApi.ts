import { supabase } from "@/integrations/supabase/client";
import { isComplete, type ToolId } from "./appraisal";
import type { Data, Proposal } from "./extraction";

const db = supabase as unknown as { from: (t: string) => any; functions: typeof supabase.functions };

export interface IncludedRecord {
  id: string; title: string; authors: string[]; year: number | null; abstract: string | null;
  study_design: string | null; doi: string | null; source: string; external_id: string | null; url: string | null;
  full_text_source: string | null; has_full_text: boolean;
}

export async function loadIncluded(reviewId: string): Promise<IncludedRecord[]> {
  const out: IncludedRecord[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("review_records")
      .select("id,title,authors,year,abstract,study_design,doi,source,external_id,url,full_text_source")
      .eq("review_id", reviewId).eq("screen_status", "included").order("year", { ascending: false }).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data.map((r: IncludedRecord) => ({ ...r, has_full_text: !!r.full_text_source })));
    if (data.length < 1000) break;
  }
  return out;
}

export async function loadText(recordId: string): Promise<{ abstract: string | null; full_text: string | null; full_text_source: string | null }> {
  const { data, error } = await db.from("review_records").select("abstract,full_text,full_text_source").eq("id", recordId).single();
  if (error) throw error;
  return data;
}

export async function saveFullText(recordId: string, text: string, source: "europe_pmc" | "pasted"): Promise<void> {
  const { error } = await db.from("review_records").update({ full_text: text.slice(0, 200000), full_text_source: source, full_text_status: "available" }).eq("id", recordId);
  if (error) throw error;
}

/** Looks for an open-access full text through the existing fetch-full-text function. */
export async function fetchFullText(r: Pick<IncludedRecord, "id" | "doi" | "source" | "external_id">): Promise<string | null> {
  const pmid = r.external_id?.startsWith("pmid_") ? r.external_id.slice(5) : undefined;
  const { data, error } = await db.functions.invoke("fetch-full-text", {
    body: { papers: [{ id: r.id, doi: r.doi ?? undefined, source: pmid ? "pubmed" : undefined, external_id: pmid }] },
  });
  if (error) throw error;
  return (data?.results?.[r.id] as string | undefined) ?? null;
}

export interface ExtractionRow { record_id: string; data: Data; evidence: Record<string, string>; ai_proposed: Record<string, Proposal>; status: "draft" | "verified" }

export async function loadMyExtractions(reviewId: string, userId: string): Promise<ExtractionRow[]> {
  const { data, error } = await db.from("review_extractions").select("record_id,data,evidence,ai_proposed,status").eq("review_id", reviewId).eq("user_id", userId);
  if (error) throw error;
  return data;
}

export async function saveExtraction(reviewId: string, userId: string, row: ExtractionRow): Promise<void> {
  const { error } = await db.from("review_extractions").upsert(
    { review_id: reviewId, user_id: userId, ...row, updated_at: new Date().toISOString() }, { onConflict: "record_id,user_id" });
  if (error) throw error;
}

export interface AppraisalRow { record_id: string; tool: ToolId; domains: Record<string, { judgement: string; quote?: string | null; verified?: boolean }>; overall: string | null }

export async function loadMyAppraisals(reviewId: string, userId: string): Promise<AppraisalRow[]> {
  const { data, error } = await db.from("review_appraisals").select("record_id,tool,domains,overall").eq("review_id", reviewId).eq("user_id", userId);
  if (error) throw error;
  return data;
}

export async function saveAppraisal(reviewId: string, userId: string, row: AppraisalRow): Promise<void> {
  const { error } = await db.from("review_appraisals").upsert(
    { review_id: reviewId, user_id: userId, ...row, updated_at: new Date().toISOString() }, { onConflict: "record_id,user_id,tool" });
  if (error) throw error;
}

export interface AiItem { key: string; label: string; kind?: string; choices?: string[]; scale?: string[] }

export async function aiExtract(args: { reviewId: string; recordId: string; mode: "extract" | "appraise"; items: AiItem[]; toolName?: string }): Promise<{ proposals: { key: string; value: string; quote: string | null; verified: boolean }[]; source: "full_text" | "abstract"; truncated: boolean }> {
  const { data, error } = await db.functions.invoke("review-ai-extract", { body: args });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.message ?? body?.error ?? error.message);
  }
  return data;
}

export interface Progress { included: number; extracted: number; appraised: number }

/** How far the current user is: extraction rows they verified and appraisals they completed. */
export async function loadProgress(reviewId: string, userId: string): Promise<Progress> {
  const [{ data: inc, error }, ex, ap] = await Promise.all([
    db.from("review_records").select("id").eq("review_id", reviewId).eq("screen_status", "included").range(0, 4999),
    loadMyExtractions(reviewId, userId),
    loadMyAppraisals(reviewId, userId),
  ]);
  if (error) throw error;
  // Count only records that are still included: a reopened screening phase can drop some.
  const included = new Set<string>(inc.map((r: { id: string }) => r.id));
  const done = new Set<string>();
  for (const a of ap) {
    if (!included.has(a.record_id)) continue;
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.domains ?? {})) d[k] = v.judgement;
    if (isComplete(a.tool, d, a.overall)) done.add(a.record_id);
  }
  return { included: included.size, extracted: ex.filter((e) => e.status === "verified" && included.has(e.record_id)).length, appraised: done.size };
}
