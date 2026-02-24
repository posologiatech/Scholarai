import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";

const CTASection = () => {
  const { t, locale } = useLanguage();

  return (
    <section className="border-t border-border/40 py-20 md:py-28">
      <AnimatedSection>
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
            {t("cta.title")}
          </h2>
          <p className="mb-8 text-muted-foreground">
            {t("cta.subtitle")}
          </p>
          <Link to="/signup">
            <Button
              size="lg"
              className="h-13 gap-3 rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90"
            >
              {t("cta.button")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </AnimatedSection>
    </section>
  );
};

export default CTASection;
