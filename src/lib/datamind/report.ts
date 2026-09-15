/**
 * The article-shaped report behind DataMind's export.
 *
 * One model, two destinations: the PDF the researcher downloads and the section
 * written into the Writing Assistant. Both are built here so the document that
 * lands in the manuscript and the file that lands on disk can never say different
 * things about the same analysis.
 *
 * Scope is the whole conversation — several files and several analyses — because
 * that is what a results section reports on. The per-file view is the briefing
 * (see `briefing.ts`).
 */
import { Finding } from "./findings";

/** The fields of a DataMind message this module reads; the page owns the rest. */
export interface ReportMessage {
  role: string;
  content: string;
  code_block?: string | null;
  output_content?: string | null;
}

export interface ReportSection {
  type: "heading" | "text" | "table" | "figure" | "code";
  content: string;
  title?: string;
  headers?: string[];
  rows?: string[][];
  imageData?: string;
  figureNumber?: number;
  tableNumber?: number;
}

/** Findings quoted in the report; beyond this it stops being a results section. */
const MAX_REPORT_FINDINGS = 15;

export function extractSections(messages: ReportMessage[]): ReportSection[] {
  const sections: ReportSection[] = [];
  let figNum = 0;
  let tblNum = 0;

  const assistantMessages = messages.filter((m) => m.role === "assistant");

  for (const msg of assistantMessages) {
    if (msg.content && msg.content.trim()) {
      sections.push({ type: "text", content: msg.content });
    }

    if (msg.code_block) {
      sections.push({ type: "code", content: msg.code_block });
    }

    if (msg.output_content) {
      const parts = msg.output_content.split(/(\[IMG\].*?\[\/IMG\])/);
      for (const part of parts) {
        const imgMatch = part.match(/^\[IMG\](.*?)\[\/IMG\]$/);
        if (imgMatch && imgMatch[1].length > 100) {
          figNum++;
          sections.push({
            type: "figure",
            content: imgMatch[1],
            imageData: imgMatch[1],
            figureNumber: figNum,
            title: `Figura ${figNum}`,
          });
          continue;
        }

        const dtMatch = part.match(/__DATATABLE_START__([\s\S]*?)__DATATABLE_END__/);
        if (dtMatch) {
          try {
            const payload = JSON.parse(dtMatch[1]);
            tblNum++;
            sections.push({
              type: "table",
              content: "",
              headers: payload.columns || [],
              rows: (payload.data || []).map((r: Record<string, unknown>) =>
                (payload.columns || []).map((c: string) => String(r[c] ?? ""))
              ),
              tableNumber: tblNum,
              title: payload.title || `Tabela ${tblNum}`,
            });
          } catch {
            /* ignore */
          }
          continue;
        }

        const text = part.trim();
        if (text && text.split("\n").length >= 2) {
          const lines = text.split("\n").filter((l) => l.trim());
          const headerCandidates = lines[0].split(/\s{2,}/);
          if (headerCandidates.length >= 2) {
            const dataRows = lines.slice(1).map((l) => l.split(/\s{2,}/)).filter((r) => r.length >= 2);
            if (dataRows.length >= 1) {
              tblNum++;
              sections.push({
                type: "table",
                content: text,
                headers: headerCandidates,
                rows: dataRows,
                tableNumber: tblNum,
                title: `Tabela ${tblNum}`,
              });
              continue;
            }
          }
          if (!text.match(/^\[.*\]$/)) {
            sections.push({ type: "text", content: text });
          }
        }
      }
    }
  }

  return sections;
}

export interface FindingsTable {
  headers: string[];
  rows: string[][];
  /** Leads and caveats that belong under the table, not inside it. */
  notes: string[];
}

function fmtP(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value < 0.0001 ? "<0,0001" : value.toFixed(4).replace(".", ",");
}

function fmtEffect(finding: Finding): string {
  if (finding.effect == null || !Number.isFinite(finding.effect)) return "—";
  const magnitude = finding.magnitude ? ` (${finding.magnitude})` : "";
  return `${finding.effectName ? `${finding.effectName} = ` : ""}${finding.effect.toFixed(2).replace(".", ",")}${magnitude}`;
}

/**
 * The automatic findings as a reportable table.
 *
 * The rule that fired, the corrected q and the effect size are columns, not
 * footnotes: a screen that ran hundreds of tests reports its shortlist with the
 * correction attached, or it reports something stronger than what it found.
 */
export function findingsTable(findings: Finding[]): FindingsTable | null {
  const statistical = findings.filter((f) => f.kind !== "quality" && !f.dismissed);
  if (statistical.length === 0) return null;

  const quoted = statistical.slice(0, MAX_REPORT_FINDINGS);

  const rows = quoted.map((finding) => [
    finding.title,
    finding.label || finding.test || "—",
    fmtP(finding.p),
    fmtP(finding.q),
    fmtEffect(finding),
    finding.n != null ? String(finding.n) : "—",
    finding.significant ? "Confirmado" : "Pista",
  ]);

  const notes: string[] = [
    "Achados produzidos por varredura automática: o teste foi escolhido por regra a partir dos pressupostos medidos nos dados, e os p-valores foram corrigidos para múltiplas comparações por Benjamini-Hochberg (coluna q).",
    "Um achado marcado como \"Pista\" não sobreviveu à correção e vale como hipótese a investigar, não como resultado.",
    "Por serem achados exploratórios, não substituem hipóteses declaradas a priori nem ajuste por potenciais fatores de confusão.",
  ];

  for (const finding of quoted) {
    if (finding.negligible) {
      notes.push(`${finding.title}: significativo pelo tamanho da amostra, mas o efeito em si é desprezível.`);
    }
    if (finding.fragile) {
      notes.push(`${finding.title}: frequências esperadas baixas — o p-valor é uma aproximação frágil.`);
    }
    if (finding.because) {
      notes.push(`${finding.title}: regra aplicada — ${finding.because}.`);
    }
  }

  if (statistical.length > quoted.length) {
    notes.push(`${statistical.length - quoted.length} achado(s) adicional(is) não listado(s) nesta tabela.`);
  }

  return {
    headers: ["Achado", "Teste", "p", "q (FDR)", "Tamanho de efeito", "n", "Status"],
    rows,
    notes,
  };
}

