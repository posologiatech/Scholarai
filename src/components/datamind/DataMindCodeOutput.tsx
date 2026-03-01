import { useState } from "react";
import { Download, ChevronDown, ChevronUp, TableIcon, ImageIcon, FileText, Maximize2, FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  title?: string;
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

/** Download as Excel (.xlsx) */
function downloadExcel(headers: string[], rows: string[][], filename = "tabela.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, filename);
}

/** Export to Google Sheets via edge function */
async function exportToGoogleSheets(headers: string[], rows: string[][], title: string): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    toast({ title: "Login necessário", description: "Faça login para exportar para Google Sheets.", variant: "destructive" });
    return null;
  }

  const providerToken = session.provider_token;
  if (!providerToken) {
    toast({
      title: "Login com Google necessário",
      description: "Para exportar para Google Sheets, faça login usando sua conta Google com as permissões necessárias.",
      variant: "destructive",
    });
    return null;
  }

  const { data, error } = await supabase.functions.invoke("export-to-sheets", {
    body: { headers, rows, title, provider_token: providerToken },
  });

  if (error) {
    toast({ title: "Erro ao exportar", description: error.message || "Falha ao criar planilha no Google Sheets.", variant: "destructive" });
    return null;
  }

  return data?.url || null;
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

  const firstLine = lines[0];
  
  if (firstLine.includes(". ") && firstLine.length > 100) return null;
  if (/^(Aviso|Erro|Resumo|Interpretação|Análise)/i.test(firstLine)) return null;

  const headerCandidates = firstLine.trim().split(/\s{2,}/);
  if (headerCandidates.length < 2) return null;

  const dataRows: string[][] = [];
  let validRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^\[.*rows?\s*x\s*\d+\s*columns?\]$/i.test(line)) continue;
    if (/^[-=]{3,}$/.test(line)) continue;

    const cells = line.split(/\s{2,}/);
    if (cells.length >= 2) {
      dataRows.push(cells);
      validRows++;
    }
  }

  if (validRows < 1) return null;

  let headers = headerCandidates;
  let rows = dataRows;

  if (dataRows.length > 0 && dataRows[0].length === headers.length + 1) {
    headers = ["#", ...headers];
  } else if (dataRows.length > 0 && dataRows[0].length !== headers.length) {
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

    const lines = text.split("\n");
    let buffer: string[] = [];

    const flushBuffer = () => {
      if (buffer.length === 0) return;
      const txt = buffer.join("\n").trim();
      buffer = [];
      if (isNoise(txt)) return;

      const table = tryParseTable(txt);
      if (table && table.rows.length >= 1) {
        // Check if previous block is a short single-line text — use as title
        let title: string | undefined;
        const prev = blocks[blocks.length - 1];
        if (prev && prev.kind === "text") {
          const lines = prev.content.trim().split("\n");
          if (lines.length === 1 && lines[0].length <= 80) {
            title = lines[0].trim();
            blocks.pop(); // remove the text block, it becomes the table title
          }
        }
        blocks.push({
          kind: "table",
          content: txt,
          headers: table.headers,
          rows: table.rows,
          label: `${table.headers.length} cols, ${table.rows.length} rows`,
          title,
        });
      } else {
        blocks.push({ kind: "text", content: txt });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === "" && buffer.length > 0) {
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

/* ── Google Sheets Icon ── */
const GoogleSheetsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#0F9D58"/>
    <path d="M14 2V8H20L14 2Z" fill="#87CEAB"/>
    <rect x="7" y="12" width="10" height="1.5" rx="0.2" fill="white"/>
    <rect x="7" y="15" width="10" height="1.5" rx="0.2" fill="white"/>
    <rect x="11.5" y="10" width="1.5" height="8" rx="0.2" fill="white"/>
  </svg>
);

/* ── Inline Table Component (Julius-style spreadsheet) ── */
const InlineTable = ({ block, index }: { block: OutputBlock; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const maxVisible = 10;
  const rows = block.rows || [];
  const headers = block.headers || [];
  const visibleRows = expanded ? rows : rows.slice(0, maxVisible);
  const hasMore = rows.length > maxVisible;

  const handleExportSheets = async () => {
    setSheetsLoading(true);
    try {
      const url = await exportToGoogleSheets(headers, rows, block.title || `DataMind - Tabela ${index + 1}`);
      if (url) {
        toast({
          title: "Planilha criada!",
          description: (
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline text-primary">
              Abrir no Google Sheets <ExternalLink className="h-3 w-3" />
            </a>
          ),
        });
      }
    } finally {
      setSheetsLoading(false);
    }
  };

  const tableContent = (isFullscreen = false) => {
    const displayRows = isFullscreen ? rows : visibleRows;
    return (
      <div className={isFullscreen ? "overflow-auto max-h-[80vh]" : "overflow-x-auto max-h-[500px] overflow-y-auto"}>
        <table className="w-full text-[13px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/30">
              <th className="py-2.5 px-3 text-left text-muted-foreground/60 font-normal text-xs w-12 border-b border-border/40">
                □
              </th>
              {headers.map((h, i) => (
                <th key={i} className="text-left py-2.5 px-4 font-semibold text-foreground/80 text-[13px] border-b border-border/40">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-border/20 hover:bg-[hsl(210,80%,96%)] dark:hover:bg-primary/10 transition-colors"
              >
                <td className="py-2.5 px-3 text-muted-foreground/50 text-xs font-normal">
                  {ri + 1}
                </td>
                {row.map((cell, ci) => (
                  <td key={ci} className="py-2.5 px-4 text-foreground/90 text-[13px] whitespace-pre-wrap break-words">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className="my-1">
        {/* Title above the table */}
        {block.title && (
          <h4 className="text-[15px] font-bold text-foreground mb-1 px-1">{block.title}</h4>
        )}

        {/* Subtitle row with metadata + action buttons */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs text-muted-foreground">
            {block.label || "Table"}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleExportSheets}
              disabled={sheetsLoading}
              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Enviar para Google Sheets"
            >
              {sheetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleSheetsIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => downloadExcel(headers, rows, `tabela_${index + 1}.xlsx`)}
              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Download Excel"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Tela cheia"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Spreadsheet table */}
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          {tableContent()}

          {/* Show more/less */}
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-2 flex items-center justify-center gap-1 text-xs text-primary hover:bg-muted/20 transition-colors border-t border-border/30"
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
      </div>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
            onClick={() => setFullscreen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div>
                  {block.title && <h3 className="text-base font-bold text-foreground">{block.title}</h3>}
                  <span className="text-xs text-muted-foreground">{block.label}</span>
                </div>
                <button
                  onClick={() => setFullscreen(false)}
                  className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              {tableContent(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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

  return (
    <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
      {content.split("\n").map((line, i) => {
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
