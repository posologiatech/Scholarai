import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";

const CTASection = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  return (
    <section className="border-t border-border/40 py-20 md:py-28">
      <AnimatedSection>
        <div className="container mx-auto max-w-3xl text-center px-4">
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
            {pt ? "Pronto para acelerar sua pesquisa?" : "Ready to accelerate your research?"}
          </h2>
          <p className="mb-8 max-w-xl mx-auto text-muted-foreground">
            {pt
              ? "Junte-se a pesquisadores que já economizam horas em cada revisão sistemática. Comece gratuitamente — sem cartão de crédito."
              : "Join researchers already saving hours on every systematic review. Start free — no credit card required."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button
                size="lg"
                className="h-12 gap-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                {pt ? "Criar conta gratuita" : "Create free account"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg" className="h-12 rounded-xl">
                {pt ? "Ver planos" : "View plans"}
              </Button>
            </Link>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
};

export default CTASection;
