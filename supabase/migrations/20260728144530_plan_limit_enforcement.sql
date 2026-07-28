-- Backend enforcement of subscription plan limits.
-- Previously, plan limits (search count, papers in library, extractions, etc.)
-- were only checked client-side (useSubscription.ts canUse()), which a user
-- could bypass by calling edge functions directly. This migration adds
-- server-side enforcement so limits hold regardless of client behavior.

-- 1. Close the usage_tracking write hole: only service_role (edge functions)
-- may write usage counters. Previously any authenticated user could
-- INSERT/UPDATE their own row and reset/forge their usage count.
DROP POLICY IF EXISTS "Users can upsert own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_tracking;

-- 2. Resolve a user's effective plan (mirrors the logic in useSubscription.ts:
-- admins bypass all limits and are treated as the top tier; otherwise the
-- active subscription's plan; otherwise free). There is no "enterprise" plan.
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
BEGIN
  IF public.has_role(p_user_id, 'admin') THEN
    RETURN 'team';
  END IF;

  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'active';

  RETURN COALESCE(v_plan, 'free');
END;
$$;

-- 3. Plan limit table, mirrored 1:1 from PLAN_LIMITS in src/hooks/useSubscription.ts.
-- -1 = unlimited / feature enabled, 0 = not available on this plan.
CREATE OR REPLACE FUNCTION public.get_plan_limit(p_plan text, p_feature text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'free' THEN CASE p_feature
      WHEN 'search' THEN 20
      WHEN 'papers' THEN 50
      WHEN 'extraction' THEN 5
      WHEN 'systematic_review' THEN 1
      WHEN 'datamind_chat' THEN 10
      WHEN 'ai_summary' THEN 3
      WHEN 'workspaces' THEN 1
      WHEN 'illustrations' THEN 0
      WHEN 'alerts' THEN 0
      WHEN 'knowledge_graph' THEN 0
      WHEN 'meta_analysis' THEN 0
      ELSE -1
    END
    WHEN 'pro' THEN CASE p_feature
      WHEN 'search' THEN -1
      WHEN 'papers' THEN 500
      WHEN 'extraction' THEN 100
      WHEN 'systematic_review' THEN 5
      WHEN 'datamind_chat' THEN 200
      WHEN 'ai_summary' THEN -1
      WHEN 'workspaces' THEN 5
      WHEN 'illustrations' THEN 10
      WHEN 'alerts' THEN 3
      WHEN 'knowledge_graph' THEN -1
      WHEN 'meta_analysis' THEN -1
      ELSE -1
    END
    WHEN 'team' THEN CASE p_feature
      WHEN 'search' THEN -1
      WHEN 'papers' THEN -1
      WHEN 'extraction' THEN 300
      WHEN 'systematic_review' THEN -1
      WHEN 'datamind_chat' THEN 500
      WHEN 'ai_summary' THEN -1
      WHEN 'workspaces' THEN -1
      WHEN 'illustrations' THEN 30
      WHEN 'alerts' THEN 10
      WHEN 'knowledge_graph' THEN -1
      WHEN 'meta_analysis' THEN -1
      ELSE -1
    END
    ELSE -1 -- any unrecognized/legacy plan value defaults to unlimited
  END
$$;

-- 4. Generic check for usage_tracking-backed features (monthly counters) and
-- boolean-gated features (knowledge_graph, meta_analysis: limit is -1 or 0,
-- so the count lookup is never reached). Edge functions call this via RPC
-- before performing the paid action.
CREATE OR REPLACE FUNCTION public.check_usage_limit(p_user_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_period text;
  v_count integer;
BEGIN
  v_plan := public.get_user_plan(p_user_id);
  v_limit := public.get_plan_limit(v_plan, p_feature);

  IF v_limit = -1 THEN RETURN true; END IF;
  IF v_limit = 0 THEN RETURN false; END IF;

  v_period := to_char(now(), 'YYYY-MM');
  SELECT count INTO v_count
  FROM public.usage_tracking
  WHERE user_id = p_user_id AND feature = p_feature AND period = v_period;

  RETURN COALESCE(v_count, 0) < v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_limit(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_usage_limit(uuid, text) TO authenticated;

-- 5. Row-count based resources (created directly by the client, not through
-- an edge function) get a BEFORE INSERT trigger so the limit holds even if
-- the client bypasses the frontend gate.

CREATE OR REPLACE FUNCTION public.enforce_workspace_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_count integer;
BEGIN
  v_plan := public.get_user_plan(NEW.owner_id);
  v_limit := public.get_plan_limit(v_plan, 'workspaces');
  IF v_limit <> -1 THEN
    SELECT count(*) INTO v_count FROM public.workspaces WHERE owner_id = NEW.owner_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'plan_limit_exceeded: workspace limit (%) reached for plan %', v_limit, v_plan
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_workspace_limit ON public.workspaces;
CREATE TRIGGER trg_enforce_workspace_limit
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_limit();

CREATE OR REPLACE FUNCTION public.enforce_systematic_review_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_count integer;
BEGIN
  v_plan := public.get_user_plan(NEW.user_id);
  v_limit := public.get_plan_limit(v_plan, 'systematic_review');
  IF v_limit <> -1 THEN
    SELECT count(*) INTO v_count FROM public.systematic_reviews WHERE user_id = NEW.user_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'plan_limit_exceeded: systematic_review limit (%) reached for plan %', v_limit, v_plan
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_systematic_review_limit ON public.systematic_reviews;
CREATE TRIGGER trg_enforce_systematic_review_limit
  BEFORE INSERT ON public.systematic_reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_systematic_review_limit();

CREATE OR REPLACE FUNCTION public.enforce_alerts_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_count integer;
BEGIN
  v_plan := public.get_user_plan(NEW.user_id);
  v_limit := public.get_plan_limit(v_plan, 'alerts');
  IF v_limit <> -1 THEN
    SELECT count(*) INTO v_count FROM public.literature_alerts WHERE user_id = NEW.user_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'plan_limit_exceeded: alerts limit (%) reached for plan %', v_limit, v_plan
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_alerts_limit ON public.literature_alerts;
CREATE TRIGGER trg_enforce_alerts_limit
  BEFORE INSERT ON public.literature_alerts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_alerts_limit();

-- "Papers na biblioteca" = total papers saved across all of a user's
-- saved_searches rows (Library.tsx sums papers across all searches).
CREATE OR REPLACE FUNCTION public.enforce_library_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_existing integer;
  v_new_count integer;
BEGIN
  v_plan := public.get_user_plan(NEW.user_id);
  v_limit := public.get_plan_limit(v_plan, 'papers');
  IF v_limit <> -1 THEN
    SELECT COALESCE(sum(jsonb_array_length(papers)), 0) INTO v_existing
    FROM public.saved_searches WHERE user_id = NEW.user_id;
    v_new_count := COALESCE(jsonb_array_length(NEW.papers), 0);
    IF v_existing + v_new_count > v_limit THEN
      RAISE EXCEPTION 'plan_limit_exceeded: library papers limit (%) reached for plan %', v_limit, v_plan
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_library_limit ON public.saved_searches;
CREATE TRIGGER trg_enforce_library_limit
  BEFORE INSERT ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_library_limit();
