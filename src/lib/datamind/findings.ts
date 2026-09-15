/**
 * Automatic findings for DataMind.
 *
 * Two sources feed one list. The statistical findings come from the deterministic
 * scan that runs inside the sandbox (`remote-exec/datamind_scan.py`), which reuses
 * the same rule table as a normal analysis; the data-quality findings come from
 * the compact profile that was already computed at upload, so nothing is measured
 * twice and the panel can never disagree with the profiler beside it.
 *
 * Everything the researcher sees about a statistical finding is derived here from
 * numbers the engine produced — this module never decides that something is true,
 * only how to say it.
 */
import { CompactProfile, WarningSeverity } from "./profile";

export type FindingKind = "comparison" | "correlation" | "association" | "quality";

export interface Finding {
  /** Stable across re-scans, so persistence updates instead of duplicating. */
  key: string;
  /** Row id, once the finding has been stored. */
  id?: string;
  /** Hidden by the researcher — kept so the next scan does not resurrect it. */
  dismissed?: boolean;
  kind: FindingKind;
  file: string;
  /** One sentence, in the researcher's language. */
  title: string;
  /** The rule that fired and the numbers behind it. */
  detail: string;
  /** Survived the false-discovery correction with a non-negligible effect. */
  significant: boolean;
  severity: WarningSeverity;
  /** The question this finding turns into when the researcher follows it up. */
  question: string;
  columns: string[];
  p?: number;
  q?: number;
  effect?: number;
  effectName?: string;
  magnitude?: string;
  test?: string;
  label?: string;
  because?: string;
  n?: number;
  /** The engine's own caveat (a chi-square on thin expected frequencies). */
  fragile?: boolean;
  /** Significant only because n is large — the effect itself is negligible. */
  negligible?: boolean;
  /** What the triage model made of it. Never replaces the engine's own numbers. */
  interpretation?: FindingInterpretation;
}

export interface FindingInterpretation {
  headline: string;
  why: string;
  caution?: string;
}

export interface ScanSummary {
  findings: Finding[];
  totalTested: number;
  totalSignificant: number;
  error?: string;
}

/** Raw shape emitted by datamind_scan.py — mirrored, not re-derived. */
interface RawFinding {
  key: string;
  kind: string;
  file?: string;
  outcome?: string;
  group?: string;
  var_a?: string;
  var_b?: string;
  test?: string;
  label?: string;
  because?: string;
  p?: number | null;
  q?: number | null;
  effect?: number | null;
  effect_name?: string;
  magnitude?: string;
  n?: number;
  n_groups?: number;
  levels?: string[];
  centres?: (number | null)[];
  centre_measure?: string;
  highest?: string;
  lowest?: string;
  direction?: string;
  significant?: boolean;
  negligible?: boolean;
  fragile?: boolean;
  table_shape?: number[];
}

const START = "__DATAFINDINGS_START__";
const END = "__DATAFINDINGS_END__";

/** Findings below this are not worth a panel row even as a lead. */
const MAX_LEAD_Q = 0.25;

