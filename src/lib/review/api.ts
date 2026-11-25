import { supabase } from "@/integrations/supabase/client";
import type { ReviewRecord } from "./protocol";
import type { ReviewTypeDef } from "./types";

// The generated Database types predate the review tables, so these calls go through an untyped
// handle. Regenerate src/integrations/supabase/types.ts after the migration is applied and drop this.
const db = supabase as unknown as { from: (t: string) => any };

export async function listReviews(): Promise<ReviewRecord[]> {
  const { data, error } = await db.from("reviews").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as ReviewRecord[];
}

export async function getReview(id: string): Promise<ReviewRecord> {
  const { data, error } = await db.from("reviews").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ReviewRecord;
}

export async function createReview(args: {
  ownerId: string; def: ReviewTypeDef; locale: "pt" | "en"; title: string; area: string; researchProjectId?: string | null;
}): Promise<ReviewRecord> {
  const { data, error } = await db.from("reviews").insert({
    owner_id: args.ownerId,
    review_type: args.def.id,
    definition_version: args.def.version,
    locale: args.locale,
    title: args.title,
    area: args.area,
    research_project_id: args.researchProjectId ?? null,
  }).select("*").single();
  if (error) throw error;
  await logEvent(data.id, args.ownerId, "review_created", { type: args.def.id, definition_version: args.def.version });
  return data as ReviewRecord;
}

export async function updateReview(id: string, patch: Partial<ReviewRecord>): Promise<void> {
  const { error } = await db.from("reviews").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await db.from("reviews").delete().eq("id", id);
  if (error) throw error;
}

export async function logEvent(reviewId: string, userId: string | null, event: string, payload: Record<string, unknown> = {}): Promise<void> {
  // Audit trail must never block the user's action.
  await db.from("review_events").insert({ review_id: reviewId, user_id: userId, event, payload });
}
