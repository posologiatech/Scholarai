import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";
import { Search, FileUp, Filter, Table, FlaskConical, FileText } from "lucide-react";

const WorkflowSection = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  const steps = [
    {
      icon: Search,
      num: "01",
      title: pt ? "Pergunta de pesquisa" : "Research question",
      desc: pt ? "Defina sua questão PICO" : "Define your PICO question",
    },
    {
      icon: FileUp,
      num: "02",
      title: pt ? "Coleta" : "Collection",
      desc: pt ? "API + importação RIS/BibTeX + busca booleana" : "API + RIS/BibTeX import + boolean search",
    },
    {
      icon: Filter,
      num: "03",
      title: pt ? "Triagem" : "Screening",
      desc: pt ? "IA + Active Learning + deduplicação" : "AI + Active Learning + deduplication",
    },
    {
      icon: Table,
      num: "04",
      title: pt ? "Extração" : "Extraction",
      desc: pt ? "Dados estruturados com prompts customizados" : "Structured data with custom prompts",
    },
    {
      icon: FlaskConical,
      num: "05",
      title: pt ? "Qualidade" : "Quality",
      desc: pt ? "CASP, Newcastle-Ottawa, Jadad, ROBINS-I" : "CASP, Newcastle-Ottawa, Jadad, ROBINS-I",
    },
    {
      icon: FileText,
      num: "06",
      title: pt ? "Relatório" : "Report",
      desc: pt ? "PRISMA 2020 + PDF + Markdown" : "PRISMA 2020 + PDF + Markdown",
    },
  ];

  return (
    <section className="border-t border-border/40 py-20 md:py-28">
      <div className="container mx-auto max-w-5xl px-4">
        <AnimatedSection>
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              {pt ? "Revisão Sistemática" : "Systematic Review"}
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
              {pt ? "6 etapas. Do protocolo à publicação." : "6 steps. From protocol to publication."}
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {pt
                ? "O único fluxo completo que integra busca booleana, Active Learning, avaliação de qualidade e diagrama PRISMA 2020 automatizado."
                : "The only complete workflow integrating boolean search, Active Learning, quality assessment, and automated PRISMA 2020 diagram."}
            </p>
          </div>
        </AnimatedSection>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <AnimatedSection key={step.num} delay={i * 0.08}>
              <div className="flex items-start gap-4 rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-primary/20 hover:shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-primary/60">{step.num}</span>
                  <h3 className="font-display text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
