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
}

interface StepReportProps {
  question: string;
  papers: Paper[];
  includedPaperIds: string[];
  totalPapers: number;
  screenedCount: number;
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
  reportContent,
  onReportChange,
  onPrev,
}: StepReportProps) => {
  const { locale } = useLanguage();
  const [generating, setGenerating] = useState(false);

  const includedPapers = papers.filter((p) => includedPaperIds.includes(p.id));

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("synthesize-papers", {
        body: {
          query: question,
          papers: includedPapers.map((p) => ({
            title: p.title,
            authors: p.authors || [],
            year: p.year,
            abstract: p.abstract || "",
          })),
        },
      });
      if (error) throw error;

      // Build PRISMA-inspired summary + report
      const prisma = locale === "pt"
        ? `## Fluxograma PRISMA\n\n- **Artigos identificados:** ${totalPapers}\n- **Artigos triados:** ${screenedCount}\n- **Artigos incluídos:** ${includedPaperIds.length}\n- **Artigos excluídos:** ${screenedCount - includedPaperIds.length}\n\n---\n\n`
        : `## PRISMA Flow Diagram\n\n- **Papers identified:** ${totalPapers}\n- **Papers screened:** ${screenedCount}\n- **Papers included:** ${includedPaperIds.length}\n- **Papers excluded:** ${screenedCount - includedPaperIds.length}\n\n---\n\n`;

      const fullReport = prisma + (data?.synthesis || data?.report || "");
      onReportChange(fullReport);
      toast.success(locale === "pt" ? "Relatório gerado!" : "Report generated!");
    } catch (err: any) {
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <FileText className="h-4 w-4" />
          {locale === "pt" ? "Etapa 5: Relatório" : "Step 5: Report"}
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Gere um relatório síntese com base nos artigos incluídos na revisão."
            : "Generate a synthesis report based on the papers included in the review."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={generateReport} disabled={generating || includedPapers.length === 0} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {locale === "pt" ? "Gerar Relatório" : "Generate Report"}
        </Button>
        {reportContent && (
          <Button variant="outline" onClick={downloadMarkdown} className="gap-2">
            <Download className="h-4 w-4" />
            {locale === "pt" ? "Baixar Markdown" : "Download Markdown"}
          </Button>
        )}
      </div>

      {reportContent ? (
        <div className="rounded-xl border border-border bg-card p-6 prose prose-sm max-w-none dark:prose-invert">
          {reportContent.split("\n").map((line, i) => {
            if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-foreground mt-6 mb-2">{line.slice(3)}</h2>;
            if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-1">{line.slice(4)}</h3>;
            if (line.startsWith("- **")) {
              const match = line.match(/- \*\*(.+?)\*\*(.+)/);
              if (match) return <p key={i} className="text-sm text-foreground my-1"><strong>{match[1]}</strong>{match[2]}</p>;
            }
            if (line.startsWith("---")) return <hr key={i} className="my-4 border-border" />;
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} className="text-sm text-foreground my-1">{line}</p>;
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {locale === "pt"
              ? "Clique em 'Gerar Relatório' para criar a síntese da revisão sistemática"
              : "Click 'Generate Report' to create the systematic review synthesis"}
          </p>
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
