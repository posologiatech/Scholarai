import jsPDF from "jspdf";

export interface Pico {
  population?: string;
  intervention?: string;
  comparison?: string;
  outcome?: string;
}

export interface ProtocolCriterion {
  name: string;
  description: string;
}

export interface ProtocolInput {
  question: string;
  pico: Pico;
  criteria: ProtocolCriterion[];
  searchStrategy?: string;
  prosperoId?: string;
  lockedAt: string;
  locale: "pt" | "en";
}

/** Builds an immutable markdown snapshot of the review protocol at the moment it is registered. */
export function buildProtocolDocument({ question, pico, criteria, searchStrategy, prosperoId, lockedAt, locale }: ProtocolInput): string {
  const pt = locale === "pt";
  const lines: string[] = [];
  lines.push(`# ${pt ? "Protocolo de Revisão Sistemática" : "Systematic Review Protocol"}`);
  lines.push("");
  lines.push(`${pt ? "Registrado em" : "Registered on"}: ${new Date(lockedAt).toLocaleString(locale)}`);
  if (prosperoId) lines.push(`${pt ? "ID de registro externo (ex.: PROSPERO)" : "External registration ID (e.g. PROSPERO)"}: ${prosperoId}`);
  lines.push("");
  lines.push(`## ${pt ? "Pergunta de Pesquisa" : "Research Question"}`);
  lines.push(question || "—");
  lines.push("");
  lines.push(`## PICO`);
  lines.push(`- **${pt ? "População" : "Population"}:** ${pico.population || "—"}`);
  lines.push(`- **${pt ? "Intervenção" : "Intervention"}:** ${pico.intervention || "—"}`);
  lines.push(`- **${pt ? "Comparação" : "Comparison"}:** ${pico.comparison || "—"}`);
  lines.push(`- **Outcome:** ${pico.outcome || "—"}`);
  lines.push("");
  lines.push(`## ${pt ? "Critérios de Inclusão/Exclusão" : "Inclusion/Exclusion Criteria"}`);
  if (criteria.length === 0) {
    lines.push(pt ? "Nenhum critério definido." : "No criteria defined.");
  } else {
    for (const c of criteria) lines.push(`- **${c.name}:** ${c.description}`);
  }
  lines.push("");
  lines.push(`## ${pt ? "Estratégia de Busca" : "Search Strategy"}`);
  lines.push(searchStrategy?.trim() || (pt ? "Não documentada." : "Not documented."));
  lines.push("");
  lines.push(
    pt
      ? "> Este documento é um snapshot imutável, gerado no momento do registro do protocolo. Alterações posteriores à pergunta de pesquisa, PICO, critérios de triagem e estratégia de busca são bloqueadas."
      : "> This document is an immutable snapshot generated at protocol registration time. Subsequent changes to the research question, PICO, screening criteria and search strategy are locked.",
  );
  return lines.join("\n");
}

export function downloadProtocolPDF(markdown: string, locale: "pt" | "en") {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const maxWidth = pageW - marginL - marginR;
  let y = 20;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 15) {
      pdf.addPage();
      y = 20;
    }
  };

  for (const rawLine of markdown.split("\n")) {
    let line = rawLine;
    let fontSize = 10;
    let fontStyle: "normal" | "bold" = "normal";

    if (line.startsWith("# ")) {
      line = line.slice(2);
      fontSize = 16;
      fontStyle = "bold";
    } else if (line.startsWith("## ")) {
      line = line.slice(3);
      fontSize = 13;
      fontStyle = "bold";
    } else if (line.startsWith("- ")) {
      line = "• " + line.slice(2).replace(/\*\*/g, "");
    } else {
      line = line.replace(/\*\*/g, "");
    }

    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", fontStyle);

    if (!line.trim()) {
      y += 4;
      continue;
    }

    const wrapped = pdf.splitTextToSize(line, maxWidth);
    ensureSpace(wrapped.length * (fontSize / 2));
    pdf.text(wrapped, marginL, y);
    y += wrapped.length * (fontSize / 2) + 3;
  }

  pdf.save(`protocolo${locale === "pt" ? "" : "-protocol"}.pdf`);
}
