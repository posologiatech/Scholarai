import { supabase } from "@/integrations/supabase/client";
import type { Theme } from "./artifacts";
import { isGraded, type GradeEntry } from "./grade";
import type { ReviewRecord } from "./protocol";

export type Method = "meta_analysis" | "swim";

export interface Cmo { id: string; context: string; mechanism: string; outcome: string; evidence: string }

export interface SynthesisState {
  method?: Method;
  justification?: string;
  grade?: GradeEntry[];
  themes?: Theme[];
  /** record id -> theme ids */
  assign?: Record<string, string[]>;
  gaps?: string;
  conclusions?: string;
  programTheory?: string;
  cmo?: Cmo[];
}

export const getSynthesis = (r: ReviewRecord): SynthesisState => (r.stage_state?.synthesis as SynthesisState | undefined) ?? {};
export const withSynthesis = (r: ReviewRecord, patch: Partial<SynthesisState>): Partial<ReviewRecord> => ({
  stage_state: { ...r.stage_state, synthesis: { ...getSynthesis(r), ...patch } },
});

/**
 * Gate inputs derived from what the user wrote, so they can never drift from the content:
 * a method with a real justification, a matrix with at least one assignment, a gaps statement.
 */
export function synthesisFlags(r: ReviewRecord): Record<string, boolean> {
  const s = getSynthesis(r);
  const assigned = Object.values(s.assign ?? {}).some((ids) => ids.some((id) => (s.themes ?? []).some((t) => t.id === id)));
  return {
    synthesis_method_chosen: !!s.method && (s.justification ?? "").trim().length >= 20,
    matrix_built: (s.themes ?? []).length > 0 && assigned,
    gaps_identified: (s.gaps ?? "").trim().length >= 20,
    program_theory_written: (s.programTheory ?? "").trim().length >= 40,
    cmo_built: (s.cmo ?? []).some((c) => c.context.trim() && c.mechanism.trim() && c.outcome.trim()),
  };
}

export const outcomesGraded = (r: ReviewRecord): number => (getSynthesis(r).grade ?? []).filter(isGraded).length;

const db = supabase as unknown as { from: (t: string) => any };

export async function loadExcluded(reviewId: string): Promise<{ id: string; title: string; authors: string[]; year: number | null; reason: string | null }[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("review_records").select("id,title,authors,year,exclusion_reason_code")
      .eq("review_id", reviewId).eq("screen_status", "ft_excluded").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out.map((r) => ({ id: r.id, title: r.title, authors: r.authors ?? [], year: r.year, reason: r.exclusion_reason_code }));
}
