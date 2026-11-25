import { CERTAINTY_LABEL, CERTAINTY_SYMBOL, certaintyOf, downgradeReasons, type GradeEntry } from "./grade";
import { TOOLS, type ToolId } from "./appraisal";
import { reasonsFor } from "./screening";
import type { Data, FieldSpec } from "./extraction";

export interface Table { head: string[]; rows: string[][] }
export interface Figure { title: string; svg: string }

export interface StudyRow { id: string; title: string; authors: string[]; year: number | null; country?: string | null }
export interface AppraisalInput { record_id: string; tool: ToolId; domains: Record<string, { judgement: string }>; overall: string | null }
export interface SearchInput { source: string; method: string; interface: string | null; query: string; run_at: string; results_count: number | null; imported_count: number; filters: Record<string, unknown> }
export interface Theme { id: string; name: string; description?: string }

export interface Ctx {
  locale: "pt" | "en";
  reviewType: string;
  studies: StudyRow[];
  fields: FieldSpec[];
  extraction: Map<string, Data>;
  appraisals: AppraisalInput[];
  searches: SearchInput[];
  sourceLabel: (id: string) => string;
  excluded: { id: string; title: string; authors: string[]; year: number | null; reason: string | null }[];
  themes: Theme[];
  assign: Record<string, string[]>;
  grade: GradeEntry[];
}

// ───────── helpers ─────────

/** Text that ends up inside SVG markup comes from papers and users, so it is always escaped. */
export const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function studyLabel(s: Pick<StudyRow, "authors" | "year" | "title">): string {
  const first = s.authors[0]?.split(",")[0]?.trim();
  const name = first ? (s.authors.length > 1 ? `${first} et al.` : first) : cut(s.title, 30);
  return `${name}${s.year ? ` (${s.year})` : ""}`;
}

/** CSV with a guard against spreadsheet formulas: cells that start with = + - @ are prefixed with a quote. */
export function toCsv(t: Table): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return "﻿" + [t.head, ...t.rows].map((r) => r.map(cell).join(",")).join("\n");
}

// ───────── tables ─────────

export function searchAppendix(c: Ctx): Table {
  const pt = c.locale === "pt";
  return {
    head: [pt ? "Base" : "Source", pt ? "Método" : "Method", pt ? "Interface" : "Interface", pt ? "Data da busca" : "Search date", pt ? "Estratégia" : "Strategy", pt ? "Resultados" : "Results", pt ? "Importados" : "Imported"],
    rows: c.searches.map((s) => [c.sourceLabel(s.source), s.method, s.interface ?? "", new Date(s.run_at).toISOString().slice(0, 10), s.query, s.results_count?.toString() ?? "", String(s.imported_count)]),
  };
}

/** Characteristics / charting table: one row per included study, one column per extraction field. */
export function extractionTable(c: Ctx): Table {
  const pt = c.locale === "pt";
  return {
    head: [pt ? "Estudo" : "Study", ...c.fields.map((f) => f.label)],
    rows: c.studies.map((s) => [studyLabel(s), ...c.fields.map((f) => c.extraction.get(s.id)?.[f.key] ?? "")]),
  };
}

export function excludedFullText(c: Ctx): Table {
  const pt = c.locale === "pt";
  const reasons = new Map(reasonsFor(c.reviewType).map((r) => [r.code, r.label[c.locale]]));
  return {
    head: [pt ? "Estudo" : "Study", pt ? "Título" : "Title", pt ? "Motivo da exclusão" : "Reason for exclusion"],
    rows: c.excluded.map((e) => [studyLabel(e), e.title, reasons.get(e.reason ?? "other") ?? e.reason ?? ""]),
  };
}

export function synthesisMatrix(c: Ctx): Table {
  const pt = c.locale === "pt";
  const findingKey = c.fields.find((f) => f.key === "findings" || f.key === "key_findings")?.key;
  return {
    head: [pt ? "Estudo" : "Study", ...c.themes.map((t) => t.name), ...(findingKey ? [pt ? "Principais achados" : "Main findings"] : [])],
    rows: c.studies.map((s) => [studyLabel(s), ...c.themes.map((t) => (c.assign[s.id]?.includes(t.id) ? "●" : "")), ...(findingKey ? [c.extraction.get(s.id)?.[findingKey] ?? ""] : [])]),
  };
}

