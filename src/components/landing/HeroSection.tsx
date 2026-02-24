import { Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden pb-20 pt-16 md:pt-24">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-0 top-20 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("hero.badge")}
        </div>

        <h1 className="mb-6 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
          {t("hero.title1")}
          <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t("hero.title2")}
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
          {t("hero.subtitle")}
        </p>

        {/* Search bar */}
        <div className="mx-auto mb-8 max-w-2xl">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-lg shadow-primary/5 transition-shadow focus-within:shadow-xl focus-within:shadow-primary/10">
            <Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("hero.searchPlaceholder")}
              className="flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none md:text-base"
            />
            <Button size="lg" className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
              {t("hero.cta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground md:gap-12">
          <div className="flex flex-col items-center">
            <span className="font-display text-2xl font-bold text-foreground">200M+</span>
            <span>{t("social.papers")}</span>
          </div>
          <div className="hidden h-8 w-px bg-border md:block" />
          <div className="flex flex-col items-center">
            <span className="font-display text-2xl font-bold text-foreground">50K+</span>
            <span>{t("social.researchers")}</span>
          </div>
          <div className="hidden h-8 w-px bg-border md:block" />
          <div className="flex flex-col items-center">
            <span className="font-display text-2xl font-bold text-foreground">500+</span>
            <span>{t("social.universities")}</span>
          </div>
          <div className="hidden h-8 w-px bg-border md:block" />
          <div className="flex flex-col items-center">
            <span className="font-display text-2xl font-bold text-foreground">10x</span>
            <span>{t("social.timeSaved")}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
