import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { Target, Users, Lightbulb } from "lucide-react";

const About = () => {
  const { t, locale } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl">{t("about.title")}</h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">{t("about.subtitle")}</p>
          </div>

          <div className="mb-16 rounded-2xl border border-border bg-card p-8 md:p-12">
            <div className="mb-4 inline-flex rounded-xl bg-primary/5 p-3">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mb-4 font-display text-2xl font-bold text-foreground">{t("about.mission.title")}</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">{t("about.mission.desc")}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
            <div className="mb-4 inline-flex rounded-xl bg-accent/5 p-3">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <h2 className="mb-4 font-display text-2xl font-bold text-foreground">
              {locale === "pt" ? "Pesquisador Responsável" : "Lead Researcher"}
            </h2>
            <div className="rounded-xl bg-muted p-6 text-center max-w-xs">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <span className="font-display text-xl font-bold text-primary">SA</span>
              </div>
              <h4 className="font-display font-semibold text-foreground">Sérgio Araújo</h4>
              <p className="text-sm text-muted-foreground">{locale === "pt" ? "Pesquisador Responsável" : "Lead Researcher"}</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
