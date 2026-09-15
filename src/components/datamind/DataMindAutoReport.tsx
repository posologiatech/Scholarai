import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Message, DataMindFile } from "@/pages/DataMind";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2, PenLine } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { linkResource } from "@/lib/research/integrations";
import { Finding } from "@/lib/datamind/findings";
import {
  FindingsTable,
  ReportSection,
  buildArticleHtml,
  extractSections,
  findingsTable,
} from "@/lib/datamind/report";

/** jsPDF-autotable writes where the table ended back onto the document. */
type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

interface Props {
  messages: Message[];
  files: DataMindFile[];
  conversationTitle?: string;
  /** The automatic findings of this conversation, read from storage — never rescanned. */
  findings?: Finding[];
}

function generatePDF(
  sections: ReportSection[],
  title: string,
  author: string,
  date: string,
  findings: FindingsTable | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // Title page
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, pageWidth / 2, 80, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(author, pageWidth / 2, 100, { align: "center" });
  doc.text(date, pageWidth / 2, 108, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Relatório gerado automaticamente pelo DataMind - ARCA Research", pageWidth / 2, 130, { align: "center" });
  doc.setTextColor(0);

  doc.addPage();
  y = margin;

  // TOC heading
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Sumário", margin, y);
  y += 10;

  // Build TOC from sections
  let sectionNum = 0;
  const tocEntries: { title: string; page: number }[] = [];

  // Count sections for TOC
  for (const section of sections) {
    if (section.type === "text" && section.content.length > 20) {
      sectionNum++;
      tocEntries.push({ title: `Seção ${sectionNum}: Análise`, page: 0 });
    }
    if (section.type === "table") {
      tocEntries.push({ title: section.title || `Tabela ${section.tableNumber}`, page: 0 });
    }
    if (section.type === "figure") {
      tocEntries.push({ title: `Figura ${section.figureNumber}`, page: 0 });
    }
  }
  if (findings) tocEntries.push({ title: "Achados automáticos", page: 0 });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const entry of tocEntries.slice(0, 20)) {
    doc.text(`• ${entry.title}`, margin + 5, y);
    y += 5;
  }

  doc.addPage();
  y = margin;

  // Content
  sectionNum = 0;
  for (const section of sections) {
    if (section.type === "text") {
      addPageIfNeeded(15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(section.content, contentWidth);
      for (const line of lines) {
        addPageIfNeeded(5);
        doc.text(line, margin, y);
        y += 5;
      }
      y += 3;
    }

    if (section.type === "code") {
      addPageIfNeeded(20);
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.setFillColor(245, 245, 245);
      const codeLines = doc.splitTextToSize(section.content, contentWidth - 10);
      const codeHeight = codeLines.length * 4 + 6;
      addPageIfNeeded(codeHeight);
      doc.rect(margin, y - 2, contentWidth, codeHeight, "F");
      for (const line of codeLines) {
        addPageIfNeeded(4);
        doc.text(line, margin + 5, y + 2);
        y += 4;
      }
      y += 6;
      doc.setFont("helvetica", "normal");
    }

    if (section.type === "table" && section.headers && section.rows) {
      addPageIfNeeded(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(section.title || "", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [section.headers],
        body: section.rows.slice(0, 50),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      y = (doc as AutoTableDoc).lastAutoTable?.finalY + 8 || y + 20;
      if (section.rows.length > 50) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100);
        doc.text(`(Mostrando 50 de ${section.rows.length} linhas)`, margin, y);
        doc.setTextColor(0);
        y += 6;
      }
    }

    if (section.type === "figure" && section.imageData) {
      addPageIfNeeded(100);
      try {
        const imgWidth = contentWidth * 0.85;
        const imgHeight = imgWidth * 0.6;
        addPageIfNeeded(imgHeight + 15);
        const x = margin + (contentWidth - imgWidth) / 2;
        doc.addImage(section.imageData, "PNG", x, y, imgWidth, imgHeight);
        y += imgHeight + 4;
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(80);
        doc.text(section.title || "", pageWidth / 2, y, { align: "center" });
        doc.setTextColor(0);
        y += 8;
      } catch {
        // Skip broken images
      }
    }
  }

  // Automatic findings — the correction and the effect size travel with them, so
  // the report never states a screened lead as firmly as a tested hypothesis.
  if (findings) {
    doc.addPage();
    y = margin;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Achados automáticos", margin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [findings.headers],
      body: findings.rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as AutoTableDoc).lastAutoTable?.finalY + 8 || y + 20;

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80);
    for (const note of findings.notes) {
      const lines = doc.splitTextToSize(`• ${note}`, contentWidth);
      for (const line of lines) {
        addPageIfNeeded(4);
        doc.text(line, margin, y);
        y += 4;
      }
      y += 1;
    }
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${i} / ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  }

  return doc;
}

