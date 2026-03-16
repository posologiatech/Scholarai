import { useState, useRef, useCallback, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { usePyodide } from "@/hooks/usePyodide";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/app/AppSidebar";

import DataSUSResults from "@/components/datasus/DataSUSResults";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Activity, Send, Loader2, Bot, User, Stethoscope,
  Sparkles, Database, BarChart3, MapPin,
} from "lucide-react";
import { EXAMPLE_QUERIES, TABNET_BASES } from "@/lib/datasus-catalog";
import ReactMarkdown from "react-markdown";

interface ParsedTable {
  title: string;
  headers: string[];
  rows: string[][];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  // Analysis results
  explanation?: string;
  dataSource?: string;
  disease?: string;
  location?: string;
  period?: string;
  code?: string;
  stdout?: string;
  images?: string[];
  tables?: ParsedTable[];
  error?: string | null;
  isLoading?: boolean;
}

function parseTables(stdout: string): { cleanStdout: string; tables: ParsedTable[] } {
  const tables: ParsedTable[] = [];
  let cleanStdout = stdout;

  const regex = /__DATATABLE_START__(.+?)__DATATABLE_END__/gs;
  let match;
  while ((match = regex.exec(stdout)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      tables.push({
        title: parsed.title || "Dados",
        headers: parsed.columns || [],
        rows: (parsed.data || []).map((row: Record<string, any>) =>
          (parsed.columns || []).map((col: string) => String(row[col] ?? ""))
        ),
      });
    } catch { /* skip malformed */ }
    cleanStdout = cleanStdout.replace(match[0], "");
  }

  return { cleanStdout: cleanStdout.trim(), tables };
}

export default function DataSUS() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pyodide = usePyodide();
  const pyodideStatusRef = useRef(pyodide.status);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isPt = locale === "pt";

  useEffect(() => {
    pyodideStatusRef.current = pyodide.status;
  }, [pyodide.status]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;

    setInput("");
    setIsProcessing(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const assistantId = crypto.randomUUID();
    const loadingMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: isPt ? "Analisando sua pergunta..." : "Analyzing your question...",
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      // Build conversation history for context
      const historyForAI = messages
        .filter((m) => !m.isLoading)
        .map((m) => ({ role: m.role, content: m.content }));
      historyForAI.push({ role: "user", content: trimmed });

      // Call Edge Function
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datasus-query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: historyForAI }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      if (data.type === "text") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: data.content, isLoading: false }
              : m
          )
        );
        setIsProcessing(false);
        return;
      }

      // data.type === "analysis" — execute Python code
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: isPt ? "Executando análise..." : "Running analysis...",
                explanation: data.explanation,
                dataSource: data.data_source,
                disease: data.disease_or_topic,
                location: data.location,
                period: data.period,
                code: data.code,
              }
            : m
        )
      );

      // Initialize Pyodide if needed
      if (pyodide.status === "idle") {
        pyodide.init();
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (pyodideStatusRef.current === "ready" || pyodideStatusRef.current === "error") {
              clearInterval(interval);
              resolve();
            }
          }, 500);
        });
      }

      if (pyodideStatusRef.current === "error") {
        throw new Error(isPt ? "Falha ao inicializar Pyodide" : "Failed to initialize Pyodide");
      }

      // Run the code
      const result = await pyodide.runPython(data.code);
      const { cleanStdout, tables } = parseTables(result.stdout);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: data.explanation,
                stdout: cleanStdout,
                images: result.images,
                tables,
                error: result.error,
                isLoading: false,
              }
            : m
        )
      );
    } catch (err: any) {
      console.error("DataSUS query error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: isPt
                  ? `Erro ao processar consulta: ${err.message}`
                  : `Error processing query: ${err.message}`,
                isLoading: false,
                error: err.message,
              }
            : m
        )
      );
      toast({
        title: isPt ? "Erro" : "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, messages, isPt, pyodide]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (q: string) => {
    setInput(q);
    textareaRef.current?.focus();
  };

  const examples = isPt ? EXAMPLE_QUERIES.pt : EXAMPLE_QUERIES.en;

  const content = (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-border/40 px-4 py-3 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-sm">
        <Activity className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-base font-bold text-foreground">DataSUS / SINAN</h1>
          <p className="text-xs text-muted-foreground">
            {isPt
              ? "Consulte dados epidemiológicos com linguagem natural"
              : "Query epidemiological data with natural language"}
          </p>
        </div>
        {pyodide.status !== "idle" && (
          <Badge
            variant={pyodide.status === "ready" ? "default" : "secondary"}
            className="ml-auto text-[10px]"
          >
            Pyodide: {pyodide.status}
          </Badge>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 py-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Stethoscope className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="text-center max-w-lg">
              <h2 className="text-lg font-bold text-foreground mb-2">
                {isPt
                  ? "Consulta Inteligente ao DataSUS"
                  : "Smart DataSUS Query"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isPt
                  ? "Faça perguntas sobre dados epidemiológicos do Brasil. O sistema interpreta sua pergunta, busca nos sistemas do DataSUS e gera análises com gráficos automaticamente."
                  : "Ask questions about epidemiological data from Brazil. The system interprets your question, queries DataSUS systems, and generates analyses with charts automatically."}
              </p>
            </div>

            {/* Bases available */}
            <div className="flex flex-wrap gap-2 justify-center">
              {TABNET_BASES.slice(0, 5).map((base) => (
                <Badge key={base.id} variant="outline" className="gap-1 text-xs">
                  <Database className="h-3 w-3" />
                  {isPt ? base.label : base.labelEn}
                </Badge>
              ))}
            </div>

            {/* Example queries */}
            <div className="w-full max-w-xl space-y-2">
              <p className="text-xs font-medium text-muted-foreground text-center">
                {isPt ? "Exemplos de perguntas:" : "Example questions:"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {examples.slice(0, 4).map((q, i) => (
                  <Card
                    key={i}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleExampleClick(q)}
                  >
                    <CardContent className="p-3 flex items-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-xs text-foreground leading-snug">{q}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-1">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
                      : "space-y-3"
                  }`}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {msg.content}
                    </div>
                  ) : msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : msg.code ? (
                    <DataSUSResults
                      explanation={msg.explanation || msg.content}
                      dataSource={msg.dataSource || "DataSUS"}
                      disease={msg.disease || ""}
                      location={msg.location || ""}
                      period={msg.period || ""}
                      code={msg.code}
                      stdout={msg.stdout || ""}
                      images={msg.images || []}
                      tables={msg.tables || []}
                      error={msg.error || null}
                    />
                  ) : (
                    <div className="prose prose-sm max-w-none text-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 mt-1">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border/40 p-4 bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isPt
                ? "Faça uma pergunta sobre dados do DataSUS..."
                : "Ask a question about DataSUS data..."
            }
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
            disabled={isProcessing}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block">
        <AppSidebar>{content}</AppSidebar>
      </div>
      <div className="md:hidden">
        {content}
      </div>
    </>
  );
}
