/**
 * Canonical dataset profile for DataMind.
 *
 * One profile feeds three consumers: the profiler UI, the prompt context sent to
 * the model, and the report. Keeping a single implementation is what stops the
 * UI from showing one thing while the model reasons about another.
 */
import { isBlank } from "./parseTabular";

export type ColumnType = "numeric" | "categorical" | "datetime" | "text" | "boolean";

export interface LevelCount {
  value: string;
  count: number;
  pct: number;
}

export interface SentinelCandidate {
  value: number;
  count: number;
  pct: number;
}

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  /** Non-missing values. */
  count: number;
  missing: number;
  missingPct: number;
  unique: number;
  uniquePct: number;
  // Numeric stats are flattened onto the column so the UI can read them directly.
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  skewness?: number;
  outliers?: number;
  outlierPct?: number;
  /** Top levels for categorical/boolean columns. */
  topValues?: LevelCount[];
  /** Values that look like missing-data codes rather than real measurements. */
  sentinels?: SentinelCandidate[];
  isConstant: boolean;
  /** Nearly all-unique — an identifier, not a variable to analyse. */
  isIdCandidate: boolean;
  qualityScore: number;
}

export interface CorrelationPair {
  col1: string;
  col2: string;
  value: number;
  /** Pairwise-complete observations behind the coefficient. */
  n: number;
}

export type WarningSeverity = "info" | "warning" | "critical";

export interface ProfileWarning {
  severity: WarningSeverity;
  message: string;
  column?: string;
}

export interface DatasetProfile {
  totalRows: number;
  totalCols: number;
  overallQuality: number;
  duplicateRows: number;
  memoryEstimate: string;
  columns: ColumnProfile[];
  correlations: CorrelationPair[];
  warnings: ProfileWarning[];
}

export interface ProfileInput {
  columns: string[];
  rows: Record<string, string>[];
}

/** Common missing-data codes in health/survey datasets. */
const SENTINEL_CANDIDATES = [-9999, -999, -99, -9, -1, 77, 88, 99, 999, 9999, 99999];
const SENTINEL_MIN_SHARE = 0.005;
const BOOLEAN_TOKENS = new Set(["true", "false", "yes", "no", "sim", "não", "nao", "0", "1"]);
const DATE_PATTERN = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/;

function toNumber(value: string): number {
  // Blank and NA tokens must not slip through as 0 — Number("") is 0, which would
  // silently drag means down and fabricate correlations on missing data.
  if (isBlank(value)) return NaN;
  // Values arrive already normalized to dot-decimal by the ingestion layer.
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : NaN;
}

export function detectType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => !isBlank(v));
  if (nonEmpty.length === 0) return "text";

  if (nonEmpty.every((v) => BOOLEAN_TOKENS.has(v.trim().toLowerCase()))) return "boolean";

  const numericCount = nonEmpty.filter((v) => !Number.isNaN(toNumber(v))).length;
  if (numericCount / nonEmpty.length > 0.8) return "numeric";

  const dateCount = nonEmpty.filter((v) => DATE_PATTERN.test(v.trim())).length;
  if (dateCount / nonEmpty.length > 0.5) return "datetime";

  const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
  if (uniqueRatio < 0.3 && nonEmpty.length > 10) return "categorical";

  return "text";
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function calcNumericStats(values: number[]) {
  if (values.length === 0) return {};
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const median = quantile(sorted, 0.5);
  // Sample standard deviation — the dataset is a sample, not the population.
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const skewness = n > 2 && std > 0 ? values.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / n : 0;

  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const outliers = iqr > 0 ? values.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length : 0;

  return {
    mean,
    median,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    skewness,
    outliers,
    outlierPct: (outliers / n) * 100,
  };
}

/**
 * Flags values that look like missing-data codes: a known sentinel that repeats
 * often and sits far outside the plausible range of the rest of the column. A
 * legitimate 999 in a "custo" column stays put, because it will not be an outlier.
 */
