import { useState } from "react";
import { Download, ChevronDown, ChevronUp, TableIcon, ImageIcon, FileText, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  type: string;
  content: string;
}

interface OutputBlock {
  kind: "table" | "image" | "text";
  content: string;
  headers?: string[];
  rows?: string[][];
  label?: string;
}

/* ── Helpers ── */

/** Download a CSV string as file */
function downloadCSV(headers: string[], rows: string[][], filename = "tabela.csv") {
  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download a base64 image as PNG */
function downloadImage(dataUrl: string, filename = "grafico.png") {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** Try to parse a text block as a table (pandas .to_string() output) */
function tryParseTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split("\n").filter(l => l.trim() !== "");
  if (lines.length < 2) return null;

  // Detect pandas to_string format: first line is headers, rest is data
  // Common patterns: columns separated by 2+ spaces, or fixed-width
  const firstLine = lines[0];
  
  // Skip if it looks like prose (sentences with periods, long text)
  if (firstLine.includes(". ") && firstLine.length > 100) return null;
  if (/^(Aviso|Erro|Resumo|Interpretação|Análise)/i.test(firstLine)) return null;

  // Try splitting by 2+ spaces
  const headerCandidates = firstLine.trim().split(/\s{2,}/);
  if (headerCandidates.length < 2) return null;

  const dataRows: string[][] = [];
  let validRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Skip pandas footer like "[1452 rows x 6 columns]"
    if (/^\[.*rows?\s*x\s*\d+\s*columns?\]$/i.test(line)) continue;
    // Skip separator lines
    if (/^[-=]{3,}$/.test(line)) continue;

    const cells = line.split(/\s{2,}/);
    if (cells.length >= 2) {
      // If first cell is a numeric index, include it; otherwise keep all
      dataRows.push(cells);
      validRows++;
    }
  }

  if (validRows < 1) return null;

  // Align columns: if rows have one more column than headers, first col is index
  let headers = headerCandidates;
  let rows = dataRows;

  if (dataRows.length > 0 && dataRows[0].length === headers.length + 1) {
    // First column in rows is the index
    headers = ["#", ...headers];
  } else if (dataRows.length > 0 && dataRows[0].length !== headers.length) {
    // Misaligned - not a table
    if (Math.abs(dataRows[0].length - headers.length) > 2) return null;
  }

  return { headers, rows };
}

/** Check if text is just noise/separator */
function isNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^-{3,}\s*.*\s*-{3,}$/.test(t)) return true;
  if (/^-{3,}$/.test(t)) return true;
  if (/^={3,}$/.test(t)) return true;
  if (/^\[.*rows?\s*x\s*\d+\s*columns?\]$/i.test(t)) return true;
  return false;
}

/** Parse combined output into sequential blocks */
function parseBlocks(type: string, content: string): OutputBlock[] {
  if (type === "image") {
    return [{ kind: "image", content }];
  }

  const blocks: OutputBlock[] = [];
  // Split on image markers
  const parts = content.split(/(\[IMG\].*?\[\/IMG\])/);
  let chartIdx = 0;

  for (const part of parts) {
    const imgMatch = part.match(/^\[IMG\](.*?)\[\/IMG\]$/);
    if (imgMatch) {
      const src = imgMatch[1];
      if (src && src.length > 100) {
        chartIdx++;
        blocks.push({ kind: "image", content: src, label: `Gráfico ${chartIdx}` });
      }
      continue;
    }

    const text = part.trim();
    if (!text) continue;

    // Split text into potential table sections and text sections
    const lines = text.split("\n");
    let buffer: string[] = [];

    const flushBuffer = () => {
      if (buffer.length === 0) return;
      const txt = buffer.join("\n").trim();
      buffer = [];
      if (isNoise(txt)) return;

      // Try to parse as table
      const table = tryParseTable(txt);
      if (table && table.rows.length >= 1) {
        blocks.push({
          kind: "table",
          content: txt,
          headers: table.headers,
          rows: table.rows,
          label: `${table.headers.length} cols, ${table.rows.length} rows`,
        });
      } else {
        // It's text — could be interpretation or heading
        blocks.push({ kind: "text", content: txt });
      }
    };

    // Heuristic: detect boundaries between tables and text
    // A blank line usually separates sections
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Blank line = section boundary
      if (line.trim() === "" && buffer.length > 0) {
        // Check if next non-empty line starts a new section type
        const nextNonEmpty = lines.slice(i + 1).find(l => l.trim() !== "");
        if (nextNonEmpty) {
          const curIsTable = buffer.length >= 2 && tryParseTable(buffer.join("\n")) !== null;
          const nextLooksLikeTable = (nextNonEmpty.trim().split(/\s{2,}/).length >= 2) && !nextNonEmpty.includes(". ");
          if (curIsTable !== nextLooksLikeTable || curIsTable) {
            flushBuffer();
            continue;
          }
        }
        buffer.push(line);
        continue;
      }

      buffer.push(line);
    }
    flushBuffer();
  }

  return blocks;
}

