import { supabase } from "@/integrations/supabase/client";
import type { DedupeRecord, DuplicateGroup } from "./dedupe";
import type { NewRecord } from "./importer";

const db = supabase as unknown as { from: (t: string) => any; functions: typeof supabase.functions };

export interface SearchRow {
  id: string;
  review_id: string;
  source: string;
  method: "api" | "import" | "manual";
  interface: string | null;
  query: string;
  filters: Record<string, unknown>;
  run_at: string;
  results_count: number | null;
  imported_count: number;
  notes: string | null;
}

export async function listSearches(reviewId: string): Promise<SearchRow[]> {
  const { data, error } = await db.from("review_searches").select("*").eq("review_id", reviewId).order("run_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSearch(row: Omit<SearchRow, "id" | "run_at" | "imported_count"> & { created_by: string }): Promise<SearchRow> {
  const { data, error } = await db.from("review_searches").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateSearch(id: string, patch: Partial<SearchRow>): Promise<void> {
  const { error } = await db.from("review_searches").update(patch).eq("id", id);
  if (error) throw error;
}

export async function insertRecords(rows: NewRecord[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await db.from("review_records").insert(chunk);
    if (error) throw error;
    n += chunk.length;
  }
  return n;
}

/** Records not yet merged as duplicates, in pages of 1000 (the API's row cap). */
export async function loadActiveRecords(reviewId: string): Promise<(DedupeRecord & { source: string })[]> {
  const out: (DedupeRecord & { source: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("review_records")
      .select("id,title,year,authors,doi,abstract,source,screen_status")
      .eq("review_id", reviewId)
      .is("duplicate_of", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...data.map((r: { screen_status?: string }) => ({ ...r, locked: r.screen_status != null && r.screen_status !== "pending" })));
    if (data.length < 1000) break;
  }
  return out;
}

export async function markDuplicates(groups: DuplicateGroup[]): Promise<void> {
  for (const g of groups) {
    for (let i = 0; i < g.duplicateIds.length; i += 100) {
      const { error } = await db.from("review_records").update({ duplicate_of: g.keepId }).in("id", g.duplicateIds.slice(i, i + 100));
      if (error) throw error;
    }
  }
}

export interface ReviewMetrics {
  total: number;
  active: number;
  duplicates: number;
  searchedSources: number;
}

export async function loadMetrics(reviewId: string): Promise<ReviewMetrics> {
  const count = async (apply?: (q: any) => any) => {
    let q = db.from("review_records").select("id", { count: "exact", head: true }).eq("review_id", reviewId);
    if (apply) q = apply(q);
    const { count: c, error } = await q;
    if (error) throw error;
    return c ?? 0;
  };
  const [total, active, searches] = await Promise.all([
    count(),
    count((q) => q.is("duplicate_of", null)),
    listSearches(reviewId),
  ]);
  return { total, active, duplicates: total - active, searchedSources: new Set(searches.map((s) => s.source)).size };
}

export interface HarvestProgress { fetched: number; total: number | null; page: number }

export class HarvestKeyError extends Error {}

/**
 * Pages through one source via the review-harvest function and stores each page as it arrives,
 * so a dropped connection keeps what was already collected. Stops at `cap` records.
 */
export async function harvest(args: {
  reviewId: string; source: string; query: string; searchId: string; cap: number;
  toRows: (papers: any[]) => NewRecord[];
  onProgress: (p: HarvestProgress) => void;
  signal: AbortSignal;
}): Promise<{ fetched: number; total: number | null; truncated: boolean }> {
  let cursor: string | null = null;
  let fetched = 0;
  let total: number | null = null;
  let page = 0;
  for (;;) {
    if (args.signal.aborted) return { fetched, total, truncated: true };
    const { data, error } = await db.functions.invoke("review-harvest", {
      body: { reviewId: args.reviewId, source: args.source, query: args.query, cursor },
    });
    if (error) {
      const body = await (error as any).context?.json?.().catch(() => null);
      if (body?.code === "source_requires_key") throw new HarvestKeyError(body.error);
      throw new Error(body?.error ?? error.message);
    }
    page++;
    total = data.total ?? total;
    const room = args.cap - fetched;
    const rows = args.toRows(data.records.slice(0, room));
    if (rows.length) await insertRecords(rows);
    fetched += Math.min(data.records.length, room);
    args.onProgress({ fetched, total, page });
    if (!data.next) return { fetched, total, truncated: false };
    if (fetched >= args.cap) return { fetched, total, truncated: true };
    cursor = data.next;
  }
}
