import type { ReviewState } from "./types";
import type { ReviewRecord } from "./protocol";

/** Flattens a stored review into what the stage gates evaluate. */
export function buildReviewState(r: ReviewRecord, metrics: Record<string, number> = {}): ReviewState {
  const fields: Record<string, unknown> = {
    title: r.title,
    area: r.area,
    question: r.question,
    eligibility: r.eligibility,
    protocol_locked_at: r.protocol_locked_at,
    // Rapid reviews must declare the shortcuts they take before locking the protocol.
    shortcuts: (r.stage_state?.rapid as { shortcuts?: string[] } | undefined)?.shortcuts ?? [],
  };
  for (const [k, v] of Object.entries(r.framework ?? {})) fields[`framework.${k}`] = v;
  const flags = (r.stage_state?.flags as Record<string, boolean> | undefined) ?? {};
  return { fields, metrics, flags };
}