/** Counts by study method and level of evidence (integrative reviews). */
export function methodEvidence(c: Ctx): Table {
  const pt = c.locale === "pt";
  const groups = new Map<string, { method: string; level: string; ids: string[] }>();
  for (const s of c.studies) {
    const d = c.extraction.get(s.id) ?? {};
    const method = d.method || (pt ? "não informado" : "not stated"), level = d.evidence_level || (pt ? "não informado" : "not stated");
    const k = `${method}|${level}`;
    (groups.get(k) ?? groups.set(k, { method, level, ids: [] }).get(k)!).ids.push(s.id);
  }
  return {
    head: [pt ? "Método" : "Method", pt ? "Nível de evidência" : "Level of evidence", "n", pt ? "Estudos" : "Studies"],
    rows: [...groups.values()].sort((a, b) => b.ids.length - a.ids.length).map((g) => [g.method, g.level, String(g.ids.length), g.ids.map((id) => studyLabel(c.studies.find((s) => s.id === id)!)).join("; ")]),
  };
}

export function summaryOfFindings(c: Ctx): Table {
  const pt = c.locale === "pt";
  return {
    head: [pt ? "Desfecho" : "Outcome", pt ? "Nº de estudos" : "No. of studies", pt ? "Desenho" : "Design", pt ? "Efeito" : "Effect", pt ? "Certeza (GRADE)" : "Certainty (GRADE)", pt ? "Motivos para rebaixar" : "Reasons for downgrading", pt ? "Comentários" : "Comments"],
    rows: c.grade.filter((g) => g.outcome.trim()).map((g) => {
      const cert = certaintyOf(g);
      return [g.outcome, g.studies?.toString() ?? "", g.design === "rct" ? (pt ? "Ensaios randomizados" : "Randomised trials") : (pt ? "Observacionais" : "Observational"), g.effect,
        cert ? `${CERTAINTY_SYMBOL[cert]} ${CERTAINTY_LABEL[cert][c.locale]}` : (pt ? "não classificado" : "not rated"), downgradeReasons(g, c.locale).join("; "), g.notes];
    }),
  };
}

// ───────── figures (self-contained SVG, white background so they paste into a manuscript) ─────────

