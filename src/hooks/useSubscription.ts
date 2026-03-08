import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanType = "free" | "pro" | "team" | "enterprise";

export interface PlanLimits {
  search: number;
  papers: number;
  extraction: number;
  systematic_review: number;
  datamind_chat: number;
  ai_summary: number;
  workspaces: number;
  illustrations: number;
  alerts: number;
  knowledge_graph: boolean;
  meta_analysis: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    search: 20,
    papers: 50,
    extraction: 5,
    systematic_review: 1,
    datamind_chat: 10,
    ai_summary: 3,
    workspaces: 1,
    illustrations: 0,
    alerts: 0,
    knowledge_graph: false,
    meta_analysis: false,
  },
  pro: {
    search: -1,
    papers: 500,
    extraction: 100,
    systematic_review: 5,
    datamind_chat: 200,
    ai_summary: -1,
    workspaces: 5,
    illustrations: 10,
    alerts: 3,
    knowledge_graph: true,
    meta_analysis: true,
  },
  team: {
    search: -1,
    papers: -1,
    extraction: 300,
    systematic_review: -1,
    datamind_chat: 500,
    ai_summary: -1,
    workspaces: -1,
    illustrations: 30,
    alerts: 10,
    knowledge_graph: true,
    meta_analysis: true,
  },
  enterprise: {
    search: -1,
    papers: -1,
    extraction: -1,
    systematic_review: -1,
    datamind_chat: -1,
    ai_summary: -1,
    workspaces: -1,
    illustrations: -1,
    alerts: -1,
    knowledge_graph: true,
    meta_analysis: true,
  },
};

export type FeatureKey = keyof PlanLimits;

interface UsageRecord {
  feature: string;
  count: number;
}

export function useSubscription() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanType>("free");
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7); // '2026-03'

      const [subRes, usageRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("plan, status, current_period_end")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("usage_tracking")
          .select("feature, count")
          .eq("user_id", user.id)
          .eq("period", currentPeriod),
      ]);

      if (subRes.data && subRes.data.status === "active") {
        setPlan(subRes.data.plan as PlanType);
      }
      if (usageRes.data) {
        setUsage(usageRes.data);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const limits = PLAN_LIMITS[plan];

  const getUsage = (feature: FeatureKey): number => {
    const record = usage.find((u) => u.feature === feature);
    return record?.count ?? 0;
  };

  const getLimit = (feature: FeatureKey): number => {
    const val = limits[feature];
    return typeof val === "boolean" ? (val ? -1 : 0) : val;
  };

  const canUse = (feature: FeatureKey): boolean => {
    const limit = getLimit(feature);
    if (limit === -1) return true; // unlimited
    if (limit === 0) return false; // not available
    if (typeof limits[feature] === "boolean") return limits[feature] as boolean;
    return getUsage(feature) < limit;
  };

  const getUsagePercent = (feature: FeatureKey): number => {
    const limit = getLimit(feature);
    if (limit <= 0) return limit === -1 ? 0 : 100;
    return Math.min(100, Math.round((getUsage(feature) / limit) * 100));
  };

  return {
    plan,
    limits,
    loading,
    canUse,
    getUsage,
    getLimit,
    getUsagePercent,
    isFreePlan: plan === "free",
    isPro: plan === "pro" || plan === "team" || plan === "enterprise",
  };
}
