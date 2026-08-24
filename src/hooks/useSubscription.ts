import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanType = "free" | "pro" | "team";

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
  knowledge_graph: number;
  meta_analysis: number;
}

// -1 = unlimited, 0 = not available on this plan, N = monthly quota.
// ai_summary/knowledge_graph/meta_analysis on Pro/Team are capped (not -1) even though
// they're marketed as "ilimitado" — LLM cost per call is real and these three had no
// ceiling at all before, the only genuinely open-ended cost exposure per seat. The caps
// are set well above realistic per-user usage so no normal customer ever notices them.
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
    knowledge_graph: 0,
    meta_analysis: 0,
  },
  pro: {
    search: -1,
    papers: 500,
    extraction: 100,
    systematic_review: 5,
    datamind_chat: 200,
    ai_summary: 300,
    workspaces: 5,
    illustrations: 10,
    alerts: 3,
    knowledge_graph: 20,
    meta_analysis: 10,
  },
  team: {
    search: -1,
    papers: -1,
    extraction: 300,
    systematic_review: -1,
    datamind_chat: 500,
    ai_summary: 1000,
    workspaces: -1,
    illustrations: 30,
    alerts: 10,
    knowledge_graph: 100,
    meta_analysis: 50,
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      // Check if user is admin (admins bypass all limits)
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      if (adminRole) {
        setIsAdmin(true);
        setPlan("team"); // admins bypass all limits via isAdmin; "team" is just the display tier
        setLoading(false);
        return;
      }

      const currentPeriod = new Date().toISOString().slice(0, 7);

      // Check subscription status from Stripe via edge function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const { data: subData } = await supabase.functions.invoke("check-subscription", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (subData?.plan) {
            setPlan(subData.plan as PlanType);
            setSubscriptionEnd(subData.subscription_end || null);
          }
        }
      } catch {
        // Fallback: read from subscriptions table
        const { data: subRes } = await supabase
          .from("subscriptions")
          .select("plan, status, current_period_end, stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (subRes && subRes.status === "active") {
          setPlan(subRes.plan as PlanType);
          setSubscriptionEnd(subRes.current_period_end || null);
          setStripeCustomerId(subRes.stripe_customer_id || null);
        }
      }

      // Fetch usage
      const { data: usageRes } = await supabase
        .from("usage_tracking")
        .select("feature, count")
        .eq("user_id", user.id)
        .eq("period", currentPeriod);
      if (usageRes) setUsage(usageRes);

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.team; // legacy "enterprise" rows fall back to the highest real tier

  const getUsage = (feature: FeatureKey): number => {
    const record = usage.find((u) => u.feature === feature);
    return record?.count ?? 0;
  };

  const getLimit = (feature: FeatureKey): number => limits[feature];

  const canUse = (feature: FeatureKey): boolean => {
    if (isAdmin) return true; // Admins bypass all limits
    const limit = getLimit(feature);
    if (limit === -1) return true; // unlimited
    if (limit === 0) return false; // not available
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
    isFreePlan: plan === "free" && !isAdmin,
    isPro: plan === "pro" || plan === "team" || isAdmin,
    isAdmin,
    subscriptionEnd,
  };
}
