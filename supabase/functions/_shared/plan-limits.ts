import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Server-side check for the check_usage_limit(user_id, feature) RPC
 * (see supabase/migrations/20260728144530_plan_limit_enforcement.sql).
 * Feature keys must match src/hooks/useSubscription.ts's PLAN_LIMITS keys.
 *
 * Fails open (allows the action) on unexpected RPC errors so a transient DB
 * issue doesn't take down the feature entirely — this is a hardening layer
 * on top of the existing frontend gate, not the only line of defense.
 */
export async function checkPlanLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  feature: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_usage_limit", {
    p_user_id: userId,
    p_feature: feature,
  });
  if (error) {
    console.error(`[plan-limits] check_usage_limit(${feature}) error:`, error);
    return true;
  }
  return data === true;
}

export function planLimitExceededResponse(corsHeaders: Record<string, string>, feature: string) {
  return new Response(
    JSON.stringify({
      error: "plan_limit_exceeded",
      feature,
      message: "Você atingiu o limite do seu plano para este recurso. Faça upgrade para continuar.",
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
