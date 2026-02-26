import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Download } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  journal?: string;
  doi?: string;
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
            journal: p.journal || "",
            doi: p.doi || "",
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
    return paper.authors.length > 1 ? `${lastName} et al.` : lastName;
  };

  const formatReference = (paper: Paper, index: number) => {
    if (!paper.authors?.length) {
      return (
        <p key={paper.id} className="text-[13px] leading-relaxed text-foreground pl-8 -indent-8">
          [{index + 1}] Unknown ({paper.year || "n.d."}). <em>{paper.title}</em>.
        </p>
      );
    }
    const authorList = paper.authors.slice(0, 6).join(", ");
    const moreAuthors = paper.authors.length > 6 ? `, and ${paper.authors.length - 6} more` : "";
    return (
      <p key={paper.id} className="text-[13px] leading-relaxed text-foreground pl-8 -indent-8">
        [{index + 1}] {authorList}{moreAuthors} ({paper.year || "n.d."}). <em>{paper.title}</em>.
        {paper.journal && <> <span className="text-muted-foreground">{paper.journal}</span>.</>}
        {paper.doi && <> <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">https://doi.org/{paper.doi}</a></>}
      </p>
    );
  };

  // Render markdown content with academic styling
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    const flushTable = () => {
      if (tableRows.length === 0) return;
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(2); // skip separator
      const headers = headerRow.split("|").filter(h => h.trim());
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-4">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b-2 border-foreground/20">
                {headers.map((h, i) => (
                  <th key={i} className="py-2 px-3 text-left font-semibold text-foreground">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => {
                const cells = row.split("|").filter(c => c.trim() !== "" || row.includes("||"));
                const cellValues = row.split("|").slice(1, -1);
                return (
                  <tr key={ri} className="border-b border-border/50">
                    {cellValues.map((c, ci) => (
                      <td key={ci} className="py-1.5 px-3 text-foreground">{renderInline(c.trim())}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Table detection
      if (line.includes("|") && line.trim().startsWith("|")) {
        inTable = true;
        tableRows.push(line);
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={i} className="text-xl font-bold text-foreground mt-10 mb-4 border-b border-border pb-2">
            {line.slice(2)}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2 key={i} className="text-base font-bold text-foreground mt-8 mb-3 uppercase tracking-wider">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        elements.push(
          <h3 key={i} className="text-sm font-bold text-foreground mt-5 mb-2 italic">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith("#### ")) {
        elements.push(
          <h4 key={i} className="text-sm font-semibold text-foreground mt-4 mb-1">{line.slice(5)}</h4>
        );
      } else if (line.startsWith("---")) {
        elements.push(<hr key={i} className="my-8 border-border" />);
      } else if (line.trim() === "") {
        elements.push(<div key={i} className="h-1" />);
      } else if (line.match(/^\s*-\s/)) {
        const content = line.replace(/^\s*-\s/, "");
        elements.push(
          <li key={i} className="text-[13px] text-foreground my-0.5 list-disc ml-6 leading-relaxed">
            {renderInline(content)}
          </li>
        );
      } else if (line.match(/^\s*\d+\.\s/)) {
        const content = line.replace(/^\s*\d+\.\s/, "");
        elements.push(
          <li key={i} className="text-[13px] text-foreground my-0.5 list-decimal ml-6 leading-relaxed">
            {renderInline(content)}
          </li>
        );
      } else {
        elements.push(
          <p key={i} className="text-[13px] text-foreground my-2 leading-[1.8] text-justify">
            {renderInline(line)}
          </p>
        );
      }
    }
    if (inTable) flushTable();
    return elements;
  };

  const renderInline = (text: string) => {
    // Handle bold then italic
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, j) => {
      if (j % 2 === 1) return <strong key={j}>{part}</strong>;
      // Handle italic
      const italicParts = part.split(/\*(.*?)\*/g);
      return italicParts.map((ip, k) => {
        if (k % 2 === 1) return <em key={`${j}-${k}`}>{ip}</em>;
        return ip;
      });
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <FileText className="h-4 w-4" />
          {locale === "pt" ? "Etapa 5: Relatório" : "Step 5: Report"}
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Gere um relatório completo de revisão sistemática no padrão acadêmico profissional."
            : "Generate a complete systematic review report in professional academic format."}
        </p>
      </div>

      {/* Action buttons */}
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
        <div className="space-y-0">
          {/* Main report - academic paper style */}
          <article className="bg-card border border-border rounded-xl p-8 md:p-12 shadow-sm">
            {/* Title block */}
            <header className="text-center mb-8 pb-6 border-b border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                {locale === "pt" ? "Artigo de Revisão Sistemática" : "Systematic Review Article"}
              </p>
              <h1 className="text-lg md:text-xl font-bold text-foreground leading-tight mb-4">
                {question}
              </h1>
              <p className="text-xs text-muted-foreground">
                {locale === "pt"
                  ? `Revisão sistemática • ${includedPapers.length} estudos incluídos • Gerado em ${new Date().toLocaleDateString("pt-BR")}`
                  : `Systematic review • ${includedPapers.length} studies included • Generated ${new Date().toLocaleDateString()}`}
              </p>
            </header>

            {/* Report body */}
            <div className="report-body">
              {renderContent(reportContent)}
            </div>

            {/* PRISMA Flow Diagram */}
            <section className="mt-10 pt-6 border-t border-border">
              <h2 className="text-base font-bold text-foreground uppercase tracking-wider mb-6 text-center">
                {locale === "pt" ? "Diagrama de Fluxo PRISMA" : "PRISMA Flow Diagram"}
              </h2>
              <div className="flex flex-col items-center gap-0">
                {/* Identified */}
                <div className="rounded-lg border-2 border-foreground/20 bg-muted/30 px-8 py-4 text-center min-w-[280px]">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {locale === "pt" ? "Artigos identificados nas bases de dados" : "Records identified through database searching"}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">n = {totalPapers}</p>
                </div>
                <div className="w-px h-8 bg-foreground/20" />

                {/* Screened */}
                <div className="rounded-lg border-2 border-foreground/20 bg-muted/30 px-8 py-4 text-center min-w-[280px]">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {locale === "pt" ? "Artigos triados" : "Records screened"}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">n = {screenedCount}</p>
                  {enabledCriteria.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-xs">
                      {enabledCriteria.map((c) => c.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="w-px h-8 bg-foreground/20" />

                {/* Included / Excluded */}
                <div className="flex gap-6 items-start">
                  <div className="rounded-lg border-2 border-primary/40 bg-primary/5 px-6 py-4 text-center min-w-[160px]">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {locale === "pt" ? "Artigos incluídos" : "Studies included"}
                    </p>
                    <p className="text-2xl font-bold text-primary mt-1">n = {includedPaperIds.length}</p>
                  </div>
                  <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 px-6 py-4 text-center min-w-[160px]">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {locale === "pt" ? "Artigos excluídos" : "Records excluded"}
                    </p>
                    <p className="text-2xl font-bold text-destructive mt-1">n = {excludedCount}</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-4 italic">
                {locale === "pt"
                  ? "Figura 1. Diagrama de fluxo PRISMA da seleção dos estudos."
                  : "Figure 1. PRISMA flow diagram of study selection."}
              </p>
            </section>

            {/* Extraction results table */}
            {enabledCols.length > 0 && Object.keys(extractionResults).length > 0 && (
              <section className="mt-10 pt-6 border-t border-border">
                <h2 className="text-base font-bold text-foreground uppercase tracking-wider mb-2">
                  {locale === "pt" ? "Características dos Estudos Incluídos" : "Characteristics of Included Studies"}
                </h2>
                <p className="text-[10px] text-muted-foreground italic mb-4">
                  {locale === "pt"
                    ? `Tabela 1. Dados extraídos dos ${includedPapers.length} estudos incluídos na revisão.`
                    : `Table 1. Data extracted from ${includedPapers.length} studies included in the review.`}
                </p>
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b-2 border-foreground/20 bg-muted/40">
                        <th className="py-2.5 px-3 text-left font-bold text-foreground min-w-[140px]">
                          {locale === "pt" ? "Estudo" : "Study"}
                        </th>
                        {enabledCols.map((col) => (
                          <th key={col.id} className="py-2.5 px-3 text-left font-bold text-foreground min-w-[120px]">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {includedPapers.map((paper, idx) => {
                        const results = extractionResults[paper.id];
                        if (!results) return null;
                        return (
                          <tr key={paper.id} className={`border-b border-border/50 ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/20"}`}>
                            <td className="py-2 px-3 font-medium text-foreground whitespace-nowrap">
                              {formatAuthorShort(paper)}, {paper.year || "n.d."}
                            </td>
                            {enabledCols.map((col) => (
                              <td key={col.id} className="py-2 px-3 text-foreground">
                                {results[col.id] || "-"}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* References */}
            <section className="mt-10 pt-6 border-t border-border">
              <h2 className="text-base font-bold text-foreground uppercase tracking-wider mb-4">
                {locale === "pt" ? "Referências" : "References"}
              </h2>
              <div className="space-y-2">
                {includedPapers.map((paper, index) => formatReference(paper, index))}
              </div>
            </section>
          </article>
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
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-start pt-4">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {locale === "pt" ? "Voltar para Extração" : "Back to Extraction"}
        </Button>
      </div>
    </div>
  );
};

export default StepReport;
