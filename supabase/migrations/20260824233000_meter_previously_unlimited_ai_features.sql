-- ai_summary/knowledge_graph/meta_analysis were the only Pro/Team features with no
-- numeric ceiling at all (ai_summary was -1, knowledge_graph/meta_analysis were plain
-- boolean access gates). Each call still costs real LLM tokens, so this was the one
-- genuinely unbounded per-seat cost exposure. Cap all three at generous monthly quotas
-- (mirrored in src/hooks/useSubscription.ts PLAN_LIMITS) — comfortably above realistic
-- usage, just closing the open-ended case.

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
      WHEN 'ai_summary' THEN 300
      WHEN 'workspaces' THEN 5
      WHEN 'illustrations' THEN 10
      WHEN 'alerts' THEN 3
      WHEN 'knowledge_graph' THEN 20
      WHEN 'meta_analysis' THEN 10
      ELSE -1
    END
    WHEN 'team' THEN CASE p_feature
      WHEN 'search' THEN -1
      WHEN 'papers' THEN -1
      WHEN 'extraction' THEN 300
      WHEN 'systematic_review' THEN -1
      WHEN 'datamind_chat' THEN 500
      WHEN 'ai_summary' THEN 1000
      WHEN 'workspaces' THEN -1
      WHEN 'illustrations' THEN 30
      WHEN 'alerts' THEN 10
      WHEN 'knowledge_graph' THEN 100
      WHEN 'meta_analysis' THEN 50
      ELSE -1
    END
    ELSE -1 -- any unrecognized/legacy plan value defaults to unlimited
  END
$$;