const SANS = "font-family=\"Inter, Arial, sans-serif\"";
const wrap = (w: number, h: number, body: string, title: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>`;

const ROB_STYLE: Record<string, { fill: string; sym: string; pt: string; en: string }> = {
  low: { fill: "#2e9e5b", sym: "+", pt: "Baixo risco", en: "Low risk" },
  some: { fill: "#e0a800", sym: "?", pt: "Algumas preocupações", en: "Some concerns" },
  moderate: { fill: "#e0a800", sym: "−", pt: "Moderado", en: "Moderate" },
  high: { fill: "#d0392e", sym: "−", pt: "Alto risco", en: "High risk" },
  serious: { fill: "#d0392e", sym: "−", pt: "Sério", en: "Serious" },
  critical: { fill: "#8f1d14", sym: "×", pt: "Crítico", en: "Critical" },
  unclear: { fill: "#8a8f98", sym: "?", pt: "Incerto", en: "Unclear" },
  ni: { fill: "#8a8f98", sym: "?", pt: "Sem informação", en: "No information" },
  star: { fill: "#2e9e5b", sym: "★", pt: "Atende", en: "Met" },
  none: { fill: "#8a8f98", sym: "○", pt: "Não atende", en: "Not met" },
};

/** Traffic-light plot per tool. Each judgement is a colour and a symbol, so it still reads in greyscale. */
export function robTrafficLight(c: Ctx): Figure[] {
  const pt = c.locale === "pt";
  const out: Figure[] = [];
  const byTool = new Map<ToolId, AppraisalInput[]>();
  for (const a of c.appraisals) if (TOOLS[a.tool].overall !== "none") (byTool.get(a.tool) ?? byTool.set(a.tool, []).get(a.tool)!).push(a);
  for (const [tool, rows] of byTool) {
    const spec = TOOLS[tool];
    const colW = 44, rowH = 30, left = 200, top = 70;
    const cols = [...spec.items.map((i) => i.key), ...(spec.overall === "judgement" ? ["overall"] : [])];
    const W = left + cols.length * colW + 30, H = top + rows.length * rowH + 70;
    let body = `<text x="10" y="24" ${SANS} font-size="14" font-weight="700" fill="#1e293b">${esc(spec.name)} — ${esc(pt ? "julgamento por domínio" : "judgement by domain")}</text>`;
    cols.forEach((k, i) => {
      const label = k === "overall" ? (pt ? "Geral" : "Overall") : k;
      body += `<text x="${left + i * colW + colW / 2}" y="${top - 12}" text-anchor="middle" ${SANS} font-size="11" fill="#475569">${esc(label)}</text>`;
    });
    rows.forEach((r, ri) => {
      const st = c.studies.find((s) => s.id === r.record_id);
      const y = top + ri * rowH;
      body += `<text x="${left - 10}" y="${y + 19}" text-anchor="end" ${SANS} font-size="12" fill="#1e293b">${esc(cut(st ? studyLabel(st) : "—", 30))}</text>`;
      cols.forEach((k, i) => {
        const v = k === "overall" ? r.overall : r.domains[k]?.judgement;
        const s = v ? ROB_STYLE[v] : null;
        const cx = left + i * colW + colW / 2, cy = y + 14;
        body += s
          ? `<circle cx="${cx}" cy="${cy}" r="10" fill="${s.fill}"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" ${SANS} font-size="12" font-weight="700" fill="#ffffff">${esc(s.sym)}</text>`
          : `<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#cbd5e1"/>`;
      });
    });
    const used = [...new Set(rows.flatMap((r) => [...Object.values(r.domains).map((d) => d.judgement), r.overall ?? ""]).filter((v) => v && ROB_STYLE[v]))];
    let lx = 10; const ly = top + rows.length * rowH + 28;
    for (const v of used) {
      const s = ROB_STYLE[v];
      body += `<circle cx="${lx + 8}" cy="${ly}" r="8" fill="${s.fill}"/><text x="${lx + 8}" y="${ly + 4}" text-anchor="middle" ${SANS} font-size="10" font-weight="700" fill="#ffffff">${esc(s.sym)}</text><text x="${lx + 22}" y="${ly + 4}" ${SANS} font-size="11" fill="#334155">${esc(pt ? s.pt : s.en)}</text>`;
      lx += 36 + (pt ? s.pt : s.en).length * 6.2;
    }
    const domainLegend = spec.items.map((i) => `${i.key} ${i.label[c.locale]}`).join(" · ");
    body += `<text x="10" y="${H - 14}" ${SANS} font-size="10" fill="#64748b">${esc(cut(domainLegend, 150))}</text>`;
    out.push({ title: `${spec.name}`, svg: wrap(W, H, body, `${spec.name}`) });
  }
  return out;
}

export function barChart(title: string, items: { label: string; n: number }[], emptyText: string): string {
  const data = items.slice(0, 15);
  if (data.length === 0) return wrap(420, 80, `<text x="10" y="40" ${SANS} font-size="12" fill="#64748b">${esc(emptyText)}</text>`, title);
  const max = Math.max(...data.map((d) => d.n));
  const left = 150, W = 560, rowH = 24, H = 50 + data.length * rowH;
  let body = `<text x="10" y="24" ${SANS} font-size="14" font-weight="700" fill="#1e293b">${esc(title)}</text>`;
  data.forEach((d, i) => {
    const y = 40 + i * rowH, w = Math.max(2, (d.n / max) * (W - left - 60));
    body += `<text x="${left - 8}" y="${y + 15}" text-anchor="end" ${SANS} font-size="11" fill="#334155">${esc(cut(d.label, 24))}</text><rect x="${left}" y="${y + 3}" width="${w}" height="16" rx="2" fill="#3b6fd4"/><text x="${left + w + 6}" y="${y + 15}" ${SANS} font-size="11" fill="#1e293b">${d.n}</text>`;
  });
  return wrap(W, H, body, title);
}

