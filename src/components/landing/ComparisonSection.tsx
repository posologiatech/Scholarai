import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";
import { Check, X, Minus } from "lucide-react";

const ComparisonSection = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  const features = [
    { name: pt ? "Busca semântica multi-fonte" : "Multi-source semantic search", scholar: true, elicit: true, covidence: false, rayyan: false },
    { name: pt ? "Importação RIS/BibTeX" : "RIS/BibTeX import", scholar: true, elicit: false, covidence: true, rayyan: true },
    { name: pt ? "Busca booleana com MeSH" : "Boolean search with MeSH", scholar: true, elicit: false, covidence: false, rayyan: false },
    { name: "Active Learning", scholar: true, elicit: false, covidence: false, rayyan: "partial" as any },
    { name: pt ? "Deduplicação automática" : "Auto deduplication", scholar: true, elicit: false, covidence: true, rayyan: true },
    { name: pt ? "Avaliação de qualidade (CASP, NOS)" : "Quality assessment (CASP, NOS)", scholar: true, elicit: false, covidence: true, rayyan: false },
    { name: pt ? "Diagrama PRISMA 2020" : "PRISMA 2020 diagram", scholar: true, elicit: false, covidence: true, rayyan: false },
    { name: pt ? "Extração AI com prompts" : "AI extraction with prompts", scholar: true, elicit: true, covidence: false, rayyan: false },
    { name: pt ? "Análise de dados (Python/R)" : "Data analysis (Python/R)", scholar: true, elicit: false, covidence: false, rayyan: false },
    { name: pt ? "Grafo de conhecimento" : "Knowledge graph", scholar: true, elicit: false, covidence: false, rayyan: false },
    { name: pt ? "Gratuito para pesquisadores" : "Free for researchers", scholar: true, elicit: "partial" as any, covidence: false, rayyan: true },
  ];

  const CellIcon = ({ val }: { val: boolean | "partial" }) => {
    if (val === true) return <Check className="h-4 w-4 text-success" />;
    if (val === "partial") return <Minus className="h-4 w-4 text-accent" />;
    return <X className="h-4 w-4 text-muted-foreground/30" />;
  };

  return (
    <section className="border-t border-border/40 py-20 md:py-28 bg-muted/20">
      <div className="container mx-auto max-w-5xl px-4">
        <AnimatedSection>
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
              {pt ? "Compare com as alternativas" : "Compare with alternatives"}
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {pt
                ? "ScholarAI integra funcionalidades que normalmente exigem 3-4 ferramentas separadas."
                : "ScholarAI integrates features that typically require 3-4 separate tools."}
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.15}>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground min-w-[200px]">
                    {pt ? "Funcionalidade" : "Feature"}
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-primary min-w-[90px]">ScholarAI</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground min-w-[90px]">Elicit</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground min-w-[90px]">Covidence</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground min-w-[90px]">Rayyan</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-foreground text-xs">{f.name}</td>
                    <td className="px-4 py-2.5 text-center"><CellIcon val={f.scholar} /></td>
                    <td className="px-4 py-2.5 text-center"><CellIcon val={f.elicit} /></td>
                    <td className="px-4 py-2.5 text-center"><CellIcon val={f.covidence} /></td>
                    <td className="px-4 py-2.5 text-center"><CellIcon val={f.rayyan} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default ComparisonSection;
