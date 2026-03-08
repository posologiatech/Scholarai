import { useSubscription, FeatureKey } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_BADGES: Record<string, { label: string; className: string }> = {
  free: { label: "Free", className: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", className: "bg-primary/10 text-primary border-primary/20" },
  team: { label: "Team", className: "bg-accent/10 text-accent border-accent/20" },
  enterprise: { label: "Enterprise", className: "bg-success/10 text-success border-success/20" },
};

export function PlanBadge() {
  const { plan } = useSubscription();
  const badge = PLAN_BADGES[plan] || PLAN_BADGES.free;

  return (
    <Link to="/pricing">
      <Badge variant="outline" className={cn("cursor-pointer gap-1 text-xs", badge.className)}>
        <Sparkles className="h-3 w-3" />
        {badge.label}
      </Badge>
    </Link>
  );
}

interface UsageMeterProps {
  feature: FeatureKey;
  label: string;
  compact?: boolean;
}

export function UsageMeter({ feature, label, compact }: UsageMeterProps) {
  const { getUsage, getLimit, getUsagePercent } = useSubscription();
  const limit = getLimit(feature);

  if (limit === -1) return null; // unlimited

  const used = getUsage(feature);
  const percent = getUsagePercent(feature);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={cn("font-medium", percent >= 90 ? "text-destructive" : "text-foreground")}>
          {used}/{limit}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", percent >= 90 ? "text-destructive" : "text-foreground")}>
          {used}/{limit}
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  );
}