function detectSentinels(values: number[], q1: number, q3: number): SentinelCandidate[] {
  if (values.length < 20) return [];
  const iqr = q3 - q1;
  if (!(iqr > 0)) return [];
  const upper = q3 + 3 * iqr;
  const lower = q1 - 3 * iqr;

  const found: SentinelCandidate[] = [];
  for (const candidate of SENTINEL_CANDIDATES) {
    if (candidate <= upper && candidate >= lower) continue;
    const count = values.filter((v) => v === candidate).length;
    if (count === 0) continue;
    const pct = (count / values.length) * 100;
    if (count / values.length < SENTINEL_MIN_SHARE) continue;
    found.push({ value: candidate, count, pct });
  }
  return found.sort((a, b) => b.count - a.count);
}

/** Pearson correlation over pairwise-complete observations. */
export function pearson(pairs: [number, number][]): number {
  const n = pairs.length;
  if (n < 3) return NaN;
  const m1 = pairs.reduce((s, p) => s + p[0], 0) / n;
  const m2 = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0;
  let d1 = 0;
  let d2 = 0;
  for (const [a, b] of pairs) {
    num += (a - m1) * (b - m2);
    d1 += (a - m1) ** 2;
    d2 += (b - m2) ** 2;
  }
  if (d1 <= 0 || d2 <= 0) return NaN;
  return num / Math.sqrt(d1 * d2);
}

const MAX_CORRELATION_COLUMNS = 12;
const MIN_CORRELATION_N = 5;
const CORRELATION_THRESHOLD = 0.5;

/**
 * Joins cells when hashing a row for duplicate detection. A control character no
 * spreadsheet can contain, so ["a","bc"] and ["ab","c"] cannot collide into a
 * false duplicate the way a plain concatenation would.
 */
const ROW_SEPARATOR = String.fromCharCode(1);

