import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
}

interface ScreeningCriterion {
  id: string;
  name: string;
  description: string;
  enabled?: boolean;
}

interface ExtractionColumn {
  id: string;
  name: string;
  prompt: string;
  enabled?: boolean;
}

interface StepReportProps {
  question: string;
  papers: Paper[];
  includedPaperIds: string[];
  totalPapers: number;
  screenedCount: number;
  criteria: ScreeningCriterion[];
  screeningResults: Record<string, any>;
  extractionColumns: ExtractionColumn[];
  extractionResults: Record<string, Record<string, string>>;
  reportContent: string;
  onReportChange: (content: string) => void;
  onPrev: () => void;
}

const StepReport = ({
  question,
  papers,
  includedPaperIds,
  totalPapers,
  screenedCount,
  criteria,
  screeningResults,
  extractionColumns,
  extractionResults,
  reportContent,
  onReportChange,
  onPrev,
}: StepReportProps) => {
  const { locale } = useLanguage();
  const [generating, setGenerating] = useState(false);
  const [methodsExpanded, setMethodsExpanded] = useState(false);

  const includedPapers = papers.filter((p) => includedPaperIds.includes(p.id));
  const excludedCount = screenedCount - includedPaperIds.length;
  const enabledCriteria = criteria.filter((c) => c.enabled !== false);
  const enabledCols = extractionColumns.filter((c) => c.enabled !== false);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-review-report", {
        body: {
          question,
          papers: includedPapers.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors || [],
            year: p.year,
            abstract: p.abstract || "",
          })),
          includedPaperIds,
          totalPapers,
          screenedCount,
          criteria: enabledCriteria,
          screeningResults,
          extractionColumns: enabledCols,
          extractionResults,
          locale,
        },
      });
      if (error) throw error;
      onReportChange(data?.report || "");
      toast.success(locale === "pt" ? "Relatório gerado!" : "Report generated!");
    } catch (err: any) {
      console.error("Report generation error:", err);
      toast.error(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([reportContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "systematic-review-report.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatAuthorShort = (paper: Paper) => {
    if (!paper.authors?.length) return "Unknown";
    const lastName = paper.authors[0].split(" ").pop() || paper.authors[0];
    return paper.authors.length > 1
      ? `${lastName} et al.`
      : lastName;
  };

  const formatAuthorFull = (paper: Paper) => {
    if (!paper.authors?.length) return "Unknown";
    const authors = paper.authors.slice(0, 6).join(", ");
    return paper.authors.length > 6
      ? `${authors}, and ${paper.authors.length - 6} more`
      : authors;
  };

  // Render markdown-like content
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-foreground mt-8 mb-3">{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-foreground mt-6 mb-2 uppercase tracking-wide text-primary">{line.slice(3)}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith("#### ")) return <h4 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.slice(5)}</h4>;
      if (line.startsWith("---")) return <hr key={i} className="my-6 border-border" />;
      if (line.trim() === "") return <div key={i} className="h-2" />;

      // Bold text inline
      const renderBold = (text: string) => {
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part);
      };

      // Italic
      const renderInline = (text: string) => {
        const parts = text.split(/\*(.*?)\*/g);
        return parts.map((part, j) => {
          if (j % 2 === 1) return <em key={j}>{part}</em>;
          return renderBold(part);
        });
      };

      if (line.match(/^\s*-\s/)) {
        const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
        const content = line.replace(/^\s*-\s/, "");
        return (
          <li key={i} className="text-sm text-foreground my-0.5 list-disc" style={{ marginLeft: `${Math.max(indent, 1) * 16}px` }}>
            {renderInline(content)}
          </li>
        );
      }

      if (line.match(/^\s*\d+\.\s/)) {
        const content = line.replace(/^\s*\d+\.\s/, "");
        return (
          <li key={i} className="text-sm text-foreground my-0.5 list-decimal ml-6">
            {renderInline(content)}
          </li>
        );
      }

      return <p key={i} className="text-sm text-foreground my-1.5 leading-relaxed">{renderInline(line)}</p>;
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <FileText className="h-4 w-4" />
          {locale === "pt" ? "Etapa 5: Relatório" : "Step 5: Report"}
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Gere um relatório completo de revisão sistemática com diagrama PRISMA, métodos, resultados e referências."
            : "Generate a complete systematic review report with PRISMA diagram, methods, results, and references."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={generateReport} disabled={generating || includedPapers.length === 0} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {locale === "pt" ? "Gerar Relatório Completo" : "Generate Full Report"}
        </Button>
        {reportContent && (
          <Button variant="outline" onClick={downloadMarkdown} className="gap-2">
            <Download className="h-4 w-4" />
            {locale === "pt" ? "Baixar Markdown" : "Download Markdown"}
          </Button>
        )}
      </div>

      {reportContent ? (
        <div className="space-y-6">
          {/* PRISMA Flow Diagram */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Visual PRISMA */}
              <div className="flex-shrink-0">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-4">
                    <div className="rounded-lg border border-border bg-muted/50 p-3 text-center min-w-[140px]">
                      <p className="text-xs text-muted-foreground">{locale === "pt" ? "Artigos identificados" : "Papers identified"}</p>
                      <p className="text-lg font-bold text-foreground">n = {totalPapers}</p>
                    </div>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="rounded-lg border border-border bg-muted/50 p-3 text-center min-w-[200px]">
                    <p className="text-xs text-muted-foreground">
                      {locale === "pt" ? "Artigos triados" : "Papers screened"}
                      {enabledCriteria.length > 0 && (
                        <span className="block text-[10px]">
                          {enabledCriteria.map((c) => c.name).join(", ")}
                        </span>
                      )}
                    </p>
                    <p className="text-lg font-bold text-foreground">n = {screenedCount}</p>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex gap-4">
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center min-w-[140px]">
                      <p className="text-xs text-muted-foreground">{locale === "pt" ? "Artigos incluídos" : "Papers included"}</p>
                      <p className="text-lg font-bold text-primary">n = {includedPaperIds.length}</p>
                    </div>
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center min-w-[140px]">
                      <p className="text-xs text-muted-foreground">{locale === "pt" ? "Artigos excluídos" : "Papers excluded"}</p>
                      <p className="text-lg font-bold text-destructive">n = {excludedCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Methods summary (collapsible) */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setMethodsExpanded(!methodsExpanded)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wide mb-2 hover:opacity-80"
                >
                  {locale === "pt" ? "MÉTODOS" : "METHODS"}
                  {methodsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {!methodsExpanded && (
                  <p className="text-sm text-muted-foreground">
                    {locale === "pt"
                      ? `Analisamos ${includedPaperIds.length} artigos de um pool inicial de ${totalPapers}, utilizando ${enabledCriteria.length} critérios de triagem. Cada artigo foi avaliado para ${enabledCols.length} aspectos-chave relevantes à pergunta de pesquisa.`
                      : `We analyzed ${includedPaperIds.length} papers from an initial pool of ${totalPapers}, using ${enabledCriteria.length} screening criteria. Each paper was reviewed for ${enabledCols.length} key aspects.`}
                    <button onClick={() => setMethodsExpanded(true)} className="ml-1 text-primary hover:underline">
                      {locale === "pt" ? "Mais sobre métodos" : "More on methods"}
                    </button>
                  </p>
                )}

                {methodsExpanded && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <h4 className="font-semibold text-foreground">{locale === "pt" ? "Busca de artigos" : "Paper search"}</h4>
                      <p className="text-muted-foreground">
                        {locale === "pt"
                          ? `Usando a pergunta de pesquisa "${question}", buscamos em múltiplas bases acadêmicas (Semantic Scholar, PubMed, OpenAlex, Europe PMC, ClinicalTrials.gov). Recuperamos os ${totalPapers} artigos mais relevantes.`
                          : `Using the research question "${question}", we searched across multiple academic databases. We retrieved the ${totalPapers} most relevant papers.`}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{locale === "pt" ? "Triagem" : "Screening"}</h4>
                      <p className="text-muted-foreground mb-1">
                        {locale === "pt" ? "Triamos os artigos com base nestes critérios:" : "We screened papers using these criteria:"}
                      </p>
                      <ul className="space-y-1 ml-4">
                        {enabledCriteria.map((c) => (
                          <li key={c.id} className="text-muted-foreground list-disc">
                            <strong className="text-foreground">{c.name}</strong>: {c.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {enabledCols.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground">{locale === "pt" ? "Extração de dados" : "Data extraction"}</h4>
                        <p className="text-muted-foreground mb-1">
                          {locale === "pt"
                            ? "Extraímos os seguintes campos de cada artigo incluído:"
                            : "We extracted the following fields from each included paper:"}
                        </p>
                        <ul className="space-y-1 ml-4">
                          {enabledCols.map((col) => (
                            <li key={col.id} className="text-muted-foreground list-disc">
                              <strong className="text-foreground">{col.name}</strong>: {col.prompt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Extraction results table */}
          {enabledCols.length > 0 && Object.keys(extractionResults).length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                  {locale === "pt" ? "RESULTADOS" : "RESULTS"}
                </h3>
                <p className="text-base font-semibold text-foreground mt-1">
                  {locale === "pt" ? "Características dos Estudos Incluídos" : "Characteristics of Included Studies"}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="p-3 text-left font-medium text-foreground border-r border-border min-w-[180px]">
                        {locale === "pt" ? "Estudo" : "Study"}
                      </th>
                      {enabledCols.map((col) => (
                        <th key={col.id} className="p-3 text-left font-medium text-foreground border-r border-border last:border-0 min-w-[150px]">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {includedPapers.map((paper) => {
                      const results = extractionResults[paper.id];
                      if (!results) return null;
                      return (
                        <tr key={paper.id} className="border-t border-border hover:bg-muted/20">
                          <td className="p-3 border-r border-border">
                            <span className="font-medium text-foreground">
                              {formatAuthorShort(paper)}, {paper.year || "n.d."}
                            </span>
                          </td>
                          {enabledCols.map((col) => (
                            <td key={col.id} className="p-3 border-r border-border last:border-0 text-foreground">
                              {results[col.id] || "-"}
                              <span className="text-muted-foreground ml-1">*</span>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI-generated report content */}
          <div className="rounded-xl border border-border bg-card p-6">
            {renderContent(reportContent)}
          </div>

          {/* References */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">
              {locale === "pt" ? "REFERÊNCIAS" : "REFERENCES"}
            </h2>
            <div className="space-y-3">
              {includedPapers.map((paper) => (
                <p key={paper.id} className="text-sm text-foreground leading-relaxed">
                  {formatAuthorFull(paper)} ({paper.year || "n.d."}).{" "}
                  <em>{paper.title}</em>.
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {locale === "pt"
              ? "Clique em 'Gerar Relatório Completo' para criar a síntese da revisão sistemática"
              : "Click 'Generate Full Report' to create the systematic review synthesis"}
          </p>
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p>{locale === "pt" ? `${includedPapers.length} artigos incluídos` : `${includedPapers.length} papers included`}</p>
            <p>{locale === "pt" ? `${enabledCols.length} campos de extração` : `${enabledCols.length} extraction fields`}</p>
            <p>{locale === "pt" ? `${enabledCriteria.length} critérios de triagem` : `${enabledCriteria.length} screening criteria`}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {locale === "pt" ? "Anterior" : "Previous"}
        </Button>
        <div />
      </div>
    </div>
  );
};

export default StepReport;