/** Data-quality findings, which belong in Métodos rather than in Resultados. */
export function qualityNotes(findings: Finding[]): string[] {
  return findings.filter((f) => f.kind === "quality" && !f.dismissed).map((f) => f.title);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function tableHtml(headers: string[], rows: string[][], caption?: string): string {
  const head = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const cap = caption ? `<p><strong>${escapeHtml(caption)}</strong></p>` : "";
  return `${cap}<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export interface ArticleInput {
  title: string;
  author?: string;
  date: string;
  files: { file_name: string }[];
  sections: ReportSection[];
  findings: Finding[];
  /** How many rows per table survive into the document. */
  maxTableRows?: number;
}

/**
 * The report as HTML for the Writing Assistant.
 *
 * Structured the way a manuscript reads — Métodos, Resultados, Achados
 * automáticos — because the researcher is going to edit it in place, not read it
 * once. Figures come through as inline images so the section is complete on
 * arrival rather than a set of placeholders to chase.
 */
export function buildArticleHtml(input: ArticleInput): string {
  const maxRows = input.maxTableRows ?? 50;
  const parts: string[] = [];

  parts.push(`<h1>${escapeHtml(input.title)}</h1>`);
  const byline = [input.author, input.date].filter(Boolean).join(" · ");
  if (byline) parts.push(`<p><em>${escapeHtml(byline)}</em></p>`);

  parts.push("<h2>Métodos</h2>");
  const fileNames = input.files.map((f) => f.file_name).filter(Boolean);
  parts.push(
    paragraphs(
      fileNames.length > 0
        ? `As análises foram conduzidas no DataMind sobre ${fileNames.length} arquivo(s): ${fileNames.join(", ")}. A escolha de cada teste estatístico seguiu uma regra determinística a partir dos pressupostos medidos nos próprios dados (normalidade, homogeneidade de variâncias e frequências esperadas), e não a preferência do analista.`
        : "As análises foram conduzidas no DataMind. A escolha de cada teste estatístico seguiu uma regra determinística a partir dos pressupostos medidos nos próprios dados."
    )
  );

  const quality = qualityNotes(input.findings);
  if (quality.length > 0) {
    parts.push("<h3>Qualidade dos dados</h3>");
    parts.push(`<ul>${quality.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>`);
  }

  parts.push("<h2>Resultados</h2>");
  if (input.sections.length === 0) {
    parts.push(paragraphs("Nenhuma análise foi registrada nesta conversa."));
  }
  for (const section of input.sections) {
    if (section.type === "text" && section.content.trim()) {
      parts.push(paragraphs(section.content));
    }
    if (section.type === "table" && section.headers && section.rows) {
      parts.push(tableHtml(section.headers, section.rows.slice(0, maxRows), section.title));
      if (section.rows.length > maxRows) {
        parts.push(`<p><em>(Mostrando ${maxRows} de ${section.rows.length} linhas)</em></p>`);
      }
    }
    if (section.type === "figure" && section.imageData) {
      parts.push(
        `<p><img src="${section.imageData}" alt="${escapeHtml(section.title || "Figura")}" /></p>` +
          `<p><em>${escapeHtml(section.title || "")}</em></p>`
      );
    }
    // Code is deliberately left out of the manuscript section: it belongs in the
    // PDF export and in the conversation, not in a results section.
  }

  const table = findingsTable(input.findings);
  if (table) {
    parts.push("<h2>Achados automáticos</h2>");
    parts.push(tableHtml(table.headers, table.rows, "Tabela — achados da varredura automática"));
    parts.push(`<ul>${table.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`);
  }

  return parts.join("\n");
}

/**
 * The findings as context for the writing model.
 *
 * Status labels are spelled out rather than implied: the Writing Assistant turns
 * this into manuscript prose, and a confirmed result and a screened lead must not
 * arrive there looking the same. The q travels with every line for the same reason.
 */
export function findingsContextText(findings: Finding[]): string {
  const live = findings.filter((f) => !f.dismissed);
  if (live.length === 0) return "";

  const quality = live.filter((f) => f.kind === "quality");
  const confirmed = live.filter((f) => f.kind !== "quality" && f.significant);
  const leads = live.filter((f) => f.kind !== "quality" && !f.significant);

  const lines: string[] = [
    "ACHADOS AUTOMÁTICOS (varredura determinística; teste escolhido por regra a partir dos pressupostos medidos; p corrigido por Benjamini-Hochberg = q):",
  ];

  for (const finding of quality) {
    lines.push(`- QUALIDADE DOS DADOS: ${finding.title}`);
  }
  for (const finding of confirmed) {
    lines.push(`- CONFIRMADO: ${finding.title} — ${finding.detail}`);
  }
  for (const finding of leads) {
    lines.push(
      `- PISTA (não sobreviveu à correção; hipótese a investigar, não resultado): ${finding.title} — ${finding.detail}`
    );
  }

  return lines.join("\n");
}