const DataMindAutoReport = ({ messages, files, conversationTitle, findings = [] }: Props) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(conversationTitle || "Relatório de Análise de Dados");
  const [author, setAuthor] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const { activeProjectId } = useActiveProject();
  const navigate = useNavigate();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const sections = extractSections(messages);
      const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const doc = generatePDF(sections, title, author || "Pesquisador", date, findingsTable(findings));

      const filename = title.replace(/[^a-zA-Z0-9À-ÿ\s]/g, "").replace(/\s+/g, "_").slice(0, 50);
      doc.save(`${filename}.pdf`);

      toast({ title: "Relatório gerado!", description: `${filename}.pdf salvo com sucesso.` });
      setOpen(false);
    } catch (e) {
      console.error("Report generation error:", e);
      toast({ title: "Erro ao gerar relatório", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Writes the same report into the Writing Assistant as an editable document.
   *
   * A new document rather than an append: the researcher may already be writing,
   * and dropping a generated results section into an open manuscript without
   * being asked would be an edit nobody requested. Opening it is one click away.
   */
  const handleSendToWriting = async () => {
    if (!user) return;
    setSending(true);
    try {
      const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const html = buildArticleHtml({
        title,
        author: author || undefined,
        date,
        files,
        sections: extractSections(messages),
        findings,
      });

      const { data, error } = await supabase
        .from("writing_documents")
        .insert({
          user_id: user.id,
          title,
          content: html,
          section: "results",
          research_project_id: activeProjectId,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (activeProjectId && data?.id) {
        await linkResource({
          projectId: activeProjectId,
          resourceType: "writing",
          resourceId: data.id,
          label: title,
        });
      }

      toast({
        title: "Enviado para o Assistente de Escrita",
        description: activeProjectId
          ? "O documento foi criado e vinculado ao projeto ativo."
          : "O documento foi criado. Selecione um projeto ativo para vinculá-lo.",
      });
      setOpen(false);
      if (data?.id) navigate(`/writing?docId=${data.id}`);
    } catch (e) {
      console.error("Send to writing error:", e);
      toast({ title: "Erro ao enviar para o Assistente de Escrita", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sections = extractSections(messages);
  const figCount = sections.filter((s) => s.type === "figure").length;
  const tblCount = sections.filter((s) => s.type === "table").length;
  const reportableFindings = findings.filter((f) => f.kind !== "quality" && !f.dismissed).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
          <FileText className="h-3.5 w-3.5" />
          Auto-Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Relatório Acadêmico
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground mb-2">Conteúdo detectado:</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-foreground font-medium">{sections.filter((s) => s.type === "text").length} seções</span>
              <span className="text-foreground font-medium">{tblCount} tabelas</span>
              <span className="text-foreground font-medium">{figCount} figuras</span>
              {reportableFindings > 0 && (
                <span className="text-foreground font-medium">{reportableFindings} achados automáticos</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Título do Relatório</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Relatório de Análise..." />
          </div>

          <div className="space-y-2">
            <Label>Autor(es)</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nome do pesquisador" />
          </div>

          <Button onClick={handleGenerate} disabled={generating || sending || !title} className="w-full gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar PDF Acadêmico"}
          </Button>

          <Button
            variant="outline"
            onClick={handleSendToWriting}
            disabled={generating || sending || !title || !user}
            className="w-full gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            {sending ? "Enviando..." : "Enviar para o Assistente de Escrita"}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            Formato A4 · Margens acadêmicas · Tabelas e figuras numeradas · Paginação automática
            {reportableFindings > 0 && " · Achados com teste, q (FDR) e tamanho de efeito"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DataMindAutoReport;
