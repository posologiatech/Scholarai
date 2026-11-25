import { supabase } from "@/integrations/supabase/client";
import type { Issue } from "./facts";
import type { ItemStatus } from "./checklists";

const db = supabase as unknown as { from: (t: string) => any; functions: typeof supabase.functions };

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke("review-ai-write", { body });
  if (error) {
    const err = await (error as any).context?.json?.().catch(() => null);
    throw new Error(err?.message ?? err?.error ?? error.message);
  }
  return data as T;
}

export const aiDraft = (args: { reviewId: string; section: string; sectionTitle: string; facts: unknown; studyKeys: string[]; items: { key: string; text: string }[] }) =>
  invoke<{ text: string; issues: Issue[]; model: string }>({ mode: "draft", ...args });

export interface AuditRow { key: string; status: "met" | "partial" | "missing"; quote: string | null; note: string; verified: boolean }
export const aiAudit = (args: { reviewId: string; guideline: string; items: { key: string; text: string }[]; sections: { title: string; text: string }[] }) =>
  invoke<{ rows: AuditRow[]; truncated: boolean }>({ mode: "audit", ...args });

export interface ChecklistRow { item_key: string; status: ItemStatus; location: string | null; note: string | null }

export async function loadChecklist(reviewId: string, guideline: string): Promise<ChecklistRow[]> {
  const { data, error } = await db.from("review_checklist").select("item_key,status,location,note").eq("review_id", reviewId).eq("guideline", guideline);
  if (error) throw error;
  return data;
}

export async function saveChecklist(reviewId: string, guideline: string, rows: ChecklistRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db.from("review_checklist").upsert(
    rows.map((r) => ({ review_id: reviewId, guideline, ...r, updated_at: new Date().toISOString() })), { onConflict: "review_id,guideline,item_key" });
  if (error) throw error;
}

/** Creates a document in the writing editor from the composed manuscript and returns its id. */
export async function createEditorDocument(userId: string, title: string, html: string, projectId: string | null): Promise<string> {
  const { data, error } = await db.from("writing_documents").insert({ user_id: userId, title, content: html, research_project_id: projectId, metadata: { source: "guided_review" } }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
