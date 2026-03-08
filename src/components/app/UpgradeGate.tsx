import { useSubscription, FeatureKey } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";

const FEATURE_LABELS: Record<string, { pt: string; en: string }> = {
  search: { pt: "Buscas", en: "Searches" },
  papers: { pt: "Papers", en: "Papers" },
  extraction: { pt: "Extrações IA", en: "AI Extractions" },
  systematic_review: { pt: "Revisões Sistemáticas", en: "Systematic Reviews" },
  datamind_chat: { pt: "DataMind Chat", en: "DataMind Chat" },
  ai_summary: { pt: "Resumos IA", en: "AI Summaries" },
  workspaces: { pt: "Workspaces", en: "Workspaces" },
  illustrations: { pt: "Ilustrações IA", en: "AI Illustrations" },
  alerts: { pt: "Alertas", en: "Alerts" },
  knowledge_graph: { pt: "Mapa de Conhecimento", en: "Knowledge Graph" },
  meta_analysis: { pt: "Meta-análise", en: "Meta-Analysis" },
};

interface UpgradeGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

export function UpgradeGate({ feature, children }: UpgradeGateProps) {
  const { canUse } = useSubscription();

  if (canUse(feature)) {
    return <>{children}</>;
  }

  return <UpgradeOverlay feature={feature}>{children}</UpgradeOverlay>;
}

function UpgradeOverlay({ feature, children }: UpgradeGateProps) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const label = FEATURE_LABELS[feature] || { pt: feature, en: feature };

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
        <div className="text-center space-y-3 p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {pt ? `${label.pt} — Recurso Pro` : `${label.en} — Pro Feature`}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {pt
              ? "Faça upgrade para acessar este recurso e acelerar sua pesquisa."
              : "Upgrade to access this feature and accelerate your research."}
          </p>
          <Link to="/pricing">
            <Button className="gap-2">
              <Sparkles className="h-4 w-4" />
              {pt ? "Ver planos" : "View plans"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface UsageLimitDialogProps {
  feature: FeatureKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UsageLimitDialog({ feature, open, onOpenChange }: UsageLimitDialogProps) {
  const { locale } = useLanguage();
  const { getUsage, getLimit, getUsagePercent } = useSubscription();
  const pt = locale === "pt";
  const label = FEATURE_LABELS[feature] || { pt: feature, en: feature };
  const used = getUsage(feature);
  const limit = getLimit(feature);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-primary" />
            {pt ? "Limite atingido" : "Limit reached"}
          </DialogTitle>
          <DialogDescription>
            {pt
              ? `Você atingiu o limite de ${pt ? label.pt : label.en} do seu plano atual.`
              : `You've reached the ${label.en} limit on your current plan.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{pt ? label.pt : label.en}</span>
              <span className="font-medium text-foreground">
                {used} / {limit}
              </span>
            </div>
            <Progress value={getUsagePercent(feature)} className="h-2" />
          </div>
          <Link to="/pricing" className="block">
            <Button className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              {pt ? "Fazer upgrade" : "Upgrade now"}
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeGate;