function fmt(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function fmtP(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value < 0.0001 ? "<0,0001" : value.toFixed(4).replace(".", ",");
}

/**
 * Builds the Python that runs the scan in the sandbox.
 *
 * The scan module's source is passed in rather than imported here: it is the same
 * file the home server uses, inlined by Vite, so the browser and the server can
 * never drift apart.
 */
export function buildScanCode(scanSource: string, excludeByFile: Record<string, string[]>): string {
  return `${scanSource}\n\nrun_scan(dfs, ${JSON.stringify(excludeByFile)})\n`;
}

/**
 * Pulls the scan payload out of sandbox stdout.
 *
 * Anything else printed around it (a pandas warning, a failed file load) is
 * ignored rather than treated as a failure — the markers are the contract.
 */
export function parseScanOutput(stdout: string): ScanSummary | null {
  const start = stdout.indexOf(START);
  const end = stdout.indexOf(END, start);
  if (start === -1 || end === -1) return null;

  let payload: { findings?: RawFinding[]; totalTested?: number; totalSignificant?: number; error?: string };
  try {
    payload = JSON.parse(stdout.slice(start + START.length, end));
  } catch {
    return null;
  }

  const findings = (payload.findings || [])
    .map(toFinding)
    .filter((f): f is Finding => f !== null);

  return {
    findings,
    totalTested: payload.totalTested ?? 0,
    totalSignificant: payload.totalSignificant ?? 0,
    error: payload.error,
  };
}

function toFinding(raw: RawFinding): Finding | null {
  if (!raw || !raw.key) return null;

  const q = raw.q ?? null;
  // A lead is worth showing; a coin flip is not.
  if (q != null && q > MAX_LEAD_Q) return null;

  const base = {
    key: raw.key,
    file: raw.file || "",
    significant: !!raw.significant,
    severity: (raw.significant ? "warning" : "info") as WarningSeverity,
    p: raw.p ?? undefined,
    q: raw.q ?? undefined,
    effect: raw.effect ?? undefined,
    effectName: raw.effect_name,
    magnitude: raw.magnitude,
    test: raw.test,
    label: raw.label,
    because: raw.because,
    n: raw.n,
    negligible: raw.negligible,
    fragile: raw.fragile,
  };

  const evidence = [
    raw.label ? `Teste: ${raw.label}` : "",
    `p = ${fmtP(raw.p)}`,
    `q (FDR) = ${fmtP(raw.q)}`,
    raw.effect_name ? `${raw.effect_name} = ${fmt(raw.effect)}${raw.magnitude ? ` (${raw.magnitude})` : ""}` : "",
    raw.n ? `n = ${raw.n}` : "",
  ].filter(Boolean).join(" · ");

  if (raw.kind === "comparison" && raw.outcome && raw.group) {
    const verb = raw.significant ? "difere" : "pode diferir";
    const where = raw.highest && raw.lowest && raw.highest !== raw.lowest
      ? `, ${raw.centre_measure || "média"} maior em "${raw.highest}" e menor em "${raw.lowest}"`
      : "";
    return {
      ...base,
      kind: "comparison",
      columns: [raw.outcome, raw.group],
      title: `${raw.outcome} ${verb} entre os ${raw.n_groups ?? 2} grupos de ${raw.group}${where}`,
      detail: `${evidence}${raw.because ? ` · Regra: ${raw.because}` : ""}`,
      question: `Compare ${raw.outcome} entre os grupos de ${raw.group} e mostre as descritivas, o tamanho de efeito e um gráfico.`,
    };
  }

  if (raw.kind === "correlation" && raw.var_a && raw.var_b) {
    const verb = raw.significant ? "tem correlação" : "pode ter correlação";
    return {
      ...base,
      kind: "correlation",
      columns: [raw.var_a, raw.var_b],
      title: `${raw.var_a} ${verb} ${raw.direction || ""} ${raw.magnitude || ""} com ${raw.var_b}`.replace(/\s+/g, " ").trim(),
      detail: `${evidence}${raw.because ? ` · Regra: ${raw.because}` : ""}`,
      question: `Analise a correlação entre ${raw.var_a} e ${raw.var_b}, com gráfico de dispersão e linha de tendência.`,
    };
  }

  if (raw.kind === "association" && raw.var_a && raw.var_b) {
    const verb = raw.significant ? "está associada" : "pode estar associada";
    return {
      ...base,
      kind: "association",
      columns: [raw.var_a, raw.var_b],
      title: `${raw.var_a} ${verb} a ${raw.var_b}`,
      detail: `${evidence}${raw.because ? ` · Regra: ${raw.because}` : ""}`,
      question: `Teste a associação entre ${raw.var_a} e ${raw.var_b} e mostre a tabela cruzada com percentuais.`,
    };
  }

  return null;
}

/**
 * Turns the profile's own warnings into findings.
 *
 * These are the pitfalls the researcher should see before trusting anything
 * above them, which is why they are ranked first regardless of effect size.
 */
export function qualityFindings(profile: CompactProfile | undefined, fileName: string): Finding[] {
  if (!profile) return [];

  const findings: Finding[] = profile.warnings.map((warning, index) => ({
    key: `quality|${fileName}|${index}|${warning.message.slice(0, 40)}`,
    kind: "quality" as const,
    file: fileName,
    title: warning.message,
    detail: "Detectado no perfil do arquivo, antes de qualquer análise.",
    significant: warning.severity === "critical",
    severity: warning.severity,
    columns: [],
    question: `Investigue e trate este problema nos dados: ${warning.message}`,
  }));

  if (profile.duplicateRows > 0) {
    findings.push({
      key: `quality|${fileName}|duplicates`,
      kind: "quality",
      file: fileName,
      title: `${profile.duplicateRows} linha(s) duplicada(s) no arquivo`,
      detail: "Linhas idênticas inflam o n e enviesam qualquer teste rodado sobre elas.",
      significant: false,
      severity: "warning",
      columns: [],
      question: "Mostre as linhas duplicadas e avalie se devem ser removidas antes das análises.",
    });
  }

  return findings;
}

const SEVERITY_RANK: Record<WarningSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * One ranked list out of both sources.
 *
 * Data quality comes first — a finding computed on a column that is 60% missing
 * is a finding about the missingness — then confirmed results by effect size,
 * then leads.
 */
export function rankFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    if (a.kind === "quality" || b.kind === "quality") {
      if (a.kind !== b.kind) return a.kind === "quality" ? -1 : 1;
      return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    }
    if (a.significant !== b.significant) return a.significant ? -1 : 1;
    return Math.abs(b.effect ?? 0) - Math.abs(a.effect ?? 0);
  });
}

/**
 * The questions the suggestion strip offers, drawn from what the scan actually
 * found in this dataset rather than from keywords in the conversation.
 */
export function suggestionsFromFindings(findings: Finding[], limit = 4): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const finding of rankFindings(findings)) {
    if (questions.length >= limit) break;
    if (seen.has(finding.question)) continue;
    seen.add(finding.question);
    questions.push(finding.question);
  }
  return questions;
}


/**
 * Merges the triage model's reading back onto the findings.
 *
 * The model is allowed to reorder and to explain; it is not allowed to change
 * what was found. Anything it returns for a key that was not sent is dropped,
 * and a finding it ignored keeps its place at the end rather than disappearing.
 */
export function applyInterpretation(
  findings: Finding[],
  items: { key?: string; headline?: string; why?: string; caution?: string }[]
): Finding[] {
  const byKey = new Map(findings.map((f) => [f.key, f]));
  const ordered: Finding[] = [];
  const used = new Set<string>();

  for (const item of items || []) {
    const finding = item?.key ? byKey.get(item.key) : undefined;
    if (!finding || used.has(finding.key)) continue;
    used.add(finding.key);
    ordered.push(
      item.headline
        ? {
            ...finding,
            interpretation: {
              headline: item.headline,
              why: item.why || "",
              caution: item.caution || undefined,
            },
          }
        : finding
    );
  }

  for (const finding of findings) {
    if (!used.has(finding.key)) ordered.push(finding);
  }
  return ordered;
}
