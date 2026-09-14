/**
 * Excel ingestion, kept on the same contract as the CSV path so both produce a
 * ParsedTable the grid, the profiler and the sandbox bootstrap can consume
 * interchangeably.
 */
import * as XLSX from "xlsx";
import {
  DEFAULT_DIALECT,
  ParsedTable,
  detectDecimalColumns,
  normalizeDecimalCell,
  normalizeHeaders,
} from "./parseTabular";

export interface ParseWorkbookOptions {
  maxRows?: number;
  sheetName?: string;
}

export function parseExcelBuffer(buffer: ArrayBuffer, options: ParseWorkbookOptions = {}): ParsedTable {
  const maxRows = options.maxRows ?? Infinity;
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = options.sheetName && workbook.Sheets[options.sheetName]
    ? options.sheetName
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const empty: ParsedTable = {
    columns: [],
    rows: [],
    dialect: DEFAULT_DIALECT,
    totalRows: 0,
    truncated: false,
    decimalNormalizedColumns: [],
  };
  if (!sheet) return empty;

  // header:1 keeps the header row as data, so empty and duplicate column names can
  // be normalized here rather than being collapsed by SheetJS.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (matrix.length === 0) return empty;

  const columns = normalizeHeaders(matrix[0] || []);
  const body = matrix.slice(1);
  const totalRows = body.length;
  const capped = maxRows === Infinity ? body : body.slice(0, maxRows);

  const rows: Record<string, string>[] = capped.map((cells) => {
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col] = cells?.[i] != null ? String(cells[i]) : "";
    });
    return row;
  });

  // A pt-BR workbook can still format its numbers with a decimal comma, so the
  // same column-level normalization the CSV path uses applies here too.
  const decimalColumns = detectDecimalColumns(columns, rows);
  for (const row of rows) {
    for (const col of decimalColumns) {
      row[col] = normalizeDecimalCell(row[col]);
    }
  }

  return {
    columns,
    rows,
    dialect: DEFAULT_DIALECT,
    totalRows,
    truncated: totalRows > rows.length,
    decimalNormalizedColumns: decimalColumns,
  };
}