export function profileDataset(data: ProfileInput): DatasetProfile {
  const { columns: cols, rows } = data;
  const totalRows = rows.length;
  const totalCols = cols.length;
  const warnings: ProfileWarning[] = [];

  const rowStrings = rows.map((r) => cols.map((c) => r[c] ?? "").join(ROW_SEPARATOR));
  const duplicateRows = totalRows - new Set(rowStrings).size;
  if (duplicateRows > 0) {
    warnings.push({
      severity: duplicateRows > totalRows * 0.05 ? "warning" : "info",
      message: `${duplicateRows} linha(s) duplicada(s) encontrada(s)`,
    });
  }

  const charCount = rows.reduce((s, r) => s + cols.reduce((ss, c) => ss + (r[c]?.length || 0), 0), 0);
  const memBytes = charCount * 2;
  const memoryEstimate =
    memBytes > 1e6 ? `${(memBytes / 1e6).toFixed(1)} MB` : `${(memBytes / 1e3).toFixed(0)} KB`;

  const columnProfiles: ColumnProfile[] = cols.map((col) => {
    const values = rows.map((r) => r[col] ?? "");
    const nonEmpty = values.filter((v) => !isBlank(v));
    const missing = totalRows - nonEmpty.length;
    const missingPct = totalRows > 0 ? (missing / totalRows) * 100 : 0;
    const unique = new Set(nonEmpty).size;
    const uniquePct = nonEmpty.length > 0 ? (unique / nonEmpty.length) * 100 : 0;
    const type = detectType(values);

    const isConstant = unique <= 1 && nonEmpty.length > 0;
    const isIdCandidate = totalRows > 20 && uniquePct >= 99 && type !== "datetime";

    const profile: ColumnProfile = {
      name: col,
      type,
      count: nonEmpty.length,
      missing,
      missingPct,
      unique,
      uniquePct,
      isConstant,
      isIdCandidate,
      qualityScore: Math.max(0, 100 - missingPct * 0.5),
    };

    if (type === "numeric") {
      const numVals = nonEmpty.map(toNumber).filter((v) => !Number.isNaN(v));
      Object.assign(profile, calcNumericStats(numVals));

      const sentinels = detectSentinels(numVals, profile.q1 ?? NaN, profile.q3 ?? NaN);
      if (sentinels.length > 0) {
        profile.sentinels = sentinels;
        profile.qualityScore -= 15;
        const list = sentinels.map((s) => `${s.value} (${s.count}×)`).join(", ");
        warnings.push({
          severity: "critical",
          column: col,
          message: `Coluna "${col}": valores ${list} parecem código de ausência, não medida real — confirme antes de incluir nas estatísticas`,
        });
      }

      if ((profile.outlierPct ?? 0) > 5) {
        warnings.push({
          severity: "warning",
          column: col,
          message: `Coluna "${col}": ${profile.outliers} outliers (${profile.outlierPct?.toFixed(1)}% dos valores)`,
        });
        profile.qualityScore -= 10;
      }

      if (Math.abs(profile.skewness ?? 0) > 2) {
        warnings.push({
          severity: "warning",
          column: col,
          message: `Coluna "${col}": distribuição fortemente assimétrica (skew=${profile.skewness?.toFixed(2)}) — testes paramétricos podem não se aplicar`,
        });
      }
    }

    if (type === "categorical" || type === "boolean") {
      const freq = new Map<string, number>();
      for (const v of nonEmpty) freq.set(v, (freq.get(v) || 0) + 1);
      profile.topValues = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count, pct: (count / nonEmpty.length) * 100 }));

      const rarest = profile.topValues[profile.topValues.length - 1];
      if (unique === 2 && rarest && rarest.count < 10) {
        warnings.push({
          severity: "warning",
          column: col,
          message: `Coluna "${col}": categoria minoritária com apenas ${rarest.count} caso(s) — insuficiente para comparação entre grupos`,
        });
      }
    }

    if (missingPct > 30) {
      warnings.push({
        severity: missingPct > 60 ? "critical" : "warning",
        column: col,
        message: `Coluna "${col}": ${missingPct.toFixed(1)}% de valores ausentes`,
      });
    }

    if (isConstant) {
      warnings.push({
        severity: "info",
        column: col,
        message: `Coluna "${col}": valor constante — não contribui para nenhuma análise`,
      });
      profile.qualityScore -= 20;
    }

    profile.qualityScore = Math.max(0, Math.round(profile.qualityScore));
    return profile;
  });

  // Identifiers and constants are excluded: correlating a record id with anything
  // is noise, and a constant has no variance to correlate.
  const numericCols = columnProfiles
    .filter((c) => c.type === "numeric" && !c.isIdCandidate && !c.isConstant)
    .slice(0, MAX_CORRELATION_COLUMNS);

  const correlations: CorrelationPair[] = [];
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const c1 = numericCols[i].name;
      const c2 = numericCols[j].name;
      // Pairwise-complete: a row counts only when BOTH values are present, so the
      // two series stay aligned even with missing data in different places.
      const pairs: [number, number][] = [];
      for (const row of rows) {
        const a = toNumber(row[c1] ?? "");
        const b = toNumber(row[c2] ?? "");
        if (!Number.isNaN(a) && !Number.isNaN(b)) pairs.push([a, b]);
      }
      if (pairs.length < MIN_CORRELATION_N) continue;
      const r = pearson(pairs);
      if (Number.isNaN(r) || Math.abs(r) < CORRELATION_THRESHOLD) continue;
      correlations.push({ col1: c1, col2: c2, value: Math.round(r * 100) / 100, n: pairs.length });
    }
  }
  correlations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const collinear = correlations.filter((c) => Math.abs(c.value) > 0.9);
  if (collinear.length > 0) {
    warnings.push({
      severity: "warning",
      message: `Correlação muito alta entre ${collinear
        .slice(0, 3)
        .map((c) => `"${c.col1}" e "${c.col2}"`)
        .join(", ")} — risco de multicolinearidade em modelos de regressão`,
    });
  }

  const idCols = columnProfiles.filter((c) => c.isIdCandidate);
  if (idCols.length > 0) {
    warnings.push({
      severity: "info",
      message: `Coluna(s) ${idCols.map((c) => `"${c.name}"`).join(", ")} parecem identificadores — não devem entrar como variável em modelos`,
    });
  }

  const overallQuality =
    columnProfiles.length > 0
      ? Math.round(columnProfiles.reduce((s, c) => s + c.qualityScore, 0) / columnProfiles.length)
      : 0;

  const severityRank: Record<WarningSeverity, number> = { critical: 0, warning: 1, info: 2 };
  warnings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    totalRows,
    totalCols,
    overallQuality,
    duplicateRows,
    memoryEstimate,
    columns: columnProfiles,
    correlations,
    warnings,
  };
}

