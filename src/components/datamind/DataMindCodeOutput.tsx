import { useState, useMemo } from "react";
import { Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, TableIcon, ImageIcon, FileText, Maximize2, FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
import DataMindDashboardPinButton from "./DataMindDashboardPinButton";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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

function downloadExcel(headers: string[], rows: string[][], filename = "tabela.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, filename);
}

async function exportToGoogleSheets(headers: string[], rows: string[][], title: string): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    toast({ title: "Login necessário", description: "Faça login para exportar para Google Sheets.", variant: "destructive" });
    return null;
  }

  const providerToken = session.provider_token;
  if (!providerToken) {
    toast({
      title: "Permissão do Google Sheets necessária",
      description: "Você será redirecionado para autorizar o acesso ao Google Sheets. Após autorizar, tente exportar novamente.",
    });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
        scopes: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    return null;
  }

  const { data, error } = await supabase.functions.invoke("export-to-sheets", {
    body: { headers, rows, title, provider_token: providerToken },
  });

  if (error || data?.error) {
    const errMsg = data?.error || error?.message || "Falha ao criar planilha no Google Sheets.";
    if (errMsg.includes("insufficient") || errMsg.includes("scope") || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("authentication scopes")) {
      toast({
        title: "Permissão insuficiente",
        description: "Redirecionando para autorizar acesso ao Google Sheets...",
      });
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.href,
          scopes: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      return null;
    }
    toast({ title: "Erro ao exportar", description: errMsg, variant: "destructive" });
    return null;
  }

  return data?.url || null;
}

function downloadImage(dataUrl: string, filename = "grafico.png") {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

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

  if (dataRows.length > 0 && dataRows[0].length === headers.length + 1) {
    headers = ["#", ...headers];
  } else if (dataRows.length > 0 && dataRows[0].length !== headers.length) {
    if (Math.abs(dataRows[0].length - headers.length) > 2) return null;
  }

  return { headers, rows: dataRows };
}

function isNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^-{3,}\s*.*\s*-{3,}$/.test(t)) return true;
  if (/^-{3,}$/.test(t)) return true;
  if (/^={3,}$/.test(t)) return true;
  if (/^\[.*rows?\s*x\s*\d+\s*columns?\]$/i.test(t)) return true;
  return false;
}

