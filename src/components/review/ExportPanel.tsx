import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { amstarSummary, cmoTable, distribution, excludedFullText, extractionTable, overlapMatrix, prismaFlowSvg, robTrafficLight, searchAppendix, shortcutsTable, summaryOfFindings, type Ctx, type Figure, type Table } from "@/lib/review/artifacts";
import { buildDocx } from "@/lib/review/docx";
import { composeManuscript, type ExportFigure } from "@/lib/review/exportManuscript";
import type { WritingData } from "@/lib/review/factsInput";
import type { Manuscript, WritingState } from "@/lib/review/manuscript";
import type { ReviewRecord } from "@/lib/review/protocol";
import { svgToPngBytes } from "@/lib/review/svgPng";
import { createEditorDocument } from "@/lib/review/writeApi";
import type { ReviewTypeDef } from "@/lib/review/types";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  userId: string;
  data: WritingData;
  manuscript: Manuscript;
  state: WritingState;
  locale: "pt" | "en";
  onChange: (next: WritingState) => void;
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileName = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "revisao";

export function ExportPanel({ def, review, userId, data, manuscript, state, locale, onChange }: Props) {
  const pt = locale === "pt";
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"docx" | "md" | "editor" | null>(null);
  const citeStyle = state.citeStyle ?? "author-year";
  const input = data.input;

  const compose = async (withFigures: boolean) => {
    const ctx: Ctx = {
      locale, reviewType: def.id, fields: input.fields, studies: input.studies.map((s) => ({ id: s.id, title: s.title, authors: s.authors, year: s.year })),
      extraction: input.extraction, appraisals: input.appraisals, searches: input.searches.map((s) => ({ source: s.source, method: s.method, interface: null, query: s.query, run_at: s.run_at, results_count: s.results_count, imported_count: s.imported_count, filters: {} })),
      sourceLabel: (id) => input.searches.find((s) => s.source === id)?.label ?? id, excluded: data.excluded, themes: input.themes, assign: input.assign, grade: input.grade, cmo: input.cmo, shortcuts: input.shortcuts,
    };
    const tables: { title: string; table: Table }[] = [
      { title: pt ? "Estratégias de busca por fonte" : "Search strategies by source", table: searchAppendix(ctx) },
      { title: pt ? "Características dos estudos incluídos" : "Characteristics of included studies", table: extractionTable(ctx) },
      ...(data.excluded.length ? [{ title: pt ? "Estudos excluídos no texto completo, com motivo" : "Studies excluded at full text, with reason", table: excludedFullText(ctx) }] : []),
      ...(def.id === "rapid" ? [{ title: pt ? "Atalhos metodológicos declarados" : "Declared methodological shortcuts", table: shortcutsTable(ctx) }] : []),
      ...(def.id === "umbrella" ? [{ title: pt ? "Qualidade das revisões (AMSTAR 2)" : "Quality of the reviews (AMSTAR 2)", table: amstarSummary(ctx) }, { title: pt ? "Matriz de sobreposição de estudos primários" : "Overlap matrix of primary studies", table: overlapMatrix(ctx) }] : []),
      ...(def.id === "realist" ? [{ title: pt ? "Configurações contexto-mecanismo-resultado" : "Context-mechanism-outcome configurations", table: cmoTable(ctx) }] : []),
      ...(input.grade.length ? [{ title: pt ? "Resumo dos achados e certeza da evidência (GRADE)" : "Summary of findings and certainty of evidence (GRADE)", table: summaryOfFindings(ctx) }] : []),
    ];
    const figs: ExportFigure[] = [];
    if (withFigures) {
      const list: Figure[] = [prismaFlowSvg(input.prisma, input.reasonLabels, locale), ...robTrafficLight(ctx), ...distribution(ctx).slice(0, 1)];
      for (const f of list) { try { const p = await svgToPngBytes(f.svg); figs.push({ title: f.title, ...p }); } catch (e) { console.error("figure skipped", f.title, e); } }
    }
    return composeManuscript({ locale, title: review.title, manuscript, state, studies: input.studies, refExtra: Object.fromEntries(data.records.map((r) => [r.id, { journal: r.journal, doi: r.doi }])), citeStyle, tables, figures: figs });
  };

  const run = async (kind: "docx" | "md" | "editor") => {
    setBusy(kind);
    try {
      const c = await compose(kind === "docx");
      const base = fileName(review.title);
      if (kind === "docx") save(new Blob([await buildDocx(c.blocks)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `${base}.docx`);
      else if (kind === "md") save(new Blob([c.markdown], { type: "text/markdown;charset=utf-8" }), `${base}.md`);
      else { const id = await createEditorDocument(userId, review.title || "Revisão", c.html, review.research_project_id); navigate(`/writing?docId=${id}`); }
    } catch (e) { console.error(e); toast.error(pt ? "Não foi possível exportar." : "Could not export."); }
    finally { setBusy(null); }
  };

  const total = manuscript.sections.length;
  const approved = manuscript.sections.filter((s) => state.sections?.[s.key]?.approved).length;
  const preview = composeManuscript({ locale, title: review.title, manuscript, state, studies: input.studies, refExtra: {}, citeStyle, tables: [], figures: [] });

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-lg border border-border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">{approved === total ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> : <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />}{approved} / {total} {pt ? "seções aprovadas" : "sections approved"}</p>
        {preview.warnings.length > 0 && <ul className="max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-muted-foreground">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        <p className="text-xs text-muted-foreground">{pt ? "Você pode exportar com pendências; elas ficam como lembrete aqui e os campos entre colchetes aparecem no arquivo." : "You can export with open items; they stay listed here and bracketed fields appear in the file."}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="cite-style" className="text-sm font-medium">{pt ? "Estilo de citação" : "Citation style"}</label>
        <select id="cite-style" value={citeStyle} onChange={(e) => onChange({ ...state, citeStyle: e.target.value as "author-year" | "numbered" })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="author-year">{pt ? "Autor, ano" : "Author, year"}</option><option value="numbered">{pt ? "Numérico (ordem de citação)" : "Numbered (citation order)"}</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="gap-2" disabled={busy !== null} onClick={() => run("docx")}>{busy === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{pt ? "Baixar .docx (Word)" : "Download .docx (Word)"}</Button>
        <Button variant="outline" className="gap-2" disabled={busy !== null} onClick={() => run("md")}><FileText className="h-4 w-4" />{pt ? "Baixar Markdown" : "Download Markdown"}</Button>
        <Button variant="outline" className="gap-2" disabled={busy !== null} onClick={() => run("editor")}>{busy === "editor" && <Loader2 className="h-4 w-4 animate-spin" />}{pt ? "Abrir no editor de escrita" : "Open in the writing editor"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{pt ? "O .docx traz o texto, as referências, os apêndices em tabela e as figuras (fluxograma, risco de viés e distribuição por ano). No editor de escrita você continua com versões e revisão colaborativa." : "The .docx has the text, references, appendix tables and figures (flow diagram, risk of bias and distribution by year). In the writing editor you continue with versions and collaborative review."}</p>
      <p className="rounded-md bg-muted/40 p-3 text-xs">{pt ? "Antes de submeter: relatar tudo o que o guia pede não garante a qualidade da revisão, e a responsabilidade pelo conteúdo é dos autores. Confira os números e as citações, e confirme a declaração de uso de IA." : "Before submitting: reporting everything the guideline asks for does not guarantee review quality, and the authors are responsible for the content. Check the numbers and citations, and confirm the AI-use statement."}</p>
    </div>
  );
}
