import { Search, Table, FileText, ClipboardCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: Search,
      title: t("features.search.title"),
      desc: t("features.search.desc"),
      gradient: "from-primary/10 to-primary/5",
      iconColor: "text-primary",
    },
    {
      icon: Table,
      title: t("features.extraction.title"),
      desc: t("features.extraction.desc"),
      gradient: "from-accent/10 to-accent/5",
      iconColor: "text-accent",
    },
    {
      icon: FileText,
      title: t("features.reports.title"),
      desc: t("features.reports.desc"),
      gradient: "from-success/10 to-success/5",
      iconColor: "text-success",
    },
    {
      icon: ClipboardCheck,
      title: t("features.review.title"),
      desc: t("features.review.desc"),
      gradient: "from-primary/10 to-accent/5",
      iconColor: "text-primary",
    },
  ];

  return (
    <section className="border-t border-border bg-card py-20 md:py-28">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-background p-8 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className={`mb-5 inline-flex rounded-xl bg-gradient-to-br ${f.gradient} p-3`}>
                <f.icon className={`h-6 w-6 ${f.iconColor}`} />
              </div>
              <h3 className="mb-3 font-display text-xl font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
