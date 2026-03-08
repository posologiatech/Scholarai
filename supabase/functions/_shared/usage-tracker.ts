import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Increment usage counter for a feature in the current billing period.
 * Uses service_role to bypass RLS.
 */
export async function trackUsage(userId: string, feature: string, increment = 1) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const period = new Date().toISOString().slice(0, 7); // '2026-03'

  // Try to update existing record
  const { data: existing } = await supabase
    .from("usage_tracking")
    .select("id, count")
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("usage_tracking")
      .update({ count: existing.count + increment })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("usage_tracking")
      .insert({ user_id: userId, feature, period, count: increment });
  }
}