const tally = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].map(([label, n]) => ({ label, n }));

export function distribution(c: Ctx): Figure[] {
  const pt = c.locale === "pt";
  const empty = pt ? "Sem dados para este gráfico." : "No data for this chart.";
  const years = tally(c.studies.filter((s) => s.year).map((s) => String(s.year))).sort((a, b) => a.label.localeCompare(b.label));
  const figs: Figure[] = [{ title: pt ? "Estudos por ano" : "Studies by year", svg: barChart(pt ? "Estudos por ano de publicação" : "Studies by publication year", years, empty) }];
  const field = (keys: string[]) => keys.find((k) => c.fields.some((f) => f.key === k));
  for (const [keys, title] of [[["country"], pt ? "Estudos por país" : "Studies by country"], [["design", "method"], pt ? "Estudos por desenho" : "Studies by design"]] as const) {
    const k = field([...keys]);
    if (!k) continue;
    const vals = c.studies.map((s) => (c.extraction.get(s.id)?.[k] ?? "").trim()).filter((v) => v && v !== "N/R");
    figs.push({ title, svg: barChart(title, tally(vals).sort((a, b) => b.n - a.n), empty) });
  }
  return figs;
}

/** First value of a free-text field, lowercased, so "Adults; elderly" and "adults" land in one bucket. */
const bucket = (v: string | undefined) => (v ?? "").split(/[;,\n]/)[0].trim().toLowerCase();

/** Bubble grid: how many studies fall in each pair of values of two extracted fields. */
export function evidenceMap(c: Ctx, rowKey: string, colKey: string): Figure {
  const pt = c.locale === "pt";
  const lab = (k: string) => c.fields.find((f) => f.key === k)?.label ?? k;
  const title = pt ? `Mapa de evidências: ${lab(rowKey)} × ${lab(colKey)}` : `Evidence map: ${lab(rowKey)} × ${lab(colKey)}`;
  const cells = new Map<string, number>(); const rows = new Map<string, number>(); const cols = new Map<string, number>();
  for (const s of c.studies) {
    const d = c.extraction.get(s.id); const r = bucket(d?.[rowKey]), k = bucket(d?.[colKey]);
    if (!r || !k || r === "n/r" || k === "n/r") continue;
    cells.set(`${r}|${k}`, (cells.get(`${r}|${k}`) ?? 0) + 1); rows.set(r, (rows.get(r) ?? 0) + 1); cols.set(k, (cols.get(k) ?? 0) + 1);
  }
  const R = [...rows].sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0]), K = [...cols].sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0]);
  if (!R.length || !K.length) return { title, svg: wrap(420, 80, `<text x="10" y="40" ${SANS} font-size="12" fill="#64748b">${esc(pt ? "Preencha estes campos na extração para gerar o mapa." : "Fill in these fields during extraction to build the map.")}</text>`, title) };
  const cell = 46, left = 180, top = 120, W = left + K.length * cell + 20, H = top + R.length * cell + 20;
  const max = Math.max(...cells.values());
  let body = `<text x="10" y="24" ${SANS} font-size="14" font-weight="700" fill="#1e293b">${esc(title)}</text>`;
  K.forEach((k, i) => { body += `<text transform="translate(${left + i * cell + cell / 2},${top - 8}) rotate(-45)" ${SANS} font-size="11" fill="#334155">${esc(cut(k, 22))}</text>`; });
  R.forEach((r, ri) => {
    const y = top + ri * cell;
    body += `<text x="${left - 8}" y="${y + cell / 2 + 4}" text-anchor="end" ${SANS} font-size="11" fill="#334155">${esc(cut(r, 26))}</text>`;
    K.forEach((k, i) => {
      const n = cells.get(`${r}|${k}`) ?? 0;
      const cx = left + i * cell + cell / 2, cy = y + cell / 2;
      body += `<rect x="${left + i * cell}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="#e2e8f0"/>`;
      if (n) body += `<circle cx="${cx}" cy="${cy}" r="${6 + (n / max) * 14}" fill="#3b6fd4" fill-opacity="0.75"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" ${SANS} font-size="11" font-weight="700" fill="#ffffff">${n}</text>`;
    });
  });
  return { title, svg: wrap(W, H, body, title) };
}

