import { useState } from "react";
import { Copy, Download, Info } from "lucide-react";
import { toast } from "sonner";
import PrismaFlowDiagram from "@/components/app/systematic-review/PrismaFlowDiagram";
import { Button } from "@/components/ui/button";
import {
  distribution, esc, evidenceMap, excludedFullText, extractionTable, mappableFields, methodEvidence, robTrafficLight,
  searchAppendix, summaryOfFindings, synthesisMatrix, themePrevalence, toCsv, type Ctx, type Figure, type Table,
  amstarSummary, cmoTable, overlapMatrix, overlapSummaryText, shortcutsTable,
} from "@/lib/review/artifacts";
import { prismaCounts, reasonsFor, type ScreenStatus } from "@/lib/review/screening";
import type { ReviewTypeDef } from "@/lib/review/types";

interface Props {
  def: ReviewTypeDef;
  ctx: Ctx;
  statusRows: { duplicate_of: string | null; screen_status: ScreenStatus; exclusion_reason_code: string | null }[];
  locale: "pt" | "en";
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function svgToPng(svg: string, name: string) {
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const w = m ? Number(m[1]) : 700, h = m ? Number(m[2]) : 400, scale = 2;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => b && save(b, name), "image/png");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "figura";

function TableView({ title, table, locale }: { title: string; table: Table; locale: "pt" | "en" }) {
  const pt = locale === "pt";
  const copy = async () => {
    const html = `<table border="1" cellpadding="4" style="border-collapse:collapse"><thead><tr>${table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const text = [table.head, ...table.rows].map((r) => r.join("\t")).join("\n");
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      toast.success(pt ? "Tabela copiada. Cole no Word." : "Table copied. Paste into Word.");
    } catch { try { await navigator.clipboard.writeText(text); toast.success(pt ? "Copiada como texto." : "Copied as text."); } catch { toast.error(pt ? "Não foi possível copiar." : "Could not copy."); } }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!table.rows.length} onClick={() => save(new Blob([toCsv(table)], { type: "text/csv;charset=utf-8" }), `${slug(title)}.csv`)}><Download className="h-3.5 w-3.5" />CSV</Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!table.rows.length} onClick={copy}><Copy className="h-3.5 w-3.5" />{pt ? "Copiar para o Word" : "Copy for Word"}</Button>
      </div>
      {table.rows.length === 0 ? <p className="text-sm text-muted-foreground">{pt ? "Sem dados ainda." : "No data yet."}</p> : (
        <div className="max-h-96 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="sticky top-0 bg-muted text-left"><tr>{table.head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-border align-top">{r.map((c, j) => <td key={j} className="max-w-xs break-words px-3 py-2">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FigureView({ fig, locale }: { fig: Figure; locale: "pt" | "en" }) {
  const pt = locale === "pt";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => save(new Blob([fig.svg], { type: "image/svg+xml" }), `${slug(fig.title)}.svg`)}><Download className="h-3.5 w-3.5" />SVG</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => svgToPng(fig.svg, `${slug(fig.title)}.png`)}><Download className="h-3.5 w-3.5" />PNG</Button>
      </div>
      {/* The SVG is built by artifacts.ts, which escapes every piece of paper- or user-supplied text. */}
      <div className="overflow-x-auto rounded-md border border-border bg-white p-2" aria-label={fig.title} dangerouslySetInnerHTML={{ __html: fig.svg }} />
      <p className="sr-only">{pt ? "Figura" : "Figure"}: {fig.title}</p>
    </div>
  );
}

export function ArtifactsPanel({ def, ctx, statusRows, locale }: Props) {
  const pt = locale === "pt";
  const maps = mappableFields(ctx.fields);
  const [rowKey, setRowKey] = useState(maps.find((f) => f.key === "population")?.key ?? maps[0]?.key ?? "");
  const [colKey, setColKey] = useState(maps.find((f) => ["intervention", "concept"].includes(f.key))?.key ?? maps[1]?.key ?? "");
  const reasonLabels = Object.fromEntries(reasonsFor(def.id).map((r) => [r.code, r.label[locale]]));

  const body = (kind: string, label: string) => {
    switch (kind) {
      case "search_appendix": return <TableView title={label} table={searchAppendix(ctx)} locale={locale} />;
      case "characteristics": case "charting": return <TableView title={label} table={extractionTable(ctx)} locale={locale} />;
      case "excluded_fulltext": return <TableView title={label} table={excludedFullText(ctx)} locale={locale} />;
      case "synthesis_matrix": return <TableView title={label} table={synthesisMatrix(ctx)} locale={locale} />;
      case "method_evidence": return <TableView title={label} table={methodEvidence(ctx)} locale={locale} />;
      case "overlap_matrix": return <div className="space-y-2"><p className="text-sm font-medium">{overlapSummaryText(ctx)}</p><TableView title={label} table={overlapMatrix(ctx)} locale={locale} /></div>;
      case "amstar_summary": return <TableView title={label} table={amstarSummary(ctx)} locale={locale} />;
      case "cmo_table": return <TableView title={label} table={cmoTable(ctx)} locale={locale} />;
      case "shortcuts_table": return <TableView title={label} table={shortcutsTable(ctx)} locale={locale} />;
      case "sof_grade": return <TableView title={label} table={summaryOfFindings(ctx)} locale={locale} />;
      case "prisma_flow": case "prisma_flow_scr": {
        const c = prismaCounts(statusRows);
        return <PrismaFlowDiagram identified={c.identified} duplicatesRemoved={c.duplicatesRemoved} screened={c.screened} excludedScreening={c.excludedScreening} includedFullText={c.includedFullText}
          excludedFullText={c.excludedFullText} finalIncluded={c.finalIncluded} excludedReasons={Object.fromEntries(Object.entries(c.excludedReasons).map(([k, v]) => [reasonLabels[k] ?? k, v]))} />;
      }
      case "rob_traffic_light": {
        const figs = robTrafficLight(ctx);
        return figs.length ? <div className="space-y-4">{figs.map((f) => <FigureView key={f.title} fig={f} locale={locale} />)}</div> : <p className="text-sm text-muted-foreground">{pt ? "Conclua avaliações com RoB 2, ROBINS-I, Newcastle-Ottawa ou QUADAS-2 para gerar a figura." : "Complete RoB 2, ROBINS-I, Newcastle-Ottawa or QUADAS-2 appraisals to build the figure."}</p>;
      }
      case "distribution": return <div className="space-y-4">{distribution(ctx).map((f) => <FigureView key={f.title} fig={f} locale={locale} />)}</div>;
      case "evidence_map": return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-xs">
            {([["rows", rowKey, setRowKey, pt ? "Linhas" : "Rows"], ["cols", colKey, setColKey, pt ? "Colunas" : "Columns"]] as const).map(([id, v, set, l]) => (
              <label key={id} className="flex items-center gap-2">{l}<select value={v} onChange={(e) => set(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2">{maps.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
            ))}
          </div>
          {rowKey && colKey ? <FigureView fig={evidenceMap(ctx, rowKey, colKey)} locale={locale} /> : null}
        </div>
      );
      case "theme_map": return <FigureView fig={themePrevalence(ctx)} locale={locale} />;
      default: return (
        <p className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {kind === "forest" || kind === "funnel"
            ? (pt ? "Forest e funnel plot dependem de efeitos numéricos por estudo, que a extração ainda não guarda de forma estruturada. Use o módulo de Meta-análise e anexe a figura ao manuscrito." : "Forest and funnel plots need numeric effects per study, which extraction does not yet store in a structured way. Use the Meta-analysis module and attach its figure to the manuscript.")
            : (pt ? "Esta figura ainda não é gerada automaticamente." : "This figure is not generated automatically yet.")}</p>
      );
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">{pt ? "Tudo aqui é gerado dos dados da revisão e atualiza sozinho quando uma decisão muda. Tabelas saem em CSV ou coladas no Word; figuras em SVG e PNG, com fundo branco." : "Everything here is generated from the review's data and updates by itself when a decision changes. Tables export as CSV or paste into Word; figures as SVG and PNG with a white background."}</p>
      {def.artifacts.map((a) => (
        <section key={a.kind} className="space-y-2" aria-labelledby={`art-${a.kind}`}>
          <h3 id={`art-${a.kind}`} className="text-sm font-semibold">{a.label[locale]} <span className="text-xs font-normal text-muted-foreground">({a.type === "table" ? (pt ? "tabela" : "table") : (pt ? "figura" : "figure")})</span></h3>
          {body(a.kind, a.label[locale])}
        </section>
      ))}
    </div>
  );
}
