import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";

const SocialProofSection = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  const institutions = [
    "USP", "UNICAMP", "UFRJ", "UFRN", "Harvard", "MIT", "Stanford", "Oxford", "FIOCRUZ", "UFMG"
  ];

  return (
    <section className="py-12 border-t border-border/20">
      <AnimatedSection>
        <div className="container mx-auto px-4">
          <p className="mb-6 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">
            {pt ? "Usado por pesquisadores em" : "Trusted by researchers at"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {institutions.map((name) => (
              <span
                key={name}
                className="font-display text-sm font-semibold text-muted-foreground/25 transition-colors hover:text-muted-foreground/45"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
};

export default SocialProofSection;