/* ── Compact profile for the model prompt ────────────────────────────────── */

export interface CompactColumn {
  name: string;
  type: ColumnType;
  missingPct: number;
  unique: number;
  /** Set when the column should not be treated as an analysis variable. */
  role?: "id" | "constant";
  /** Values that look like missing-data codes. */
  sentinels?: number[];
  /** Top levels, for categorical and boolean columns. */
  levels?: { value: string; count: number }[];
  stats?: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    skew: number;
    outliers: number;
  };
}

export interface CompactProfile {
  /** Rows the profile was computed over. */
  basedOnRows: number;
  /** Rows in the whole file; larger than basedOnRows when the grid was capped. */
  totalRows: number;
  sampled: boolean;
  quality: number;
  duplicateRows: number;
  columns: CompactColumn[];
  correlations: { a: string; b: string; r: number; n: number }[];
  warnings: { severity: WarningSeverity; message: string }[];
}

const MAX_PROMPT_LEVELS = 6;
const MAX_PROMPT_CORRELATIONS = 8;
const MAX_PROMPT_WARNINGS = 10;

function round(value: number | undefined, digits = 3): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Shrinks a full profile into something small enough to resend on every request
 * while still letting the model choose a test without guessing: types, missing
 * rates, category levels and the flags that say which columns to leave alone.
 */
export function compactProfile(profile: DatasetProfile, totalRows?: number): CompactProfile {
  const fileRows = totalRows ?? profile.totalRows;

  const columns: CompactColumn[] = profile.columns.map((c) => {
    const compact: CompactColumn = {
      name: c.name,
      type: c.type,
      missingPct: round(c.missingPct, 1),
      unique: c.unique,
    };
    if (c.isIdCandidate) compact.role = "id";
    else if (c.isConstant) compact.role = "constant";
    if (c.sentinels?.length) compact.sentinels = c.sentinels.map((s) => s.value);
    if (c.topValues?.length) {
      compact.levels = c.topValues
        .slice(0, MAX_PROMPT_LEVELS)
        .map((l) => ({ value: l.value, count: l.count }));
    }
    if (c.type === "numeric" && c.mean != null) {
      compact.stats = {
        mean: round(c.mean),
        median: round(c.median),
        std: round(c.std),
        min: round(c.min),
        max: round(c.max),
        skew: round(c.skewness, 2),
        outliers: c.outliers ?? 0,
      };
    }
    return compact;
  });

  return {
    basedOnRows: profile.totalRows,
    totalRows: fileRows,
    sampled: fileRows > profile.totalRows,
    quality: profile.overallQuality,
    duplicateRows: profile.duplicateRows,
    columns,
    correlations: profile.correlations
      .slice(0, MAX_PROMPT_CORRELATIONS)
      .map((c) => ({ a: c.col1, b: c.col2, r: c.value, n: c.n })),
    warnings: profile.warnings
      .slice(0, MAX_PROMPT_WARNINGS)
      .map((w) => ({ severity: w.severity, message: w.message })),
  };
}
