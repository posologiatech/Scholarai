import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { usePyodide } from "@/hooks/usePyodide";
import { supabase } from "@/integrations/supabase/client";

import DataSUSResults from "@/components/datasus/DataSUSResults";
import DataSUSSidebar, { DataSUSConversation } from "@/components/datasus/DataSUSSidebar";
import DataSUSSourcesPanel from "@/components/datasus/DataSUSSourcesPanel";
import DataSUSAlertsDashboard from "@/components/datasus/DataSUSAlertsDashboard";
import DataSUSBulletinGenerator from "@/components/datasus/DataSUSBulletinGenerator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Send, Loader2, Bot, User, Stethoscope,
  Sparkles, Database, BrainCircuit, PanelLeftOpen, PanelLeftClose,
  Activity, HeartPulse, Microscope, BarChart3, BellRing, FileText,
} from "lucide-react";
import { EXAMPLE_QUERIES, TABNET_BASES } from "@/lib/datasus-catalog";
import ReactMarkdown from "react-markdown";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";

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
  const [activeTab, setActiveTab] = useState("chat");
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
    setActiveTab("chat");
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

  const startNewConversation = () => { setActiveConvId(null); setMessages([]); setActiveTab("chat"); };

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

    // Bring the real underlying dataset along as an actual attached file (not just a text
    // snippet), so DataMind loads it as a genuine `df` and runs real code against it instead
    // of the LLM improvising numbers from a truncated stdout excerpt.
    let fileNote = "";
    if (msg.code && msg.isRealData) {
      const csvMatch = msg.code.match(/REAL_DATA_CSV\s*=\s*("(?:[^"\\]|\\.)*")/);
      const csv = csvMatch ? (() => { try { return JSON.parse(csvMatch[1]) as string; } catch { return null; } })() : null;
      if (csv) {
        const lines = csv.split("\n").filter((l) => l.length > 0);
        const columns = (lines[0] || "").split(",").map((h) => h.trim().replace(/"/g, ""));
        const dataLines = lines.slice(1);
        const previewData = dataLines.slice(0, 5).map((line) => {
          const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          const row: Record<string, string> = {};
          columns.forEach((h, i) => (row[h] = vals[i] || ""));
          return row;
        });
        const fileName = `datasus_${(msg.disease || msg.dataSource || "dados").replace(/[^a-zA-Z0-9]+/g, "_")}.csv`;
        const filePath = `${user.id}/${Date.now()}_${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("datamind-files")
          .upload(filePath, new Blob([csv], { type: "text/csv" }));
        if (!uploadError) {
          await supabase.from("datamind_files").insert([{
            conversation_id: conv.id,
            user_id: user.id,
            file_name: fileName,
            file_path: filePath,
            file_size: csv.length,
            schema_info: { columns, rows: dataLines.length } as any,
            preview_data: previewData as any,
          }]);
          fileNote = `\n\n📎 Dataset real anexado como **${fileName}** (${dataLines.length} linhas, fonte: ${msg.dataSourceDetail || msg.dataSource || "DataSUS"}) — já carregado como \`df\` para análise real.`;
        }
      }
    }

    const contextContent = [
      `## Contexto importado do DataSUS/SINAN`,
      msg.explanation ? `\n**Análise:** ${msg.explanation}` : "",
      msg.dataSource ? `**Fonte:** ${msg.dataSource}` : "",
      msg.disease ? `**Agravo:** ${msg.disease}` : "",
      msg.location ? `**Local:** ${msg.location}` : "",
      msg.period ? `**Período:** ${msg.period}` : "",
      !fileNote && msg.stdout ? `\n**Saída da consulta original:**\n\`\`\`\n${msg.stdout.slice(0, 2000)}\n\`\`\`` : "",
      fileNote,
    ].filter(Boolean).join("\n");
    await supabase.from("datamind_messages").insert({
      conversation_id: conv.id, role: "assistant",
      content: contextContent, code_block: null,
    });
    toast({
      title: isPt ? "Enviado para DataMind" : "Sent to DataMind",
      description: fileNote
        ? (isPt ? "Dados reais anexados ao DataMind — pronto para análise real." : "Real data attached to DataMind — ready for real analysis.")
        : (isPt ? "Nova análise criada no DataMind com os dados desta consulta." : "New analysis created in DataMind with this query data."),
    });
    navigate(`/datamind/${conv.id}`);
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
    setActiveTab("chat");
    inputRef.current?.focus();
  };

  const examples = isPt ? EXAMPLE_QUERIES.pt : EXAMPLE_QUERIES.en;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex h-screen bg-background">
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

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-border/20 px-4 flex items-center gap-2 shrink-0 bg-background">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="h-8 bg-muted/30 rounded-lg p-0.5">
              <TabsTrigger value="chat" className="text-xs h-7 rounded-md px-3 gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                {isPt ? "Consulta" : "Query"}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs h-7 rounded-md px-3 gap-1.5">
                <BellRing className="h-3.5 w-3.5" />
                {isPt ? "Alertas" : "Alerts"}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {activeConvId && activeTab === "chat" && (
            <LinkToProjectButton
              resourceType="datasus"
              resourceId={activeConvId}
              label={conversations.find((c) => c.id === activeConvId)?.title || "Análise DataSUS"}
              size="sm"
              variant="ghost"
            />
          )}

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
        {activeTab === "alerts" ? (
          <ScrollArea className="flex-1">
            <div className="max-w-5xl mx-auto px-6 py-6">
              <DataSUSAlertsDashboard isPt={isPt} />
            </div>
          </ScrollArea>
        ) : (
          <>
            <ScrollArea className="flex-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-6">
                  <div className="max-w-2xl w-full space-y-8">
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

                    <DataSUSSourcesPanel isPt={isPt} />

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
                      <div className={`max-w-[85%] ${msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2.5"
                        : "bg-muted/30 border border-border/20 rounded-2xl rounded-tl-md px-4 py-3"
                      }`}>
                        {msg.isLoading ? (
                          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {msg.content}
                          </div>
                        ) : msg.code && msg.role === "assistant" ? (
                          <div className="space-y-3">
                            <DataSUSResults
                              explanation={msg.explanation || msg.content}
                              dataSource={msg.dataSource || ""}
                              disease={msg.disease || ""}
                              location={msg.location || ""}
                              period={msg.period || ""}
                              code={msg.code || ""}
                              stdout={msg.stdout || ""}
                              images={msg.images || []}
                              tables={msg.tables || []}
                              error={msg.error || null}
                              isRealData={msg.isRealData}
                              dataSourceDetail={msg.dataSourceDetail}
                            />
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px] text-muted-foreground hover:text-primary gap-1.5 rounded-lg"
                                onClick={() => sendToDataMind(msg)}
                              >
                                <BrainCircuit className="h-3.5 w-3.5" />
                                {isPt ? "Analisar no DataMind" : "Analyze in DataMind"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:text-foreground prose-strong:text-foreground">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="shrink-0 mt-1">
                          <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={scrollRef} />

                  {/* Bulletin generator at bottom of conversation */}
                  {messages.some(m => m.role === "assistant" && (m.stdout || m.images?.length)) && (
                    <DataSUSBulletinGenerator isPt={isPt} messages={messages} />
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-border/20 p-4 bg-background shrink-0">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={isPt
                        ? "Pergunte sobre dados epidemiológicos do Brasil..."
                        : "Ask about Brazilian epidemiological data..."}
                      className="w-full resize-none bg-muted/30 border border-border/30 rounded-2xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all min-h-[44px] max-h-[160px] leading-relaxed"
                      rows={1}
                      disabled={isProcessing}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isProcessing}
                      size="icon"
                      className="absolute right-2 bottom-2 h-8 w-8 rounded-xl shadow-sm"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
