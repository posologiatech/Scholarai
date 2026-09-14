/**
 * Builds the conversation context sent to the model.
 *
 * The assistant used to receive only the prose of past messages, never the code it
 * ran nor the numbers that came back — so a follow-up like "interprete isso" or
 * "faça o post-hoc" was answered blind, from scratch. This module condenses each
 * past turn into something small enough to resend on every request but complete
 * enough to reason over: the code, the tables (truncated), and the figures named
 * rather than embedded.
 */

export interface ContextMessage {
  role: string;
  content: string;
  code_block?: string | null;
  output_content?: string | null;
}

export interface HistoryEntry {
  role: string;
  content: string;
}

export interface SummarizeOptions {
  /** Rows kept per table before it is elided. */
  maxTableRows?: number;
  /** Characters kept of plain stdout text. */
  maxTextChars?: number;
}

const DEFAULT_MAX_TABLE_ROWS = 15;
const DEFAULT_MAX_TEXT_CHARS = 1500;

const IMG_RE = /\[IMG\][\s\S]*?\[\/IMG\]/g;
const TABLE_RE = /__DATATABLE_START__([\s\S]*?)__DATATABLE_END__/g;
const CHART_RE = /__DATACHART_START__([\s\S]*?)__DATACHART_END__/g;

function renderTable(payloadJson: string, maxRows: number): string {
  try {
    const payload = JSON.parse(payloadJson) as {
      title?: string;
      columns?: string[];
      data?: Record<string, unknown>[];
    };
    const columns = payload.columns || [];
    const data = payload.data || [];
    if (columns.length === 0) return "[tabela vazia]";

    const header = `Tabela: ${payload.title || "(sem título)"}`;
    const shown = data.slice(0, maxRows);
    const lines = [
      columns.join(" | "),
      ...shown.map((row) => columns.map((c) => String(row[c] ?? "")).join(" | ")),
    ];
    // The row count matters for interpretation (degrees of freedom, group sizes),
    // so it is stated even when the rows themselves are elided.
    const omitted = data.length - shown.length;
    if (omitted > 0) lines.push(`... (+${omitted} linha(s) não exibida(s); total ${data.length})`);

    return `${header}\n${lines.join("\n")}`;
  } catch {
    return "[tabela ilegível]";
  }
}

function renderChart(payloadJson: string): string {
  try {
    const payload = JSON.parse(payloadJson) as { title?: string; kind?: string };
    return `[gráfico ${payload.kind || ""}: ${payload.title || "sem título"}]`.replace(/\s+/g, " ");
  } catch {
    return "[gráfico]";
  }
}

/**
 * Turns a stored `output_content` into text a model can read: base64 figures become
 * a placeholder (they would otherwise blow the context window for no gain), tables
 * become readable rows, and long stdout is cut from the middle so both the header
 * and the final summary survive.
 */
export function summarizeOutput(outputContent: string, options: SummarizeOptions = {}): string {
  const maxTableRows = options.maxTableRows ?? DEFAULT_MAX_TABLE_ROWS;
  const maxTextChars = options.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS;

  let text = outputContent.replace(IMG_RE, "[figura gerada]");
  text = text.replace(TABLE_RE, (_m, payload: string) => renderTable(payload, maxTableRows));
  text = text.replace(CHART_RE, (_m, payload: string) => renderChart(payload));
  text = text.trim();

  if (text.length > maxTextChars) {
    // Keep both ends: the head carries the column listing and setup, the tail the
    // final interpretation and summary the user is most likely asking about.
    const head = text.slice(0, Math.floor(maxTextChars * 0.6));
    const tail = text.slice(-Math.floor(maxTextChars * 0.4));
    text = `${head}\n[...saída truncada...]\n${tail}`;
  }

  return text;
}

export interface BuildHistoryOptions extends SummarizeOptions {
  /** How many trailing messages to carry. */
  maxMessages?: number;
  /** Characters kept of a past message's prose. */
  maxContentChars?: number;
}

const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_MAX_CONTENT_CHARS = 1200;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

/**
 * Assembles the history payload: every assistant turn carries what it actually did
 * (code) and what came back (results), so the model can build on its own output
 * instead of re-deriving it.
 */
export function buildHistory(
  messages: ContextMessage[],
  options: BuildHistoryOptions = {}
): HistoryEntry[] {
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const maxContentChars = options.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS;

  return messages.slice(-maxMessages).map((m) => {
    const parts: string[] = [truncate(m.content || "", maxContentChars)];

    if (m.role === "assistant") {
      if (m.code_block) {
        parts.push(`Código executado:\n\`\`\`\n${m.code_block}\n\`\`\``);
      }
      if (m.output_content) {
        const summary = summarizeOutput(m.output_content, options);
        if (summary) parts.push(`Resultado da execução:\n${summary}`);
      }
    }

    return { role: m.role, content: parts.filter(Boolean).join("\n\n") };
  });
}
