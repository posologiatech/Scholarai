import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronDown, ChevronUp, Database, MapPin, Calendar, Code2,
  AlertTriangle, TrendingUp,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import ReactMarkdown from "react-markdown";

interface DataSUSResultProps {
  explanation: string;
  dataSource: string;
  disease: string;
  location: string;
  period: string;
  code: string;
  stdout: string;
  images: string[];
  tables: Array<{ title: string; headers: string[]; rows: string[][] }>;
  error: string | null;
}

export default function DataSUSResults({
  explanation, dataSource, disease, location, period, code,
  stdout, images, tables, error,
}: DataSUSResultProps) {
  const [showCode, setShowCode] = useState(false);
  const [expandedTable, setExpandedTable] = useState<number | null>(null);
  const { locale } = useLanguage();
  const isPt = locale === "pt";

  return (
    <div className="space-y-4 w-full">
      {/* Metadata pills */}
      <div className="flex flex-wrap gap-1.5">
        {dataSource && (
          <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 text-[11px] font-medium rounded-lg px-2.5 py-0.5">
            <Database className="h-3 w-3" />
            {dataSource}
          </Badge>
        )}
        {disease && (
          <Badge className="gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15 text-[11px] font-medium rounded-lg px-2.5 py-0.5">
            <TrendingUp className="h-3 w-3" />
            {disease}
          </Badge>
        )}
        {location && (
          <Badge className="gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15 text-[11px] font-medium rounded-lg px-2.5 py-0.5">
            <MapPin className="h-3 w-3" />
            {location}
          </Badge>
        )}
        {period && (
          <Badge className="gap-1.5 bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/15 text-[11px] font-medium rounded-lg px-2.5 py-0.5">
            <Calendar className="h-3 w-3" />
            {period}
          </Badge>
        )}
      </div>

      {/* Explanation */}
      <div className="text-sm text-foreground/90 leading-relaxed prose prose-sm max-w-none prose-p:my-1.5 prose-headings:text-foreground prose-strong:text-foreground">
        <ReactMarkdown>{explanation}</ReactMarkdown>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/5 border border-destructive/15">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <pre className="text-xs text-destructive/90 font-mono whitespace-pre-wrap flex-1">{error}</pre>
        </div>
      )}

      {/* Stdout */}
      {stdout && (
        <div className="rounded-xl bg-muted/40 border border-border/30 p-4 overflow-hidden">
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">
            {stdout}
          </pre>
        </div>
      )}

      {/* Tables */}
      {tables.map((table, idx) => {
        const isExpanded = expandedTable === idx;
        const displayRows = isExpanded ? table.rows : table.rows.slice(0, 10);
        return (
          <div key={idx} className="rounded-xl border border-border/30 overflow-hidden bg-background">
            {table.title && (
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border/20">
                <h4 className="text-xs font-semibold text-foreground/80">{table.title}</h4>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {table.headers.map((h, i) => (
                      <TableHead key={i} className="bg-muted/20 text-[11px] font-semibold text-foreground/60 uppercase tracking-wider h-8 whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((row, ri) => (
                    <TableRow key={ri} className={ri % 2 === 0 ? "bg-transparent" : "bg-muted/10"}>
                      {row.map((cell, ci) => (
                        <TableCell
                          key={ci}
                          className={`text-xs py-2 px-3 whitespace-nowrap ${
                            !isNaN(Number(cell)) && cell.trim() !== "" ? "text-right font-mono tabular-nums" : ""
                          }`}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {table.rows.length > 10 && (
              <button
                onClick={() => setExpandedTable(isExpanded ? null : idx)}
                className="w-full py-2 text-[11px] font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border/20"
              >
                {isExpanded
                  ? (isPt ? "Mostrar menos" : "Show less")
                  : (isPt ? `Ver todas as ${table.rows.length} linhas` : `View all ${table.rows.length} rows`)}
              </button>
            )}
          </div>
        );
      })}

      {/* Charts */}
      {images.map((img, idx) => (
        <div key={idx} className="rounded-xl overflow-hidden border border-border/30 bg-background">
          <img
            src={`data:image/png;base64,${img}`}
            alt={`Chart ${idx + 1}`}
            className="w-full"
          />
        </div>
      ))}

      {/* Source */}
      {(stdout || images.length > 0 || tables.length > 0) && (
        <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
          <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/30" />
          Fonte: {dataSource}/DataSUS — Dados simulados com base em padrões epidemiológicos reais
        </p>
      )}

      {/* Code toggle */}
      {code && (
        <div>
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
          >
            <Code2 className="h-3 w-3" />
            {showCode ? (isPt ? "Ocultar código" : "Hide code") : (isPt ? "Ver código" : "Show code")}
            {showCode ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showCode && (
            <pre className="mt-2 p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl text-[11px] font-mono overflow-x-auto max-h-[400px] overflow-y-auto border border-border/20 leading-relaxed text-foreground/70">
              {code}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