function parseBlocks(type: string, content: string): OutputBlock[] {
  if (type === "image") {
    return [{ kind: "image", content }];
  }

  const blocks: OutputBlock[] = [];

  // Split by image markers first
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

    // Split by JSON datatable markers
    const dtParts = text.split(/(__DATATABLE_START__[\s\S]*?__DATATABLE_END__)/);

    for (const dtPart of dtParts) {
      // Check if this is a JSON datatable block
      const dtMatch = dtPart.match(/^__DATATABLE_START__([\s\S]*?)__DATATABLE_END__$/);
      if (dtMatch) {
        try {
          const payload = JSON.parse(dtMatch[1]);
          const columns: string[] = payload.columns || [];
          const data: Record<string, unknown>[] = payload.data || [];
          const title = payload.title || undefined;

          const headers = columns;
          const rows = data.map(record =>
            columns.map(col => String(record[col] ?? ""))
          );

          blocks.push({
            kind: "table",
            content: dtPart,
            headers,
            rows,
            label: `${headers.length} cols, ${rows.length} rows`,
            title,
          });
        } catch {
          // If JSON parse fails, treat as text
          if (dtPart.trim() && !isNoise(dtPart.trim())) {
            blocks.push({ kind: "text", content: dtPart.trim() });
          }
        }
        continue;
      }

      // Regular text: try legacy text-table parsing
      const segment = dtPart.trim();
      if (!segment) continue;

      const lines = segment.split("\n");
      let buffer: string[] = [];

      const flushBuffer = () => {
        if (buffer.length === 0) return;
        const txt = buffer.join("\n").trim();
        buffer = [];
        if (isNoise(txt)) return;

        const table = tryParseTable(txt);
        if (table && table.rows.length >= 1) {
          let title: string | undefined;
          const prev = blocks[blocks.length - 1];
          if (prev && prev.kind === "text") {
            const prevLines = prev.content.trim().split("\n");
            if (prevLines.length === 1 && prevLines[0].length <= 80) {
              title = prevLines[0].trim();
              blocks.pop();
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
  }

  return blocks;
}

/* ── Badge colors for known columns ── */
const CLASSE_COLORS: Record<string, string> = {
  "ANTIMICROBIANO": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "ANTIDEPRESSIVO": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "ANTI-HIPERTENSIVO": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "ANALGÉSICO": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "ANTIINFLAMATÓRIO": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "ANSIOLÍTICO": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "ANTICONVULSIVANTE": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

const RISCO_COLORS: Record<string, string> = {
  "MAV": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "ALTO": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "MÉDIO": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "MODERADO": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "BAIXO": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function isNumericColumn(rows: string[][], colIndex: number): boolean {
  let numCount = 0;
  const sample = rows.slice(0, Math.min(10, rows.length));
  for (const row of sample) {
    const val = row[colIndex]?.trim();
    if (val && !isNaN(Number(val.replace(/,/g, "")))) numCount++;
  }
  return numCount > sample.length * 0.5;
}

function formatCell(value: string, header: string, isNumeric: boolean) {
  const trimmed = value?.trim() || "";
  
  // Treat 999 as missing
  if (trimmed === "999" || trimmed === "999.0") {
    return <span className="text-muted-foreground/40">—</span>;
  }

  const upperHeader = header.toUpperCase();
  const upperVal = trimmed.toUpperCase();

  // Badge for CLASSE column
  if (upperHeader === "CLASSE" || upperHeader === "CATEGORY" || upperHeader === "CATEGORIA") {
    const colorClass = CLASSE_COLORS[upperVal] || "bg-muted text-muted-foreground";
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
        {trimmed}
      </span>
    );
  }

  // Badge for RISCO column
  if (upperHeader === "RISCO" || upperHeader === "RISK" || upperHeader === "SEVERIDADE") {
    const colorClass = RISCO_COLORS[upperVal] || "bg-muted text-muted-foreground";
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
        {trimmed}
      </span>
    );
  }

  return trimmed;
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

/* ── Inline Table Component (Professional Data Table) ── */
const InlineTable = ({ block, index }: { block: OutputBlock; index: number }) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;
  const rows = block.rows || [];
  const headers = block.headers || [];
  const totalPages = Math.ceil(rows.length / pageSize);
  const hasPagination = rows.length > pageSize;

  const numericCols = useMemo(() => {
    return headers.map((_, ci) => isNumericColumn(rows, ci));
  }, [headers, rows]);

  const paginatedRows = useMemo(() => {
    if (!hasPagination) return rows;
    return rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  }, [rows, currentPage, hasPagination]);

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

  const renderTable = (displayRows: string[][], startIndex: number, isFullscreen = false) => (
    <div className={isFullscreen ? "overflow-auto max-h-[80vh]" : "overflow-x-auto"}>
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/50 border-b-2 border-border/50">
            <th className="py-3 px-3 text-center text-muted-foreground/50 font-normal text-xs w-12">
              #
            </th>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`py-3 px-4 font-semibold text-foreground/80 text-[13px] tracking-wide ${
                  numericCols[i] ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, ri) => (
            <tr
              key={ri}
              className={`
                border-b border-border/15 transition-colors cursor-default
                ${ri % 2 === 0 ? "bg-transparent" : "bg-muted/20"}
                hover:bg-primary/5 dark:hover:bg-primary/10
              `}
            >
              <td className="py-2.5 px-3 text-center text-muted-foreground/40 text-xs font-mono tabular-nums">
                {startIndex + ri + 1}
              </td>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-2.5 px-4 text-foreground/90 text-[13px] whitespace-pre-wrap break-words ${
                    numericCols[ci] ? "text-right font-mono tabular-nums" : "text-left"
                  }`}
                >
                  {formatCell(cell, headers[ci] || "", numericCols[ci])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="my-2">
        {/* Card container */}
        <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20">
            <div className="flex flex-col gap-0.5">
              {block.title && (
                <h4 className="text-sm font-semibold text-foreground">{block.title}</h4>
              )}
              <span className="text-xs text-muted-foreground">
                {block.label || "Table"} {hasPagination && `· Página ${currentPage + 1} de ${totalPages}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <DataMindDashboardPinButton
                itemType="table"
                title={block.title || `Tabela ${index + 1}`}
                content={{ headers, rows }}
              />
              <button
                onClick={handleExportSheets}
                disabled={sheetsLoading}
                className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Google Sheets"
              >
                {sheetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleSheetsIcon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => downloadCSV(headers, rows, `tabela_${index + 1}.csv`)}
                className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="Download CSV"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => setFullscreen(true)}
                className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="Tela cheia"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          {renderTable(paginatedRows, currentPage * pageSize)}

          {/* Pagination */}
          {hasPagination && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 bg-muted/10">
              <span className="text-xs text-muted-foreground">
                {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, rows.length)} de {rows.length} linhas
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page = i;
                  if (totalPages > 5) {
                    const start = Math.min(Math.max(currentPage - 2, 0), totalPages - 5);
                    page = start + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        page === currentPage
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {page + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
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
              className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
                <div>
                  {block.title && <h3 className="text-base font-semibold text-foreground">{block.title}</h3>}
                  <span className="text-xs text-muted-foreground">{block.label} · {rows.length} linhas</span>
                </div>
                <button
                  onClick={() => setFullscreen(false)}
                  className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              {renderTable(rows, 0, true)}
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
            <DataMindDashboardPinButton
              itemType="chart"
              title={block.label || `Gráfico ${index + 1}`}
              content={{ base64: block.content }}
            />
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
