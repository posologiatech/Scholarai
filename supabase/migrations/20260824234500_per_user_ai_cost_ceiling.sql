-- Per-user monthly AI cost ceiling: a circuit breaker, not a margin-tightening tool.
-- The feature quotas (search/extraction/datamind_chat/... in get_plan_limit) already
-- bound the "normal power user maxes every counted feature" cost scenario. This ceiling
-- exists for what quotas CAN'T catch: actual token cost varies per call (a huge DataMind
-- context, a pricier model swapped in by mistake, a bug causing repeated calls), so it's
-- set comfortably above the theoretical worst case under quotas -- it should never fire
-- for a legitimate user, only for a real anomaly.
--
-- Attribution depends on edge functions passing `_userId` into callAI() (see
-- supabase/functions/_shared/ai-caller.ts); as of this migration all AI-calling edge
-- functions do except the two with no per-user context (refresh-discover-feed, a cron
-- job, and log-system-update, triggered by CI).

-- 1. ai_usage_log will now be queried on every AI call (to sum the current month's
-- cost), so it needs an index on the columns that query filters/scans by.
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_created
  ON public.ai_usage_log (user_id, created_at);

-- 2. Sum of estimated_cost_usd for a user in the current calendar month.
CREATE OR REPLACE FUNCTION public.get_user_monthly_ai_cost(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(estimated_cost_usd), 0)
  FROM public.ai_usage_log
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now());
$$;

-- 3. Ceiling per plan, in USD. Free is a hard cap on the loss-leader tier (mainly
-- anti-abuse, e.g. scripted account creation); Pro/Team sit well above the worst-case
-- cost of maxing every numbered quota (see the pricing conversation this came from --
-- roughly $8-9 for Pro, $10-12 for Team at current Gemini Flash-tier pricing), so normal
-- usage -- even heavy, legitimate usage -- never approaches these numbers.
CREATE OR REPLACE FUNCTION public.get_plan_cost_ceiling(p_plan text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 25
    WHEN 'team' THEN 45
    ELSE 45 -- unrecognized/legacy plan: treat like the highest real tier, not unlimited
  END
$$;

CREATE OR REPLACE FUNCTION public.check_cost_ceiling(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_ceiling numeric;
  v_spent numeric;
BEGIN
  v_plan := public.get_user_plan(p_user_id);
  v_ceiling := public.get_plan_cost_ceiling(v_plan);
  v_spent := public.get_user_monthly_ai_cost(p_user_id);
  RETURN v_spent < v_ceiling;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_monthly_ai_cost(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_plan_cost_ceiling(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_cost_ceiling(uuid) TO authenticated, service_role;

-- 4. admin_notifications was built only for the support-ticket system (ticket_id is
-- NOT NULL, type is constrained to ticket events). Reuse it for cost-ceiling alerts
-- instead of a new table: relax both constraints so a notification can exist without
-- a ticket.
ALTER TABLE public.admin_notifications ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_type_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN ('new_ticket', 'ticket_reply', 'cost_ceiling_breach'));
