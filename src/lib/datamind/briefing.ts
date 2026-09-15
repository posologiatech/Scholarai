/**
 * Dataset briefing for DataMind.
 *
 * The briefing answers "what is in this file, and what should I be careful about"
 * before the researcher asks anything. Every number in it comes from work that has
 * already been done — the compact profile computed at upload and the findings the
 * scan stored — so the briefing can never disagree with the profiler or the
 * findings panel beside it, and costs nothing to render.
 *
 * The AI-written version (`datamind-briefing`) is a second, optional pass over
 * exactly these facts: it rewrites, it does not measure.
 */
import { Finding } from "./findings";
import { CompactColumn, CompactProfile } from "./profile";

export interface BriefingSection {
  title: string;
  lines: string[];
}

export interface Briefing {
  file: string;
  /** One line: size, shape and quality, the way a researcher would say it. */
  headline: string;
  sections: BriefingSection[];
  /** Questions worth asking first, drawn from the findings when there are any. */
  starters: string[];
}

/** Columns listed one by one; past this the list stops being readable. */
const MAX_LISTED_COLUMNS = 12;
/** Findings quoted in the briefing; the panel holds the full list. */
const MAX_QUOTED_FINDINGS = 5;

const TYPE_LABEL: Record<string, string> = {
  numeric: "numérica",
  categorical: "categórica",
  datetime: "data",
  boolean: "booleana",
  text: "texto",
};

const TYPE_PLURAL: Record<string, string> = {
  numeric: "numéricas",
  categorical: "categóricas",
  datetime: "de data",
  boolean: "booleanas",
  text: "de texto",
};

function fmtNumber(value: number | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}

function fmtInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

/** How one column reads in the variable list: enough to pick it for an analysis. */
function describeColumn(column: CompactColumn): string {
  let head = `${column.name} (${TYPE_LABEL[column.type] || column.type}`;
  if (column.role === "id") head += ", identificador";
  else if (column.role === "constant") head += ", constante";
  head += ")";

  const tail: string[] = [];
  if (column.stats) {
    tail.push(
      `média ${fmtNumber(column.stats.mean)} · dp ${fmtNumber(column.stats.std)} · de ${fmtNumber(column.stats.min)} a ${fmtNumber(column.stats.max)}`
    );
  } else if (column.levels?.length) {
    const shown = column.levels.slice(0, 3).map((l) => `${l.value} (${fmtInt(l.count)})`).join(", ");
    const rest = column.unique > 3 ? `, +${column.unique - 3}` : "";
    tail.push(`${column.unique} categoria(s): ${shown}${rest}`);
  }
  if (column.missingPct > 0) tail.push(`${fmtNumber(column.missingPct, 1)}% ausente`);
  if (column.sentinels?.length) {
    tail.push(`códigos suspeitos de ausência: ${column.sentinels.join(", ")}`);
  }

  return tail.length > 0 ? `${head} — ${tail.join(" · ")}` : head;
}