export function themePrevalence(c: Ctx): Figure {
  const pt = c.locale === "pt";
  const title = pt ? "Estudos por tema" : "Studies per theme";
  const items = c.themes.map((t) => ({ label: t.name, n: c.studies.filter((s) => c.assign[s.id]?.includes(t.id)).length })).sort((a, b) => b.n - a.n);
  return { title, svg: barChart(title, items, pt ? "Defina temas e atribua estudos." : "Define themes and assign studies.") };
}

/** Candidate categorical fields for an evidence map (free-text or choice fields only). */
export const mappableFields = (fields: FieldSpec[]) => fields.filter((f) => f.kind === "text" || f.kind === "choice");

/** PRISMA 2020 style flow diagram as standalone SVG, for the manuscript export (the on-screen one is a React component). */
export function prismaFlowSvg(c: { identified: number; duplicatesRemoved: number; screened: number; excludedScreening: number; includedFullText: number; excludedFullText: number; finalIncluded: number; excludedReasons: Record<string, number> }, reasonLabels: Record<string, string>, locale: "pt" | "en"): Figure {
  const pt = locale === "pt";
  const title = pt ? "Fluxograma de seleção dos estudos" : "Study selection flow diagram";
  const box = (x: number, y: number, w: number, h: number, lines: string[], fill = "#eef2f7") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="#64748b"/>` + lines.map((l, i) => `<text x="${x + w / 2}" y="${y + 20 + i * 16}" text-anchor="middle" ${SANS} font-size="12" fill="#1e293b">${esc(l)}</text>`).join("");
  const arrow = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="1.5" marker-end="url(#a)"/>`;
  const reasons = Object.entries(c.excludedReasons).slice(0, 6).map(([k, n]) => `${cut(reasonLabels[k] ?? k, 34)}: ${n}`);
  const W = 640, mainX = 40, mainW = 240, sideX = 340, sideW = 260;
  const sideH = Math.max(50, 34 + reasons.length * 16);
  let body = `<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#64748b"/></marker></defs>`
    + `<text x="${W / 2}" y="22" text-anchor="middle" ${SANS} font-size="14" font-weight="700" fill="#1e293b">${esc(title)}</text>`;
  body += box(mainX, 40, mainW, 50, [pt ? "Registros identificados" : "Records identified", `n = ${c.identified}`]);
  body += arrow(mainX + mainW / 2, 90, mainX + mainW / 2, 130) + box(sideX, 40, sideW, 50, [pt ? "Duplicatas removidas" : "Duplicates removed", `n = ${c.duplicatesRemoved}`]) + arrow(mainX + mainW, 65, sideX, 65);
  body += box(mainX, 130, mainW, 50, [pt ? "Registros triados (título e resumo)" : "Records screened", `n = ${c.screened}`]);
  body += arrow(mainX + mainW / 2, 180, mainX + mainW / 2, 230) + box(sideX, 130, sideW, 50, [pt ? "Excluídos na triagem" : "Excluded at screening", `n = ${c.excludedScreening}`]) + arrow(mainX + mainW, 155, sideX, 155);
  body += box(mainX, 230, mainW, 50, [pt ? "Avaliados em texto completo" : "Assessed in full text", `n = ${c.includedFullText}`]);
  body += arrow(mainX + mainW / 2, 280, mainX + mainW / 2, 270 + Math.max(sideH, 50) + 40) + box(sideX, 230, sideW, sideH, [`${pt ? "Excluídos no texto completo" : "Excluded at full text"}: ${c.excludedFullText}`, ...reasons], "#fff5f5") + arrow(mainX + mainW, 255, sideX, 255);
  const finalY = 270 + Math.max(sideH, 50) + 40;
  body += box(mainX, finalY, mainW, 50, [pt ? "Estudos incluídos na revisão" : "Studies included in the review", `n = ${c.finalIncluded}`], "#edf7f0");
  return { title, svg: wrap(W, finalY + 70, body, title) };
}
