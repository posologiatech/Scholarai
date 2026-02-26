import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import AppHeader from "@/components/app/AppHeader";
import OnboardingDialog from "@/components/app/OnboardingDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Clock, ArrowRight, Sparkles, BookOpen, Table, FileText, Palette, ClipboardList } from "lucide-react";
import QuestionEvaluator, { type Evaluation } from "@/components/app/QuestionEvaluator";

const Dashboard = () => {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [systematicReview, setSystematicReview] = useState(false);

  const recentSearches: string[] = JSON.parse(localStorage.getItem("scholarai_recent") || "[]");

  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 8);
    localStorage.setItem("scholarai_recent", JSON.stringify(updated));
    if (systematicReview) {
      navigate(`/systematic-review?q=${encodeURIComponent(q)}&auto=true`);
    } else {
      const suggestedColumns = evaluation?.suggested_columns || [];
      navigate(`/search?q=${encodeURIComponent(q)}`, { state: { suggestedColumns } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const suggestedQueries = [
    { pt: "Efeitos do jejum intermitente na pressão arterial", en: "Effects of intermittent fasting on blood pressure" },
    { pt: "Machine learning para diagnóstico de câncer", en: "Machine learning for cancer diagnosis" },
    { pt: "Impacto das mudanças climáticas na biodiversidade", en: "Impact of climate change on biodiversity" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <OnboardingDialog />

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-2xl space-y-8">
          {/* Welcome */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              {t("dashboard.badge")}
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              {t("dashboard.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("dashboard.subtitle")}
            </p>
          </div>

          {/* Search bar + evaluation */}
          <div className="space-y-0">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder={t("dashboard.searchPlaceholder")}
                rows={3}
                className="w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              />

              {/* Question evaluation */}
              <QuestionEvaluator question={query} onEvaluation={setEvaluation} onRewrite={setQuery} />

              {/* Systematic review checkbox */}
              <div className="mt-3 flex items-center gap-2">
                <Checkbox
                  id="systematic-review"
                  checked={systematicReview}
                  onCheckedChange={(checked) => setSystematicReview(checked === true)}
                />
                <label htmlFor="systematic-review" className="cursor-pointer text-xs text-muted-foreground">
                  {locale === "pt"
                    ? "Preencher etapas com sugestões baseadas na pergunta de pesquisa (Revisão Sistemática)"
                    : "Fill steps with suggestions based on the research question (Systematic Review)"}
                </label>
              </div>

              {/* Bottom bar */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Source</span>
                  <select className="rounded border border-border bg-background px-2 py-1 text-xs">
                    <option>Research papers</option>
                  </select>
                </div>
                <Button
                  onClick={() => handleSearch()}
                  size="icon"
                  className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Suggested queries */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("dashboard.tryAsking")}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((sq, i) => {
                const label = sq[locale as "pt" | "en"];
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(label);
                    }}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t("dashboard.recentSearches")}
              </div>
              <div className="space-y-1">
                {recentSearches.slice(0, 5).map((search, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(search)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <span className="truncate">{search}</span>
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("dashboard.quickActions")}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: BookOpen, label: t("dashboard.action.library"), href: "/library" },
                { icon: Table, label: t("dashboard.action.extraction"), href: "/extraction" },
                { icon: FileText, label: t("dashboard.action.reports"), href: "/reports" },
                { icon: Palette, label: t("dashboard.action.illustrations"), href: "/illustrations" },
                { icon: ClipboardList, label: locale === "pt" ? "Revisão Sistemática" : "Systematic Review", href: "/systematic-review" },
              ].map((action) => (
                <button
                  key={action.href}
                  onClick={() => navigate(action.href)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  <action.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-foreground">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