/* ── Inline Table Component ── */
const InlineTable = ({ block, index }: { block: OutputBlock; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const maxVisible = 10;
  const rows = block.rows || [];
  const headers = block.headers || [];
  const visibleRows = expanded ? rows : rows.slice(0, maxVisible);
  const hasMore = rows.length > maxVisible;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/40">
        <div className="flex items-center gap-2">
          <TableIcon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            {block.label || "Table"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => downloadCSV(headers, rows, `tabela_${index + 1}.csv`)}
            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Download CSV"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2.5 px-4 text-muted-foreground font-medium text-xs w-10">#</th>
              {headers.map((h, i) => (
                <th key={i} className="text-left py-2.5 px-4 font-semibold text-foreground text-xs whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-border/20 hover:bg-muted/20 transition-colors ${
                  ri % 2 === 0 ? "bg-background" : "bg-muted/10"
                }`}
              >
                <td className="py-2 px-4 text-muted-foreground text-xs">{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} className="py-2 px-4 text-foreground text-xs whitespace-nowrap max-w-[250px] truncate" title={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 flex items-center justify-center gap-1 text-xs text-primary hover:bg-muted/20 transition-colors border-t border-border/40"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {rows.length - maxVisible} mais linhas
            </>
          )}
        </button>
      )}
    </div>
  );
};

/* ── Inline Chart Component ── */
const InlineChart = ({ block, index }: { block: OutputBlock; index: number }) => {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{block.label || "Chart"}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => downloadImage(block.content, `grafico_${index + 1}.png`)}
              className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Download PNG"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Expandir"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="p-3 flex justify-center bg-white dark:bg-muted/10">
          <img
            src={block.content}
            alt={block.label || "Chart"}
            className="max-w-full max-h-[400px] object-contain rounded"
            onError={(e) => { (e.target as HTMLImageElement).closest('.rounded-xl')?.classList.add('hidden'); }}
          />
        </div>
      </div>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8 cursor-pointer"
            onClick={() => setFullscreen(false)}
          >
            <img
              src={block.content}
              alt={block.label || "Chart"}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ── Inline Text Component ── */
const InlineText = ({ block }: { block: OutputBlock }) => {
  const content = block.content.trim();
  if (!content) return null;

  // Render text with basic markdown-like formatting
  return (
    <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
      {content.split("\n").map((line, i) => {
        // Bold sections
        const processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: processed }} className="mb-0.5" />;
      })}
    </div>
  );
};

/* ── Main Component ── */
const DataMindCodeOutput = ({ type, content }: Props) => {
  const blocks = parseBlocks(type, content);

  if (blocks.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/50 overflow-hidden">
        <pre className="p-4 text-xs font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          {block.kind === "table" && <InlineTable block={block} index={i} />}
          {block.kind === "image" && <InlineChart block={block} index={i} />}
          {block.kind === "text" && <InlineText block={block} />}
        </motion.div>
      ))}
    </div>
  );
};

export default DataMindCodeOutput;
