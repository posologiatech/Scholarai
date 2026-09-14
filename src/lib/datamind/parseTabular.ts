/**
 * Robust tabular ingestion for DataMind.
 *
 * The whole module rests on one promise: what the researcher sees in the grid is
 * what the `df` in the sandbox holds. That only works if the browser and pandas
 * agree on delimiter, decimal separator and encoding — so detection happens once,
 * here, and the resulting dialect travels with the file to the sandbox.
 */
import Papa from "papaparse";

export type Delimiter = "," | ";" | "\t" | "|";
export type Decimal = "." | ",";
export type Encoding = "utf-8" | "latin-1";

export interface TabularDialect {
  delimiter: Delimiter;
  decimal: Decimal;
  encoding: Encoding;
}

export interface ParsedTable {
  columns: string[];
  /** Rows capped at `maxRows`; numeric cells already normalized to dot-decimal. */
  rows: Record<string, string>[];
  dialect: TabularDialect;
  /** True row count in the file, even when `rows` was capped. */
  totalRows: number;
  truncated: boolean;
  /** Columns whose values were converted from comma- to dot-decimal. */
  decimalNormalizedColumns: string[];
}

export const DEFAULT_DIALECT: TabularDialect = { delimiter: ",", decimal: ".", encoding: "utf-8" };

/**
 * A file as handed to a sandbox (Pyodide, WebR or the remote server). The dialect
 * travels with the name so every engine reads the file the same way the browser did.
 */
export interface SandboxFile {
  fileName: string;
  dialect?: TabularDialect;
}

const CANDIDATE_DELIMITERS: Delimiter[] = [",", ";", "\t", "|"];
const SNIFF_LINES = 20;

/** Values that mean "absent" regardless of column, matching pandas' default NA set. */
const NA_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "-", "--", "#n/a", "nd", "n.d."]);

export function isBlank(value: string | null | undefined): boolean {
  return value == null || NA_TOKENS.has(value.trim().toLowerCase());
}

/**
 * UTF-8 first, since that is what modern exports produce. A decode failure almost
 * always means a Windows/Excel export in latin-1 (cp1252), which never fails to
 * decode — so the test cannot be run the other way around.
 */
export function detectEncoding(buffer: ArrayBuffer): Encoding {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return "utf-8";
  } catch {
    return "latin-1";
  }
}

export function decodeBuffer(buffer: ArrayBuffer, encoding: Encoding): string {
  // windows-1252 is the superset of latin-1 that Excel actually writes.
  const label = encoding === "latin-1" ? "windows-1252" : "utf-8";
  const text = new TextDecoder(label).decode(buffer);
  // Strip a UTF-8 BOM so it does not end up glued to the first header name.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Counts a character on a line, ignoring anything inside double quotes. */
function countOutsideQuotes(line: string, char: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      // A doubled quote inside a quoted field is an escaped quote, not a toggle.
      if (inQuotes && line[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && c === char) {
      count++;
    }
  }
  return count;
}

/**
 * Picks the delimiter that splits every sampled line into the same number of
 * fields. Consistency matters more than raw frequency: prose full of commas can
 * out-count the real ";" delimiter, but only the real one is stable across rows.
 */
export function sniffDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, SNIFF_LINES);
  if (lines.length === 0) return ",";

  let best: Delimiter = ",";
  let bestScore = -1;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = lines.map((l) => countOutsideQuotes(l, delimiter));
    const fieldsOnHeader = counts[0];
    if (fieldsOnHeader === 0) continue;

    const consistent = counts.filter((c) => c === fieldsOnHeader).length / counts.length;
    // Consistency dominates; the field count only breaks ties between equally
    // stable candidates, favouring the one that really splits the row up.
    const score = consistent * 1000 + Math.min(fieldsOnHeader, 50);
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }

  return best;
}

const PLAIN_COMMA_DECIMAL = /^-?\d+,\d+$/;
const GROUPED_COMMA_DECIMAL = /^-?\d{1,3}(\.\d{3})+,\d+$/;
const DOT_DECIMAL = /^-?\d*\.?\d+([eE][-+]?\d+)?$/;

function looksCommaDecimal(value: string): boolean {
  const v = value.trim();
  return PLAIN_COMMA_DECIMAL.test(v) || GROUPED_COMMA_DECIMAL.test(v);
}

