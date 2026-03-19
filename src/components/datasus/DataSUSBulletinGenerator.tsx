import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FileText, Download, Loader2, Sparkles } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ParsedTable {
  title: string;
  headers: string[];
  rows: string[][];
}

interface BulletinProps {
  isPt: boolean;
  messages: Array<{
    role: string;
    content: string;
    explanation?: string;
    dataSource?: string;
    disease?: string;
    location?: string;
    period?: string;
    stdout?: string;
    images?: string[];
    tables?: ParsedTable[];
    dataSourceDetail?: string;
  }>;
}

type BulletinTemplate = "estadual" | "tematico" | "resumo";

const TEMPLATES: Record<BulletinTemplate, { label: string; description: string }> = {
  estadual: { label: "Boletim Estadual", description: "Dados agrupados por UF com análise comparativa" },
  tematico: { label: "Boletim Temático", description: "Análise focada em um agravo específico" },
  resumo: { label: "Resumo Executivo", description: "Síntese rápida dos principais achados" },
};

export default function DataSUSBulletinGenerator({ isPt, messages }: BulletinProps) {
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState<BulletinTemplate>("tematico");

  const assistantMessages = messages.filter(m => m.role === "assistant" && (m.explanation || m.stdout || m.images?.length));

  if (assistantMessages.length === 0) return null;

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Boletim Epidemiológico", margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} — Template: ${TEMPLATES[template].label}`, margin, y);
      y += 4;
      doc.text("Fonte: Plataforma ARCA Research — Dados reais do DataSUS", margin, y);
      y += 8;

      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setTextColor(0);

      for (const msg of assistantMessages) {
        // Check if need new page
        if (y > 260) { doc.addPage(); y = margin; }

        // Section header
        if (msg.disease || msg.dataSource) {
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          const sectionTitle = [msg.disease, msg.location, msg.period].filter(Boolean).join(" — ");
          doc.text(sectionTitle || "Análise", margin, y);
          y += 6;

          if (msg.dataSourceDetail) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(120);
            doc.text(`Fonte: ${msg.dataSourceDetail}`, margin, y);
            doc.setTextColor(0);
            y += 5;
          }
        }

        // Explanation text
        if (msg.explanation) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          const cleanText = msg.explanation.replace(/[#*_`]/g, "").replace(/\n{3,}/g, "\n\n");
          const lines = doc.splitTextToSize(cleanText, contentWidth);
          for (const line of lines) {
            if (y > 275) { doc.addPage(); y = margin; }
            doc.text(line, margin, y);
            y += 4.5;
          }
          y += 3;
        }

        // Tables
        if (msg.tables && msg.tables.length > 0) {
          for (const table of msg.tables) {
            if (y > 240) { doc.addPage(); y = margin; }
            if (table.title) {
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              doc.text(table.title, margin, y);
              y += 5;
            }
            autoTable(doc, {
              startY: y,
              head: [table.headers],
              body: table.rows.slice(0, 30),
              margin: { left: margin, right: margin },
              styles: { fontSize: 7, cellPadding: 1.5 },
              headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7 },
              alternateRowStyles: { fillColor: [245, 247, 250] },
            });
            y = (doc as any).lastAutoTable.finalY + 8;
          }
        }

        // Images
        if (msg.images && msg.images.length > 0) {
          for (const img of msg.images) {
            if (y > 180) { doc.addPage(); y = margin; }
            try {
              const imgData = `data:image/png;base64,${img}`;
              doc.addImage(imgData, "PNG", margin, y, contentWidth, contentWidth * 0.6);
              y += contentWidth * 0.6 + 8;
            } catch { /* skip broken images */ }
          }
        }

        y += 5;
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(
          `ARCA Research — Boletim Epidemiológico — Página ${i}/${totalPages}`,
          pageWidth / 2, 290, { align: "center" }
        );
      }

      const fileName = `boletim_epidemiologico_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);

      toast({
        title: isPt ? "Boletim gerado!" : "Bulletin generated!",
        description: isPt ? `Arquivo ${fileName} salvo com sucesso.` : `File ${fileName} saved successfully.`,
      });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({
        title: isPt ? "Erro ao gerar PDF" : "Error generating PDF",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-border/30 bg-muted/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold text-foreground">
              {isPt ? "Gerar Boletim Epidemiológico" : "Generate Epidemiological Bulletin"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isPt ? "PDF com todas as análises desta conversa" : "PDF with all analyses from this conversation"}
            </p>
          </div>
          <Select value={template} onValueChange={(v) => setTemplate(v as BulletinTemplate)}>
            <SelectTrigger className="w-[180px] h-9 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TEMPLATES).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  <div>
                    <span className="font-medium">{v.label}</span>
                    <span className="text-muted-foreground ml-1">— {v.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generatePDF} disabled={generating} size="sm" className="gap-2 rounded-xl">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isPt ? "Baixar PDF" : "Download PDF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
