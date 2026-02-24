import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { Building2, GraduationCap, Stethoscope, Landmark } from "lucide-react";

const useCasesData = {
  pt: [
    {
      icon: Stethoscope,
      sector: "Farmacêutica",
      title: "Revisão de literatura clínica em horas, não semanas",
      description: "Uma equipe de P&D farmacêutico usou o ScholarAI para revisar 2.000 artigos sobre um novo composto em 3 horas — tarefa que normalmente levaria 3 semanas. A extração automática de dados identificou efeitos colaterais relatados com 98% de precisão.",
      stat: "3h vs 3 semanas",
    },
    {
      icon: GraduationCap,
      sector: "Academia",
      title: "Dissertação de mestrado com revisão sistemática completa",
      description: "Um mestrando em saúde pública utilizou a revisão sistemática automatizada para triar 800 artigos com critérios de inclusão/exclusão, reduzindo o tempo de triagem de 2 meses para 4 dias.",
      stat: "4 dias vs 2 meses",
    },
    {
      icon: Building2,
      sector: "Tecnologia Médica",
      title: "Mapeamento de evidências para aprovação regulatória",
      description: "Uma empresa de dispositivos médicos usou relatórios por IA para compilar evidências de 150 estudos clínicos, gerando um documento de 40 páginas com citações verificáveis para submissão à ANVISA.",
      stat: "150 estudos sintetizados",
    },
    {
      icon: Landmark,
      sector: "Governo",
      title: "Políticas públicas baseadas em evidências",
      description: "O departamento de saúde de um estado brasileiro usou o ScholarAI para analisar a eficácia de intervenções de saúde pública, extraindo dados de 500 papers com 99% de precisão na extração.",
      stat: "99% de precisão",
    },
  ],
  en: [
    {
      icon: Stethoscope,
      sector: "Pharmaceutical",
      title: "Clinical literature review in hours, not weeks",
      description: "A pharma R&D team used ScholarAI to review 2,000 papers on a new compound in 3 hours — a task that would normally take 3 weeks. Automatic data extraction identified reported side effects with 98% accuracy.",
      stat: "3h vs 3 weeks",
    },
    {
      icon: GraduationCap,
      sector: "Academia",
      title: "Master's thesis with complete systematic review",
      description: "A public health master's student used automated systematic review to screen 800 papers with inclusion/exclusion criteria, reducing screening time from 2 months to 4 days.",
      stat: "4 days vs 2 months",
    },
    {
      icon: Building2,
      sector: "Medical Technology",
      title: "Evidence mapping for regulatory approval",
      description: "A medical device company used AI reports to compile evidence from 150 clinical studies, generating a 40-page document with verifiable citations for FDA submission.",
      stat: "150 studies synthesized",
    },
    {
      icon: Landmark,
      sector: "Government",
      title: "Evidence-based public policy",
      description: "A state health department used ScholarAI to analyze the effectiveness of public health interventions, extracting data from 500 papers with 99% extraction accuracy.",
      stat: "99% accuracy",
    },
  ],
};

const UseCases = () => {
  const { t, locale } = useLanguage();
  const cases = useCasesData[locale];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl">{t("useCases.title")}</h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">{t("useCases.subtitle")}</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {cases.map((c) => (
              <div key={c.sector} className="rounded-2xl border border-border bg-card p-8 transition-all hover:shadow-lg hover:shadow-primary/5">
                <div className="mb-4 inline-flex rounded-xl bg-primary/5 p-3">
                  <c.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-primary">{c.sector}</span>
                <h3 className="mb-3 font-display text-xl font-bold text-foreground">{c.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                <div className="inline-flex rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
                  {c.stat}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UseCases;
