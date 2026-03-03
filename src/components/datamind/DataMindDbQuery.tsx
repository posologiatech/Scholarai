import { useState } from "react";
import { Database, Send, Loader2, Code2, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  schema_cache: any;
}

interface QueryResult {
  sql?: string;
  columns: string[];
  rows: any[][];
  rowCount: number;
}

interface Props {
  connection: DbConnection;
  onResultToChat?: (question: string, sql: string, result: QueryResult) => void;
}

const DataMindDbQuery = ({ connection, onResultToChat }: Props) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [generatedSql, setGeneratedSql] = useState("");
  const [showSql, setShowSql] = useState(false);
  const [mode, setMode] = useState<"nl" | "sql">("nl");

  const executeQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const body = mode === "nl"
        ? { action: "nl2sql", connection_id: connection.id, question: question.trim() }
        : { action: "query", connection_id: connection.id, query: question.trim() };

      const { data, error } = await supabase.functions.invoke("datamind-db", { body });

      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast({ title: "Erro na consulta", description: data.error, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (data?.sql) setGeneratedSql(data.sql);
      setResult({
        sql: data?.sql,
        columns: data?.columns || [],
        rows: data?.rows || [],
        rowCount: data?.rowCount || 0,
      });
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao executar consulta", variant: "destructive" });
    }
    setLoading(false);
  };

  const sendToChat = () => {
    if (result && onResultToChat) {
      onResultToChat(question, generatedSql, result);
    }
  };

  return (
    <div className="border border-border/40 rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/20">
        <Database className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">{connection.name}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{connection.db_type}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setMode("nl")}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${mode === "nl" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Linguagem Natural
          </button>
          <button
            onClick={() => setMode("sql")}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${mode === "sql" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            SQL Direto
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="p-3">
        <div className="flex gap-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={mode === "nl" ? "Ex: Quais são os 10 clientes com mais pedidos?" : "SELECT * FROM ..."}
            className="min-h-[60px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); executeQuery(); }
            }}
          />
          <Button
            onClick={executeQuery}
            disabled={loading || !question.trim()}
            size="sm"
            className="self-end"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Generated SQL */}
      {generatedSql && mode === "nl" && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowSql(!showSql)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Code2 className="h-3 w-3" />
            {showSql ? "Ocultar SQL" : "Ver SQL gerado"}
          </button>
          {showSql && (
            <pre className="mt-1 text-[11px] bg-muted/30 rounded-md p-2 overflow-x-auto text-muted-foreground font-mono">
              {generatedSql}
            </pre>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="border-t border-border/30">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              <TableIcon className="h-3 w-3 inline mr-1" />
              {result.rowCount} {result.rowCount === 1 ? "linha" : "linhas"} · {result.columns.length} colunas
            </span>
            {onResultToChat && (
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={sendToChat}>
                Enviar para Chat
              </Button>
            )}
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/50 border-b border-border/50">
                  {result.columns.map((col, i) => (
                    <th key={i} className="py-2 px-3 text-left font-semibold text-foreground/80 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 100).map((row, ri) => (
                  <tr key={ri} className={`border-b border-border/15 ${ri % 2 === 0 ? "" : "bg-muted/20"}`}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-1.5 px-3 text-foreground/90 whitespace-nowrap max-w-[200px] truncate">
                        {cell === null ? <span className="text-muted-foreground/40">NULL</span> : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length > 100 && (
              <p className="text-xs text-muted-foreground text-center py-2">Mostrando 100 de {result.rowCount} linhas</p>
            )}
          </div>
        </div>
      )}

      {/* Schema preview */}
      {connection.schema_cache && !result && (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-muted-foreground/60 mb-1">Tabelas disponíveis:</p>
          <div className="flex flex-wrap gap-1">
            {(connection.schema_cache as any[]).slice(0, 15).map((t: any, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {t.table}
              </Badge>
            ))}
            {(connection.schema_cache as any[]).length > 15 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{(connection.schema_cache as any[]).length - 15}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataMindDbQuery;
