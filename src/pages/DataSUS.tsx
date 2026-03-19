import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { usePyodide } from "@/hooks/usePyodide";
import { supabase } from "@/integrations/supabase/client";

import DataSUSResults from "@/components/datasus/DataSUSResults";
import DataSUSSidebar, { DataSUSConversation } from "@/components/datasus/DataSUSSidebar";
import DataSUSSourcesPanel from "@/components/datasus/DataSUSSourcesPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  Send, Loader2, Bot, User, Stethoscope,
  Sparkles, Database, BrainCircuit, PanelLeftOpen, PanelLeftClose,
  Activity, HeartPulse, Microscope, BarChart3,
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
  isRealData?: boolean;
  dataSourceDetail?: string;
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
    } catch { /* skip */ }
    cleanStdout = cleanStdout.replace(match[0], "");
  }
  return { cleanStdout: cleanStdout.trim(), tables };
}

const EXAMPLE_ICONS = [HeartPulse, Microscope, BarChart3, Activity];

export default function DataSUS() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pyodide = usePyodide();
  const pyodideStatusRef = useRef(pyodide.status);
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<DataSUSConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isPt = locale === "pt";

  useEffect(() => { pyodideStatusRef.current = pyodide.status; }, [pyodide.status]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    const { data } = await (supabase as any)
      .from("datasus_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  };

  const selectConversation = async (id: string) => {
    setActiveConvId(id);
    const { data } = await (supabase as any)
      .from("datasus_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(
        data.map((m: any) => ({
          id: m.id, role: m.role, content: m.content,
          explanation: m.explanation, dataSource: m.data_source,
          disease: m.disease, location: m.location, period: m.period,
          code: m.code, stdout: m.stdout,
          images: m.images || [], tables: m.tables_data || [],
          error: m.error,
        }))
      );
    }
  };

  const startNewConversation = () => { setActiveConvId(null); setMessages([]); };

  const deleteConversation = async (id: string) => {
    await (supabase as any).from("datasus_conversations").delete().eq("id", id);
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const renameConversation = async (id: string, newTitle: string) => {
    await (supabase as any).from("datasus_conversations").update({ title: newTitle }).eq("id", id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
  };

  const saveMessage = async (convId: string, msg: ChatMessage) => {
    await (supabase as any).from("datasus_messages").insert({
      id: msg.id, conversation_id: convId, role: msg.role, content: msg.content,
      explanation: msg.explanation || null, data_source: msg.dataSource || null,
      disease: msg.disease || null, location: msg.location || null,
      period: msg.period || null, code: msg.code || null,
      stdout: msg.stdout || null, images: msg.images || [],
      tables_data: msg.tables || [], error: msg.error || null,
    });
  };

  const sendToDataMind = async (msg: ChatMessage) => {
    if (!user) return;
    const { data: conv } = await supabase
      .from("datamind_conversations")
      .insert({ user_id: user.id, title: `DataSUS: ${msg.disease || msg.dataSource || "Análise"}` })
      .select("id").single();
    if (!conv) return;
    const contextContent = [
      `## Contexto importado do DataSUS/SINAN`,
      msg.explanation ? `\n**Análise:** ${msg.explanation}` : "",
      msg.dataSource ? `**Fonte:** ${msg.dataSource}` : "",
      msg.disease ? `**Agravo:** ${msg.disease}` : "",
      msg.location ? `**Local:** ${msg.location}` : "",
      msg.period ? `**Período:** ${msg.period}` : "",
      msg.stdout ? `\n**Dados:**\n\`\`\`\n${msg.stdout.slice(0, 2000)}\n\`\`\`` : "",
    ].filter(Boolean).join("\n");
    await supabase.from("datamind_messages").insert({
      conversation_id: conv.id, role: "assistant",
      content: contextContent, code_block: msg.code || null,
    });
    toast({
      title: isPt ? "Enviado para DataMind" : "Sent to DataMind",
      description: isPt ? "Nova análise criada no DataMind com os dados desta consulta." : "New analysis created in DataMind with this query data.",
    });
    navigate(`/datamind?conversation=${conv.id}`);
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing || !user) return;
    setInput("");
    setIsProcessing(true);

    let convId = activeConvId;
    if (!convId) {
      const title = trimmed.length > 60 ? trimmed.slice(0, 57) + "..." : trimmed;
      const { data: newConv } = await (supabase as any)
        .from("datasus_conversations")
        .insert({ user_id: user.id, title })
        .select("id, title, updated_at").single();
      if (!newConv) { setIsProcessing(false); return; }
      convId = newConv.id;
      setActiveConvId(convId);
      setConversations((prev) => [newConv, ...prev]);
    } else {
      await (supabase as any).from("datasus_conversations")
        .update({ updated_at: new Date().toISOString() }).eq("id", convId);
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantId = crypto.randomUUID();
    const loadingMsg: ChatMessage = {
      id: assistantId, role: "assistant",
      content: isPt ? "Analisando sua pergunta..." : "Analyzing your question...",
      isLoading: true,
    };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    await saveMessage(convId, userMsg);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const historyForAI = messages.filter((m) => !m.isLoading).map((m) => ({ role: m.role, content: m.content }));
      historyForAI.push({ role: "user", content: trimmed });

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datasus-query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForAI }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();

      if (data.type === "text") {
        const finalMsg: ChatMessage = { id: assistantId, role: "assistant", content: data.content };
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? finalMsg : m)));
        await saveMessage(convId, finalMsg);
        setIsProcessing(false);
        return;
      }

      if (data.type === "unavailable") {
        const sourcesInfo = (data.available_sources || [])
          .map((s: any) => `• **${s.name}**: ${s.topics} (${s.period})`)
          .join("\n");
        const unavailableContent = `⚠️ ${data.explanation}\n\n**Fontes disponíveis:**\n${sourcesInfo}\n\n💡 ${data.suggestion || ""}`;
        const finalMsg: ChatMessage = { id: assistantId, role: "assistant", content: unavailableContent };
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? finalMsg : m)));
        await saveMessage(convId, finalMsg);
        setIsProcessing(false);
        return;
      }

      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? {
          ...m, content: isPt ? "Executando análise..." : "Running analysis...",
          explanation: data.explanation, dataSource: data.data_source,
          disease: data.disease_or_topic, location: data.location,
          period: data.period, code: data.code,
          isRealData: data.is_real_data, dataSourceDetail: data.data_source_detail,
        } : m
      ));

      if (pyodide.status === "idle") {
        pyodide.init();
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (pyodideStatusRef.current === "ready" || pyodideStatusRef.current === "error") {
              clearInterval(interval); resolve();
            }
          }, 500);
        });
      }
      if (pyodideStatusRef.current === "error") {
        throw new Error(isPt ? "Falha ao inicializar Pyodide" : "Failed to initialize Pyodide");
      }

      const result = await pyodide.runPython(data.code);
      const { cleanStdout, tables } = parseTables(result.stdout);
      const finalMsg: ChatMessage = {
        id: assistantId, role: "assistant", content: data.explanation,
        explanation: data.explanation, dataSource: data.data_source,
        disease: data.disease_or_topic, location: data.location,
        period: data.period, code: data.code, stdout: cleanStdout,
        images: result.images, tables, error: result.error,
        isRealData: data.is_real_data, dataSourceDetail: data.data_source_detail,
      };
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? finalMsg : m)));
      await saveMessage(convId, finalMsg);
    } catch (err: any) {
      console.error("DataSUS query error:", err);
      const errorMsg: ChatMessage = {
        id: assistantId, role: "assistant",
        content: isPt ? `Erro ao processar consulta: ${err.message}` : `Error processing query: ${err.message}`,
        error: err.message,
      };
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? errorMsg : m)));
      await saveMessage(convId!, errorMsg);
      toast({ title: isPt ? "Erro" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, messages, isPt, pyodide, user, activeConvId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleExampleClick = (q: string) => {
    setInput(q);
    inputRef.current?.focus();
  };

  const examples = isPt ? EXAMPLE_QUERIES.pt : EXAMPLE_QUERIES.en;

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      {sidebarOpen && (
        <DataSUSSidebar
          conversations={conversations}
          activeId={activeConvId || undefined}
          onSelect={selectConversation}
          onNew={startNewConversation}
          onDelete={deleteConversation}
          onRename={renameConversation}
          isPt={isPt}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal header */}
        <div className="h-12 border-b border-border/20 px-4 flex items-center gap-2 shrink-0 bg-background">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>

          <div className="flex-1" />

          {pyodide.status !== "idle" && (
            <Badge
              variant="outline"
              className={`text-[10px] rounded-full px-2.5 py-0.5 font-medium ${
                pyodide.status === "ready"
                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                  : "border-amber-500/30 text-amber-600 bg-amber-500/5"
              }`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${
                pyodide.status === "ready" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              }`} />
              Pyodide {pyodide.status === "ready" ? "✓" : "..."}
            </Badge>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            /* Empty state — welcome screen */
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-6">
              <div className="max-w-2xl w-full space-y-8">
                {/* Hero */}
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 mx-auto">
                    <Stethoscope className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {isPt ? "Consulta Inteligente" : "Smart Query"}
                    </h1>
                    <h2 className="text-lg text-muted-foreground font-normal mt-1">
                      DataSUS / SINAN
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
                    {isPt
                      ? "Faça perguntas sobre dados epidemiológicos do Brasil em linguagem natural. Gráficos e tabelas são gerados automaticamente."
                      : "Ask about Brazilian epidemiological data in natural language. Charts and tables are generated automatically."}
                  </p>
                </div>

                {/* Sources panel */}
                <DataSUSSourcesPanel isPt={isPt} />

                {/* Example cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {examples.slice(0, 4).map((q, i) => {
                    const Icon = EXAMPLE_ICONS[i % EXAMPLE_ICONS.length];
                    return (
                      <button
                        key={i}
                        onClick={() => handleExampleClick(q)}
                        className="group text-left p-4 rounded-2xl border border-border/30 bg-background hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-200 hover:shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-xl bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <span className="text-[13px] text-foreground/80 group-hover:text-foreground leading-snug transition-colors">
                            {q}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="shrink-0 mt-1">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                  <div className={`${
                    msg.role === "user"
                      ? "max-w-[75%] bg-primary text-primary-foreground rounded-2xl rounded-br-lg px-4 py-3"
                      : "flex-1 max-w-[90%] space-y-3"
                  }`}>
                    {msg.isLoading ? (
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                          <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                          <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                        </div>
                        <span className="text-sm text-muted-foreground">{msg.content}</span>
                      </div>
                    ) : msg.role === "user" ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : msg.code ? (
                      <div className="space-y-3">
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
                          isRealData={msg.isRealData}
                          dataSourceDetail={msg.dataSourceDetail}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs rounded-xl h-8 border-border/30 hover:border-primary/30 hover:text-primary"
                          onClick={() => sendToDataMind(msg)}
                        >
                          <BrainCircuit className="h-3.5 w-3.5" />
                          {isPt ? "Aprofundar no DataMind" : "Deep dive in DataMind"}
                        </Button>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none text-foreground/90">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 mt-1">
                      <div className="h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center">
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
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end rounded-2xl border border-border/30 bg-background shadow-sm focus-within:border-primary/30 focus-within:shadow-md transition-all duration-200">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isPt ? "Faça uma pergunta sobre dados epidemiológicos..." : "Ask about epidemiological data..."}
                className="flex-1 resize-none bg-transparent py-3.5 pl-4 pr-14 text-sm placeholder:text-muted-foreground/50 focus:outline-none max-h-[160px] min-h-[48px] leading-relaxed"
                rows={1}
                disabled={isProcessing}
              />
              <div className="absolute right-2 bottom-2">
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isProcessing}
                  className="h-9 w-9 rounded-xl shadow-sm"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
              {isPt
                ? "Apenas dados reais das fontes integradas são retornados"
                : "Only real data from integrated sources is returned"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