function countByType(columns: CompactColumn[]): string {
  const counts = new Map<string, number>();
  for (const column of columns) {
    counts.set(column.type, (counts.get(column.type) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${n} ${n === 1 ? TYPE_LABEL[type] || type : TYPE_PLURAL[type] || type}`)
    .join(", ");
}

function findingSection(findings: Finding[]): BriefingSection | null {
  const statistical = findings.filter((f) => f.kind !== "quality");
  if (statistical.length === 0) return null;

  const confirmed = statistical.filter((f) => f.significant);
  const leads = statistical.filter((f) => !f.significant);

  const lines: string[] = [];
  if (confirmed.length > 0) {
    lines.push(
      `${confirmed.length} achado(s) sobreviveram à correção de Benjamini-Hochberg com efeito não desprezível:`
    );
    // The evidence line travels with the finding on purpose: it carries the rule
    // that fired, the q and the effect size, and a briefing that quoted only the
    // headline would restate a shortlist entry as a result.
    for (const finding of confirmed.slice(0, MAX_QUOTED_FINDINGS)) {
      lines.push(`• ${finding.title} — ${finding.detail}`);
    }
    if (confirmed.length > MAX_QUOTED_FINDINGS) {
      lines.push(`+${confirmed.length - MAX_QUOTED_FINDINGS} no painel de achados.`);
    }
  }
  if (leads.length > 0) {
    lines.push(
      `${leads.length} pista(s) não confirmada(s) após a correção: valem como hipótese a investigar, não como resultado.`
    );
  }
  return { title: "O que a varredura já encontrou", lines };
}

function cautionSection(profile: CompactProfile, findings: Finding[]): BriefingSection | null {
  const lines: string[] = [];

  for (const warning of profile.warnings) {
    const prefix =
      warning.severity === "critical" ? "Crítico" : warning.severity === "warning" ? "Atenção" : "Nota";
    lines.push(`${prefix}: ${warning.message}`);
  }
  if (profile.duplicateRows > 0) {
    lines.push(
      `Atenção: ${fmtInt(profile.duplicateRows)} linha(s) duplicada(s) — linhas idênticas inflam o n de qualquer teste.`
    );
  }
  if (profile.sampled) {
    lines.push(
      `Nota: o perfil foi calculado sobre ${fmtInt(profile.basedOnRows)} das ${fmtInt(profile.totalRows)} linhas do arquivo.`
    );
  }

  // Quality findings the profile did not already phrase as a warning of its own.
  const already = lines.map((l) => l.toLowerCase());
  for (const finding of findings.filter((f) => f.kind === "quality")) {
    const title = finding.title.toLowerCase();
    if (!already.some((l) => l.includes(title))) lines.push(`Atenção: ${finding.title}`);
  }

  return lines.length > 0 ? { title: "Cuidados antes de analisar", lines } : null;
}

/**
 * Builds the briefing for one file out of what is already stored.
 *
 * Returns null without a profile: a briefing assembled from nothing but the file
 * name would be a guess, and a guess is exactly what this is meant to replace.
 */
export function buildBriefing(
  fileName: string,
  profile: CompactProfile | undefined,
  findings: Finding[],
  starters: string[] = []
): Briefing | null {
  if (!profile) return null;

  // A finding with no file recorded predates per-file attribution; showing it is
  // better than dropping evidence the researcher can see in the panel anyway.
  const fileFindings = findings.filter((f) => !f.file || f.file === fileName);
  const analysable = profile.columns.filter((c) => !c.role);
  const excluded = profile.columns.filter((c) => c.role);

  const headline = `${fmtInt(profile.totalRows)} linha(s) × ${profile.columns.length} coluna(s) · qualidade ${Math.round(profile.quality)}/100`;

  const sections: BriefingSection[] = [];

  const overview: string[] = [`Colunas por tipo: ${countByType(profile.columns)}.`];
  if (excluded.length > 0) {
    overview.push(
      `${excluded.length} coluna(s) fora das análises por serem identificadores ou constantes: ${excluded.map((c) => c.name).join(", ")}.`
    );
  }
  overview.push(`${analysable.length} coluna(s) analisável(is).`);
  sections.push({ title: "O que há no arquivo", lines: overview });

  sections.push({
    title: "Variáveis",
    lines: [
      ...analysable.slice(0, MAX_LISTED_COLUMNS).map(describeColumn),
      ...(analysable.length > MAX_LISTED_COLUMNS
        ? [`+${analysable.length - MAX_LISTED_COLUMNS} coluna(s) não listada(s) aqui.`]
        : []),
    ],
  });

  const caution = cautionSection(profile, fileFindings);
  if (caution) sections.push(caution);

  if (profile.correlations.length > 0) {
    sections.push({
      title: "Relações mais fortes no perfil",
      lines: profile.correlations
        .slice(0, 5)
        .map((c) => `${c.a} × ${c.b}: r = ${fmtNumber(c.r)} (n = ${fmtInt(c.n)})`),
    });
  }

  const found = findingSection(fileFindings);
  if (found) sections.push(found);

  return { file: fileName, headline, sections, starters };
}

/**
 * Flattens a briefing into the text the model is asked to rewrite.
 *
 * It receives the finished facts and nothing else — no raw data, no room to
 * recompute — which is what keeps the written briefing tied to the panel.
 */
export function briefingFacts(briefing: Briefing): string {
  const body = briefing.sections
    .map((section) => `## ${section.title}\n${section.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");
  return `Arquivo: ${briefing.file}\nResumo: ${briefing.headline}\n\n${body}`;
}

/** The briefing as plain text, for copying into notes or a report. */
export function briefingToText(briefing: Briefing, prose?: string): string {
  const head = `Briefing — ${briefing.file}\n${briefing.headline}`;
  const written = prose ? `\n\n${prose}` : "";
  const body = briefing.sections
    .map((section) => `\n\n${section.title}\n${section.lines.map((l) => `  ${l}`).join("\n")}`)
    .join("");
  return `${head}${written}${body}\n`;
}
