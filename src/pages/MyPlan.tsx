import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription, FeatureKey } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CreditCard, Sparkles, Crown, Loader2, ExternalLink, Calendar,
  Search, FileText, BrainCircuit, Palette, Bell, Network, BarChart3, Users, BookOpen, MessageSquare, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { OrcidConnectCard } from "@/components/research/OrcidConnectCard";

const PLAN_NAMES: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", color: "bg-primary/10 text-primary border-primary/20" },
  team: { label: "Team", color: "bg-accent/10 text-accent-foreground border-accent/20" },
  enterprise: { label: "Enterprise", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
};

interface FeatureDisplay {
  key: FeatureKey;
  label: { pt: string; en: string };
  icon: React.ElementType;
  isBoolean?: boolean;
}

const FEATURES: FeatureDisplay[] = [
  { key: "search", label: { pt: "Buscas semânticas", en: "Semantic searches" }, icon: Search },
  { key: "papers", label: { pt: "Papers na biblioteca", en: "Papers in library" }, icon: BookOpen },
  { key: "extraction", label: { pt: "Extrações IA", en: "AI extractions" }, icon: FileText },
  { key: "systematic_review", label: { pt: "Revisões sistemáticas", en: "Systematic reviews" }, icon: ClipboardList },
  { key: "datamind_chat", label: { pt: "Mensagens DataMind", en: "DataMind messages" }, icon: BrainCircuit },
  { key: "ai_summary", label: { pt: "Resumos IA", en: "AI summaries" }, icon: MessageSquare },
  { key: "workspaces", label: { pt: "Workspaces", en: "Workspaces" }, icon: Users },
  { key: "illustrations", label: { pt: "Ilustrações IA", en: "AI illustrations" }, icon: Palette },
  { key: "alerts", label: { pt: "Alertas de literatura", en: "Literature alerts" }, icon: Bell },
  { key: "knowledge_graph", label: { pt: "Mapa de Conhecimento", en: "Knowledge Graph" }, icon: Network, isBoolean: true },
  { key: "meta_analysis", label: { pt: "Meta-análise", en: "Meta-Analysis" }, icon: BarChart3, isBoolean: true },
];

const MyPlan = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const { plan, getUsage, getLimit, getUsagePercent, canUse, subscriptionEnd, isAdmin } = useSubscription();
  const pt = locale === "pt";
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);

  const planInfo = PLAN_NAMES[plan] || PLAN_NAMES.free;

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast.error(pt ? "Erro ao abrir portal de gerenciamento" : "Error opening management portal");
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleUpgrade = async (priceId: string, planId: string) => {
    if (!user) return;
    setLoadingCheckout(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || (pt ? "Erro ao iniciar checkout" : "Checkout error"));
    } finally {
      setLoadingCheckout(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container max-w-4xl flex-1 py-8 px-4">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {pt ? "Meu Plano" : "My Plan"}
            </h1>
            <p className="text-muted-foreground">
              {pt ? "Gerencie sua assinatura e acompanhe seu uso" : "Manage your subscription and track your usage"}
            </p>
          </div>
        </div>

        {/* Current Plan Card */}
        <Card className="mb-6 border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2 font-display text-xl">
                    {pt ? "Plano atual" : "Current plan"}
                    <Badge variant="outline" className={cn("text-sm", planInfo.color)}>
                      <Sparkles className="mr-1 h-3 w-3" />
                      {planInfo.label}
                    </Badge>
                    {isAdmin && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                        Admin
                      </Badge>
                    )}
                  </CardTitle>
                  {subscriptionEnd && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {pt ? "Próxima renovação:" : "Next renewal:"}{" "}
                      {new Date(subscriptionEnd).toLocaleDateString(pt ? "pt-BR" : "en-US")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {plan !== "free" && (
                  <Button
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={loadingPortal}
                    className="gap-2"
                  >
                    {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {pt ? "Gerenciar assinatura" : "Manage subscription"}
                  </Button>
                )}
                {plan === "free" && !isAdmin && (
                  <Link to="/pricing">
                    <Button className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      {pt ? "Fazer upgrade" : "Upgrade now"}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Usage Grid */}
        <div className="mb-6">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">
            {pt ? "Uso mensal" : "Monthly usage"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feat) => {
              const limit = getLimit(feat.key);
              const used = getUsage(feat.key);
              const percent = getUsagePercent(feat.key);
              const available = canUse(feat.key);
              const unlimited = limit === -1;
              const blocked = limit === 0;
              const Icon = feat.icon;

              return (
                <div
                  key={feat.key}
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    blocked
                      ? "border-border/50 bg-muted/30 opacity-60"
                      : percent >= 90 && !unlimited
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {pt ? feat.label.pt : feat.label.en}
                    </span>
                  </div>
                  {feat.isBoolean ? (
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        available ? "bg-green-500" : "bg-muted-foreground"
                      )} />
                      <span className="text-xs text-muted-foreground">
                        {available
                          ? (pt ? "Disponível" : "Available")
                          : (pt ? "Bloqueado" : "Blocked")}
                      </span>
                    </div>
                  ) : blocked ? (
                    <span className="text-xs text-muted-foreground">
                      {pt ? "Não disponível no plano atual" : "Not available on current plan"}
                    </span>
                  ) : unlimited ? (
                    <span className="text-xs text-muted-foreground">
                      {used > 0 ? `${used} ${pt ? "usados" : "used"} • ` : ""}
                      {pt ? "Ilimitado" : "Unlimited"}
                    </span>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={cn(
                          "font-medium",
                          percent >= 90 ? "text-destructive" : "text-foreground"
                        )}>
                          {used} / {limit}
                        </span>
                        <span className="text-muted-foreground">{percent}%</span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick upgrade for free users */}
        {plan === "free" && !isAdmin && (
          <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {pt ? "Desbloqueie todo o potencial" : "Unlock full potential"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {pt
                    ? "Faça upgrade para ter buscas ilimitadas, mais extrações, e acesso a funcionalidades premium."
                    : "Upgrade for unlimited searches, more extractions, and access to premium features."}
                </p>
              </div>
              <Link to="/pricing">
                <Button size="lg" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {pt ? "Ver planos" : "View plans"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="mt-8">
          <OrcidConnectCard />
        </div>
      </main>

    </div>
  );
};

export default MyPlan;