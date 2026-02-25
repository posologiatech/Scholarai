import { Search, Table, FileText, ClipboardCheck, ShieldCheck, Palette } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: Search,
      title: t("features.search.title"),
      desc: t("features.search.desc"),
    },
    {
      icon: Table,
      title: t("features.extraction.title"),
      desc: t("features.extraction.desc"),
    },
    {
      icon: FileText,
      title: t("features.reports.title"),
      desc: t("features.reports.desc"),
    },
    {
      icon: ClipboardCheck,
      title: t("features.review.title"),
      desc: t("features.review.desc"),
    },
    {
      icon: ShieldCheck,
      title: t("features.refcheck.title"),
      desc: t("features.refcheck.desc"),
    },
    {
      icon: Palette,
      title: t("features.illustrations.title"),
      desc: t("features.illustrations.desc"),
    },
  ];

  return (
    <section className="border-t border-border/40 py-20 md:py-28">
      <div className="container mx-auto max-w-5xl">
        <AnimatedSection>
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
              {t("features.title")}
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {t("features.subtitle")}
            </p>
          </div>
        </AnimatedSection>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <AnimatedSection key={f.title} delay={i * 0.1}>
              <div className="group rounded-xl border border-border/50 bg-card p-7 transition-all hover:border-border hover:shadow-md">
                <div className="mb-4 inline-flex rounded-lg bg-muted p-2.5">
                  <f.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
