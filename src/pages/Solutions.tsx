import { Link } from "react-router-dom";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Search, ClipboardCheck, Bell, FileText, Check, ArrowRight } from "lucide-react";

const Solutions = () => {
  const { t } = useLanguage();

  const solutions = [
    {
      icon: Search,
      title: t("solutions.search.title"),
      desc: t("solutions.search.desc"),
      features: t("solutions.search.features").split("|"),
      available: true,
      gradient: "from-primary/10 to-primary/5",
      iconColor: "text-primary",
    },
    {
      icon: ClipboardCheck,
      title: t("solutions.review.title"),
      desc: t("solutions.review.desc"),
      features: t("solutions.review.features").split("|"),
      available: false,
      gradient: "from-accent/10 to-accent/5",
      iconColor: "text-accent",
    },
    {
      icon: Bell,
      title: t("solutions.alerts.title"),
      desc: t("solutions.alerts.desc"),
      features: t("solutions.alerts.features").split("|"),
      available: false,
      gradient: "from-success/10 to-success/5",
      iconColor: "text-success",
    },
    {
      icon: FileText,
      title: t("solutions.reports.title"),
      desc: t("solutions.reports.desc"),
      features: t("solutions.reports.features").split("|"),
      available: false,
      gradient: "from-primary/10 to-accent/5",
      iconColor: "text-primary",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl">{t("solutions.title")}</h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">{t("solutions.subtitle")}</p>
          </div>

          <div className="space-y-12">
            {solutions.map((sol, i) => (
              <div
                key={sol.title}
                className={`flex flex-col gap-8 rounded-2xl border border-border bg-card p-8 md:flex-row md:p-10 ${i % 2 !== 0 ? "md:flex-row-reverse" : ""}`}
              >
                <div className="flex-1">
                  <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${sol.gradient} p-3`}>
                    <sol.icon className={`h-6 w-6 ${sol.iconColor}`} />
                  </div>
                  <h2 className="mb-3 font-display text-2xl font-bold text-foreground">{sol.title}</h2>
                  <p className="mb-6 leading-relaxed text-muted-foreground">{sol.desc}</p>
                  <ul className="mb-6 space-y-2">
                    {sol.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {sol.available ? (
                    <Link to="/signup">
                      <Button className="bg-primary text-primary-foreground">
                        {t("solutions.learnMore")}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="secondary" disabled>
                      {t("solutions.comingSoon")}
                    </Button>
                  )}
                </div>
                <div className="flex flex-1 items-center justify-center rounded-xl bg-muted p-8">
                  <sol.icon className={`h-24 w-24 ${sol.iconColor} opacity-20`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Solutions;