/** Converts "1.234,56" / "3,5" to dot-decimal. */
export function normalizeDecimalCell(value: string): string {
  const v = value.trim();
  if (GROUPED_COMMA_DECIMAL.test(v)) return v.replace(/\./g, "").replace(",", ".");
  if (PLAIN_COMMA_DECIMAL.test(v)) return v.replace(",", ".");
  return value;
}

const DECIMAL_COLUMN_THRESHOLD = 0.8;

/**
 * Decided per column, and only when a strong majority of its values look like
 * comma decimals — so free text such as "1,5 mg" or a notes field full of commas
 * is never rewritten.
 */
export function detectDecimalColumns(columns: string[], rows: Record<string, string>[]): string[] {
  const sample = rows.slice(0, 500);
  return columns.filter((col) => {
    const values = sample.map((r) => r[col] ?? "").filter((v) => !isBlank(v));
    if (values.length < 3) return false;
    const commaDecimal = values.filter(looksCommaDecimal).length;
    if (commaDecimal / values.length < DECIMAL_COLUMN_THRESHOLD) return false;
    // A column that is already valid dot-decimal must not be rewritten.
    const dotDecimal = values.filter((v) => DOT_DECIMAL.test(v.trim())).length;
    return commaDecimal > dotDecimal;
  });
}

/**
 * Header names have to survive the round trip to pandas, so empties get a stable
 * placeholder and duplicates get a suffix instead of silently overwriting.
 */
/** Drops a leading byte-order mark so it does not stick to the first header name. */
function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function normalizeHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = stripBom(String(h ?? "")).trim();
    if (name === "") name = `coluna_${i + 1}`;
    const previous = seen.get(name);
    if (previous === undefined) {
      seen.set(name, 1);
      return name;
    }
    const next = previous + 1;
    seen.set(name, next);
    return `${name}_${next}`;
  });
}

export interface ParseCSVOptions {
  maxRows?: number;
  /** Skip detection when the dialect is already known (e.g. stored on the file row). */
  dialect?: TabularDialect;
}

export function parseCSVText(text: string, options: ParseCSVOptions = {}): ParsedTable {
  const maxRows = options.maxRows ?? Infinity;
  const delimiter = options.dialect?.delimiter ?? sniffDelimiter(text);

  const result = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: "greedy",
    // Parsed as arrays so duplicate and empty headers can be normalized
    // deliberately, instead of being collapsed by Papa's own header handling.
    header: false,
    dynamicTyping: false,
  });

  const matrix = (result.data || []).filter((r) => Array.isArray(r));
  if (matrix.length === 0) {
    return {
      columns: [],
      rows: [],
      dialect: options.dialect ?? { ...DEFAULT_DIALECT, delimiter },
      totalRows: 0,
      truncated: false,
      decimalNormalizedColumns: [],
    };
  }

  const columns = normalizeHeaders(matrix[0]);
  const body = matrix.slice(1);
  const totalRows = body.length;
  const capped = maxRows === Infinity ? body : body.slice(0, maxRows);

  const rows: Record<string, string>[] = capped.map((cells) => {
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col] = cells[i] != null ? String(cells[i]) : "";
    });
    return row;
  });

  const decimalColumns = options.dialect?.decimal === "." ? [] : detectDecimalColumns(columns, rows);

  if (decimalColumns.length > 0) {
    for (const row of rows) {
      for (const col of decimalColumns) {
        row[col] = normalizeDecimalCell(row[col]);
      }
    }
  }

  const decimal: Decimal = options.dialect?.decimal ?? (decimalColumns.length > 0 ? "," : ".");

  return {
    columns,
    rows,
    dialect: {
      delimiter,
      decimal,
      encoding: options.dialect?.encoding ?? "utf-8",
    },
    totalRows,
    truncated: totalRows > rows.length,
    decimalNormalizedColumns: decimalColumns,
  };
}

export function parseCSVBuffer(buffer: ArrayBuffer, options: ParseCSVOptions = {}): ParsedTable {
  const encoding = options.dialect?.encoding ?? detectEncoding(buffer);
  const text = decodeBuffer(buffer, encoding);
  const parsed = parseCSVText(text, options);
  return { ...parsed, dialect: { ...parsed.dialect, encoding } };
}

/** Serializes back to CSV using the canonical dialect the sandbox reads. */
export function toCSV(columns: string[], rows: Record<string, string>[]): string {
  const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((c) => escape(row[c] ?? "")).join(",")),
  ].join("\n");
}
