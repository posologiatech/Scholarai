import { supabase } from "@/integrations/supabase/client";
import type { DecisionRow, Phase, Reconciled, ScreenStatus, Vote } from "./screening";
import { reasonOf } from "./screening";

const db = supabase as unknown as { from: (t: string) => any; functions: typeof supabase.functions };

export interface Member { id: string; review_id: string; user_id: string; role: "reviewer" | "adjudicator" | "collaborator" }

export interface ScreenRecord {
  id: string; title: string; authors: string[]; year: number | null; abstract: string | null;
  journal: string | null; url: string | null; doi: string | null; source: string; screen_status: ScreenStatus;
}

export async function listMembers(reviewId: string): Promise<Member[]> {
  const { data, error } = await db.from("review_members").select("*").eq("review_id", reviewId);
  if (error) throw error;
  return data;
}

export async function addMember(reviewId: string, userId: string, role: Member["role"]): Promise<void> {
  const { error } = await db.from("review_members").insert({ review_id: reviewId, user_id: userId, role });
  if (error) throw error;
}
export async function setMemberRole(id: string, role: Member["role"]): Promise<void> {
  const { error } = await db.from("review_members").update({ role }).eq("id", id);
  if (error) throw error;
}
export async function removeMember(id: string): Promise<void> {
  const { error } = await db.from("review_members").delete().eq("id", id);
  if (error) throw error;
}

/** Everything the caller is allowed to see: their own votes, plus everyone's for owner/adjudicators. */
export async function loadDecisions(reviewId: string, phase: Phase): Promise<DecisionRow[]> {
  const out: DecisionRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("review_decisions")
      .select("record_id,phase,decision,reason_code,source,user_id,ai_score")
      .eq("review_id", reviewId).eq("phase", phase).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** Ids of the records a phase covers. Title/abstract covers every non-duplicate; full text only those that advanced. */
export async function loadCandidateIds(reviewId: string, phase: Phase): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("review_records").select("id").eq("review_id", reviewId).is("duplicate_of", null);
    if (phase === "full_text") q = q.in("screen_status", ["full_text", "ft_excluded", "included"]);
    const { data, error } = await q.order("created_at").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data.map((r: { id: string }) => r.id));
    if (data.length < 1000) break;
  }
  return out;
}

export async function loadRecords(ids: string[]): Promise<ScreenRecord[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("review_records")
    .select("id,title,authors,year,abstract,journal,url,doi,source,screen_status").in("id", ids);
  if (error) throw error;
  const byId = new Map<string, ScreenRecord>(data.map((r: ScreenRecord) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as ScreenRecord[];
}

export async function saveVote(args: {
  reviewId: string; recordId: string; phase: Phase; decision: Vote; reasonCode: string | null; userId: string;
  source: "human" | "adjudication";
}): Promise<void> {
  const row = { decision: args.decision, reason_code: args.reasonCode };
  const { data, error } = await db.from("review_decisions").update(row)
    .eq("record_id", args.recordId).eq("phase", args.phase).eq("user_id", args.userId).eq("source", args.source).select("id");
  if (error) throw error;
  if (data.length > 0) return;
  const { error: insertError } = await db.from("review_decisions").insert({
    review_id: args.reviewId, record_id: args.recordId, phase: args.phase, user_id: args.userId, source: args.source, ...row,
  });
  if (insertError) throw insertError;
}

export async function aiScreen(reviewId: string, recordIds: string[]): Promise<{ suggested: number }> {
  const { data, error } = await db.functions.invoke("review-ai-screen", { body: { reviewId, recordIds } });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.message ?? body?.error ?? error.message);
  }
  return data;
}

/** Writes the outcome of a closed phase onto the records so blind reviewers can see where each one went. */
export async function applyOutcomes(phase: Phase, outcomes: Map<string, Reconciled>): Promise<void> {
  const groups = new Map<string, { status: ScreenStatus; reason: string | null; ids: string[] }>();
  for (const [id, r] of outcomes) {
    if (r.status === "pending" || r.status === "conflict") continue;
    const status: ScreenStatus = phase === "title_abstract" ? (r.outcome === "advance" ? "full_text" : "ta_excluded") : (r.outcome === "advance" ? "included" : "ft_excluded");
    const reason = status === "ft_excluded" ? reasonOf(r) ?? "other" : null;
    const key = `${status}|${reason}`;
    (groups.get(key) ?? groups.set(key, { status, reason, ids: [] }).get(key)!).ids.push(id);
  }
  for (const g of groups.values()) {
    for (let i = 0; i < g.ids.length; i += 100) {
      // Only records still waiting for this phase change, so closing again after a living round never moves an older decision.
      const { error } = await db.from("review_records").update({ screen_status: g.status, exclusion_reason_code: g.reason }).in("id", g.ids.slice(i, i + 100)).eq("screen_status", phase === "title_abstract" ? "pending" : "full_text");
      if (error) throw error;
    }
  }
}

/** Reopening a phase sends its records back to the state before that phase was closed. */
export async function revertPhase(reviewId: string, phase: Phase): Promise<void> {
  const patch = phase === "title_abstract"
    ? db.from("review_records").update({ screen_status: "pending", exclusion_reason_code: null }).eq("review_id", reviewId).in("screen_status", ["ta_excluded", "full_text", "ft_excluded", "included"])
    : db.from("review_records").update({ screen_status: "full_text", exclusion_reason_code: null }).eq("review_id", reviewId).in("screen_status", ["ft_excluded", "included"]);
  const { error } = await patch;
  if (error) throw error;
}

export async function loadStatusRows(reviewId: string): Promise<{ duplicate_of: string | null; screen_status: ScreenStatus; exclusion_reason_code: string | null }[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("review_records").select("duplicate_of,screen_status,exclusion_reason_code").eq("review_id", reviewId).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
