import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";

const SocialProofSection = () => {
  const { t } = useLanguage();

  const institutions = [
    "USP", "UNICAMP", "UFRJ", "Harvard", "MIT", "Stanford", "Oxford", "FIOCRUZ"
  ];

  return (
    <section className="border-t border-border py-12">
      <AnimatedSection>
        <div className="container mx-auto">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t("social.trusted")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {institutions.map((name) => (
              <span
                key={name}
                className="font-display text-lg font-semibold text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
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
