import type { Table } from "./artifacts";
import type { DocBlock } from "./docx";
import { esc } from "./artifacts";
import { referenceList, renderCitations, type StudyFact } from "./facts";
import type { CiteStyle, Manuscript, SectionDef, WritingState } from "./manuscript";

export interface ExportFigure { title: string; png: Uint8Array; width: number; height: number }

export interface ExportInput {
  locale: "pt" | "en";
  title: string;
  manuscript: Manuscript;
  state: WritingState;
  studies: StudyFact[];
  refExtra: Record<string, { journal?: string | null; doi?: string | null }>;
  citeStyle: CiteStyle;
  tables: { title: string; table: Table }[];
  figures: ExportFigure[];
}

export interface Composed { blocks: DocBlock[]; markdown: string; html: string; warnings: string[]; references: string[] }

const PART_TITLE: Record<SectionDef["part"], Record<"pt" | "en", string>> = {
  title: { pt: "", en: "" }, abstract: { pt: "Resumo", en: "Abstract" }, introduction: { pt: "Introdução", en: "Introduction" },
  methods: { pt: "Métodos", en: "Methods" }, results: { pt: "Resultados", en: "Results" }, discussion: { pt: "Discussão", en: "Discussion" }, other: { pt: "Outras informações", en: "Other information" },
};

/** Placeholders the author still has to fill, such as "[informar]" or "[Nenhuma busca registrada ainda.]". */
export const placeholders = (text: string): string[] => (text.match(/\[(?!S\d)[^\]\n]{2,80}\]/g) ?? []);

export function composeManuscript(inp: ExportInput): Composed {
  const pt = inp.locale === "pt";
  const warnings: string[] = [];
  const order: string[] = [];
  const blocks: DocBlock[] = [];
  const md: string[] = [];
  const html: string[] = [];
  const text = (key: string) => inp.state.sections?.[key]?.text?.trim() ?? "";
  const titleText = text("title") || inp.title;

  blocks.push({ type: "title", text: titleText }); md.push(`# ${titleText}\n`); html.push(`<h1>${esc(titleText)}</h1>`);
  let lastPart = "";
  for (const sec of inp.manuscript.sections) {
    if (sec.key === "title") continue;
    const st = inp.state.sections?.[sec.key];
    const body = st?.text?.trim() ?? "";
    const label = sec.title[inp.locale];
    if (!body) warnings.push(pt ? `Seção sem texto: ${label}` : `Section has no text: ${label}`);
    else {
      if (!st?.approved) warnings.push(pt ? `Seção não aprovada: ${label}` : `Section not approved: ${label}`);
      if (st?.issues?.length) warnings.push(pt ? `Seção com pontos a conferir: ${label} (${st.issues.length})` : `Section with items to check: ${label} (${st.issues.length})`);
      const ph = placeholders(body);
      if (ph.length) warnings.push(pt ? `Campos ainda por preencher em ${label}: ${ph.slice(0, 3).join(" ")}` : `Unfilled placeholders in ${label}: ${ph.slice(0, 3).join(" ")}`);
    }
    const part = sec.part;
    const partTitle = PART_TITLE[part][inp.locale];
    if (part !== lastPart && partTitle) { blocks.push({ type: "h1", text: partTitle }); md.push(`\n## ${partTitle}\n`); html.push(`<h2>${esc(partTitle)}</h2>`); lastPart = part; }
    // The abstract is the part heading itself; other sections get a sub-heading.
    if (part !== "abstract") { blocks.push({ type: "h2", text: label }); md.push(`\n### ${label}\n`); html.push(`<h3>${esc(label)}</h3>`); }
    const rendered = renderCitations(body, inp.studies, inp.citeStyle, order);
    blocks.push({ type: "p", text: rendered }); md.push(rendered);
    for (const line of rendered.split(/\n+/)) if (line.trim()) html.push(`<p>${esc(line)}</p>`);
  }

  const refs = referenceList(inp.studies.filter((s) => inp.citeStyle === "author-year" ? true : order.includes(s.key)), inp.refExtra, inp.citeStyle === "numbered" ? order : null);
  if (refs.length) {
    const head = pt ? "Referências" : "References";
    blocks.push({ type: "h1", text: head }); md.push(`\n## ${head}\n`); html.push(`<h2>${esc(head)}</h2>`);
    for (const r of refs) { blocks.push({ type: "p", text: r }); md.push(r + "\n"); html.push(`<p>${esc(r)}</p>`); }
  }

  if (inp.tables.length || inp.figures.length) {
    blocks.push({ type: "pagebreak" });
    const head = pt ? "Apêndices" : "Appendices";
    blocks.push({ type: "h1", text: head }); md.push(`\n## ${head}\n`); html.push(`<h2>${esc(head)}</h2>`);
  }
  inp.tables.forEach((t, i) => {
    const cap = `${pt ? "Tabela" : "Table"} S${i + 1}. ${t.title}`;
    blocks.push({ type: "caption", text: cap }, { type: "table", head: t.table.head, rows: t.table.rows });
    md.push(`\n**${cap}**\n`, `| ${t.table.head.join(" | ")} |`, `| ${t.table.head.map(() => "---").join(" | ")} |`, ...t.table.rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`));
    html.push(`<p><strong>${esc(cap)}</strong></p><table border="1"><thead><tr>${t.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  });
  inp.figures.forEach((f, i) => {
    const cap = `${pt ? "Figura" : "Figure"} ${i + 1}. ${f.title}`;
    blocks.push({ type: "caption", text: cap }, { type: "image", png: f.png, width: f.width, height: f.height });
    md.push(`\n**${cap}** ${pt ? "(figura no arquivo .docx)" : "(figure in the .docx file)"}\n`);
  });

  return { blocks, markdown: md.join("\n"), html: html.join("\n"), warnings, references: refs };
}
