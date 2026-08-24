import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, X, Sparkles, Zap, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STRIPE_PRICES = {
  pro: {
    monthly: "price_1T8fRhQaWA3IKZab7UddPJ11",
    annual: "price_1T8fSlQaWA3IKZabZGD2e5Cw",
  },
  team: {
    monthly: "price_1T8fTqQaWA3IKZabFdbQErgo",
    annual: "price_1T8fUsQaWA3IKZabiOPRZIwT",
  },
};

const Pricing = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const { plan: currentPlan } = useSubscription();
  const pt = locale === "pt";
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const checkoutCancelled = searchParams.get("checkout") === "cancelled";

  const handleCheckout = async (planId: string) => {
    if (!user) {
      toast.error(pt ? "Faça login primeiro" : "Please log in first");
      return;
    }
    if (planId === "free") return;

    const priceId = annual
      ? STRIPE_PRICES[planId as keyof typeof STRIPE_PRICES].annual
      : STRIPE_PRICES[planId as keyof typeof STRIPE_PRICES].monthly;

    setLoadingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || (pt ? "Erro ao iniciar checkout" : "Checkout error"));
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPlan("manage");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast.error(pt ? "Erro ao abrir portal" : "Portal error");
    } finally {
      setLoadingPlan(null);
    }
  };

  const isCurrentPlan = (planId: string) => currentPlan === planId;

  const getCtaText = (planId: string) => {
    if (isCurrentPlan(planId)) return pt ? "Plano atual" : "Current plan";
    if (planId === "free") return user ? (pt ? "Plano atual" : "Current plan") : (pt ? "Comece grátis" : "Start free");
    return pt ? `Assinar ${planId.charAt(0).toUpperCase() + planId.slice(1)}` : `Subscribe ${planId.charAt(0).toUpperCase() + planId.slice(1)}`;
  };

  const plans = [
    {
      id: "free",
      name: "Free",
      icon: Zap,
      price: { monthly: 0, annual: 0 },
      description: pt ? "Para explorar a plataforma" : "To explore the platform",
      highlight: false,
      features: [
        { label: pt ? "20 buscas/mês" : "20 searches/mo", included: true },
        { label: pt ? "50 papers na biblioteca" : "50 papers in library", included: true },
        { label: pt ? "5 extrações IA/mês" : "5 AI extractions/mo", included: true },
        { label: pt ? "1 revisão sistemática" : "1 systematic review", included: true },
        { label: pt ? "10 msgs DataMind/mês" : "10 DataMind msgs/mo", included: true },
        { label: pt ? "3 resumos IA/mês" : "3 AI summaries/mo", included: true },
        { label: pt ? "1 workspace" : "1 workspace", included: true },
        { label: pt ? "Mapa de Conhecimento" : "Knowledge Graph", included: false },
        { label: pt ? "Meta-análise" : "Meta-Analysis", included: false },
        { label: pt ? "Ilustrações IA" : "AI Illustrations", included: false },
        { label: pt ? "Alertas de literatura" : "Literature alerts", included: false },
      ],
    },
    {
      id: "pro",
      name: "Pro",
      icon: Sparkles,
      price: { monthly: 49, annual: 39 },
      description: pt ? "Para pesquisadores individuais" : "For individual researchers",
      highlight: true,
      features: [
        { label: pt ? "Buscas ilimitadas" : "Unlimited searches", included: true },
        { label: pt ? "500 papers na biblioteca" : "500 papers in library", included: true },
        { label: pt ? "100 extrações IA/mês" : "100 AI extractions/mo", included: true },
        { label: pt ? "5 revisões sistemáticas" : "5 systematic reviews", included: true },
        { label: pt ? "200 msgs DataMind/mês" : "200 DataMind msgs/mo", included: true },
        { label: pt ? "300 resumos IA/mês" : "300 AI summaries/mo", included: true },
        { label: pt ? "5 workspaces" : "5 workspaces", included: true },
        { label: pt ? "Mapa de Conhecimento" : "Knowledge Graph", included: true },
        { label: pt ? "Meta-análise" : "Meta-Analysis", included: true },
        { label: pt ? "10 ilustrações IA/mês" : "10 AI illustrations/mo", included: true },
        { label: pt ? "3 alertas de literatura" : "3 literature alerts", included: true },
      ],
    },
    {
      id: "team",
      name: "Team",
      icon: Users,
      price: { monthly: 89, annual: 71 },
      description: pt ? "Para grupos de pesquisa" : "For research groups",
      highlight: false,
      perUser: true,
      features: [
        { label: pt ? "Buscas ilimitadas" : "Unlimited searches", included: true },
        { label: pt ? "Papers ilimitados" : "Unlimited papers", included: true },
        { label: pt ? "300 extrações IA/mês" : "300 AI extractions/mo", included: true },
        { label: pt ? "Revisões ilimitadas" : "Unlimited reviews", included: true },
        { label: pt ? "500 msgs DataMind/mês" : "500 DataMind msgs/mo", included: true },
        { label: pt ? "1000 resumos IA/mês" : "1,000 AI summaries/mo", included: true },
        { label: pt ? "Workspaces ilimitados" : "Unlimited workspaces", included: true },
        { label: pt ? "Mapa de Conhecimento" : "Knowledge Graph", included: true },
        { label: pt ? "Meta-análise" : "Meta-Analysis", included: true },
        { label: pt ? "30 ilustrações IA/mês" : "30 AI illustrations/mo", included: true },
        { label: pt ? "10 alertas de literatura" : "10 literature alerts", included: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-16 md:py-24">
        {checkoutCancelled && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-center text-sm">
            {pt ? "Checkout cancelado. Você pode tentar novamente." : "Checkout cancelled. You can try again."}
          </div>
        )}

        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 gap-1.5 text-sm px-3 py-1 border-primary/20 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {pt ? "Preços" : "Pricing"}
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {pt ? "Planos para cada nível de pesquisa" : "Plans for every research level"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {pt
              ? "Comece gratuitamente. Faça upgrade quando sua pesquisa exigir mais."
              : "Start free. Upgrade when your research demands more."}
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={cn("text-sm", !annual ? "text-foreground font-medium" : "text-muted-foreground")}>
              {pt ? "Mensal" : "Monthly"}
            </span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={cn("text-sm", annual ? "text-foreground font-medium" : "text-muted-foreground")}>
              {pt ? "Anual" : "Annual"}
            </span>
            {annual && (
              <Badge className="bg-success/10 text-success border-success/20 text-xs">-20%</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col transition-shadow",
                plan.highlight
                  ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                  : "border-border",
                isCurrentPlan(plan.id) && "ring-2 ring-primary/40"
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-xs px-3">
                    {pt ? "Mais popular" : "Most popular"}
                  </Badge>
                </div>
              )}
              {isCurrentPlan(plan.id) && !plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="text-xs px-3 bg-background">
                    {pt ? "Seu plano" : "Your plan"}
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    plan.highlight ? "bg-primary/10" : "bg-muted"
                  )}>
                    <plan.icon className={cn("h-5 w-5", plan.highlight ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <CardTitle className="font-display text-xl">{plan.name}</CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="mb-6">
                  {plan.price.monthly === 0 ? (
                    <div>
                      <span className="font-display text-4xl font-bold text-foreground">R$0</span>
                      <span className="text-muted-foreground text-sm ml-1">/{pt ? "mês" : "mo"}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-display text-4xl font-bold text-foreground">
                        R${annual ? plan.price.annual : plan.price.monthly}
                      </span>
                      <span className="text-muted-foreground text-sm ml-1">
                        /{pt ? "mês" : "mo"}
                        {plan.perUser && (pt ? " por usuário" : " per user")}
                      </span>
                      {annual && plan.price.monthly > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 line-through">
                          R${plan.price.monthly}/{pt ? "mês" : "mo"}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {feat.included ? (
                        <Check className="h-4 w-4 mt-0.5 text-success shrink-0" />
                      ) : (
                        <X className="h-4 w-4 mt-0.5 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={feat.included ? "text-foreground" : "text-muted-foreground/60"}>
                        {feat.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="flex-col gap-2">
                {plan.id === "free" ? (
                  <Link to={user ? "/dashboard" : "/signup"} className="w-full">
                    <Button variant="outline" className="w-full" disabled={!!user}>
                      {getCtaText(plan.id)}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className={cn(
                      "w-full",
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
                        : ""
                    )}
                    variant={plan.highlight ? "default" : "outline"}
                    disabled={isCurrentPlan(plan.id) || loadingPlan === plan.id}
                    onClick={() => handleCheckout(plan.id)}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {getCtaText(plan.id)}
                  </Button>
                )}

                {isCurrentPlan(plan.id) && plan.id !== "free" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    disabled={loadingPlan === "manage"}
                    onClick={handleManageSubscription}
                  >
                    {loadingPlan === "manage" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    {pt ? "Gerenciar assinatura" : "Manage subscription"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-20 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground mb-3">
            {pt ? "Dúvidas sobre os planos?" : "Questions about plans?"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {pt ? "Consulte nosso FAQ ou entre em contato conosco." : "Check our FAQ or get in touch with us."}
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/faq"><Button variant="outline">{pt ? "Ver FAQ" : "View FAQ"}</Button></Link>
            <Link to="/contact"><Button variant="outline">{pt ? "Fale conosco" : "Contact us"}</Button></Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
