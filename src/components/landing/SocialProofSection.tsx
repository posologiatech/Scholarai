import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";

const SocialProofSection = () => {
  const { t } = useLanguage();

  const institutions = [
    "USP", "UNICAMP", "UFRJ", "Harvard", "MIT", "Stanford", "Oxford", "FIOCRUZ"
  ];

  return (
    <section className="py-14">
      <AnimatedSection>
        <div className="container mx-auto">
          <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            {t("social.trusted")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {institutions.map((name) => (
              <span
                key={name}
                className="font-display text-base font-semibold text-muted-foreground/30 transition-colors hover:text-muted-foreground/50"
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
