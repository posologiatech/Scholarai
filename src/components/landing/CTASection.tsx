import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const CTASection = () => {
  const { t } = useLanguage();

  return (
    <section className="border-t border-border py-20 md:py-28">
      <div className="container mx-auto max-w-3xl text-center">
        <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
          {t("cta.title")}
        </h2>
        <p className="mb-8 text-lg text-muted-foreground">
          {t("cta.subtitle")}
        </p>
        <Link to="/signup">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
            {t("cta.button")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default CTASection;
