import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Loader2, Send, Info, Sparkles, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface ColumnDef {
  name: string;
  description?: string;
  enabled: boolean;
  isCustom?: boolean;
  prompt?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Paper {
  id?: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  doi?: string;
  journal?: string;
}

interface ColumnsPanelProps {
  suggestedColumns: ColumnDef[];
  onColumnsChange: (columns: ColumnDef[]) => void;
  papers?: Paper[];
  query?: string;
  papersLoading?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-papers`;

const ColumnsPanel = ({ suggestedColumns, onColumnsChange, papers = [], query = "", papersLoading = false }: ColumnsPanelProps) => {
  const { locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<"chat" | "columns">("chat");
  const [newColumnName, setNewColumnName] = useState("");

  // Custom column prompt dialog
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [pendingColumnName, setPendingColumnName] = useState("");
  const [columnPrompt, setColumnPrompt] = useState("");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Proactive synthesis state
  const [synthesis, setSynthesis] = useState("");
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthCopied, setSynthCopied] = useState(false);
  const hasSynthesized = useRef(false);

  const customColumns = suggestedColumns.filter((c) => c.isCustom);
  const suggested = suggestedColumns.filter((c) => !c.isCustom);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, synthesis]);

  // Proactive synthesis: auto-trigger when papers load
  useEffect(() => {
    if (papersLoading || papers.length === 0 || hasSynthesized.current) return;
    hasSynthesized.current = true;
    streamSynthesis();
  }, [papersLoading, papers]);

  const streamSynthesis = async () => {
    setSynthLoading(true);
    setSynthesis("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/synthesize-papers`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ query, papers: papers.slice(0, 15), locale }),
      });

      if (!resp.ok || !resp.body) throw new Error("Synthesis failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setSynthesis(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error("Synthesis error:", err);
    } finally {
      setSynthLoading(false);
    }
  };

  const handleCopySynthesis = () => {
    navigator.clipboard.writeText(synthesis);
    setSynthCopied(true);
    setTimeout(() => setSynthCopied(false), 2000);
  };

  const toggleColumn = (name: string) => {
    const updated = suggestedColumns.map((c) =>
      c.name === name ? { ...c, enabled: !c.enabled } : c
    );
    onColumnsChange(updated);
  };

  const handleAddCustomColumn = () => {
    if (!newColumnName.trim()) return;
    setPendingColumnName(newColumnName.trim());
    setColumnPrompt("");
    setShowPromptDialog(true);
    setNewColumnName("");
  };

  const confirmCustomColumn = () => {
    if (!pendingColumnName) return;
    const updated = [
      ...suggestedColumns,
      {
        name: pendingColumnName,
        description: columnPrompt || pendingColumnName,
        prompt: columnPrompt || undefined,
        enabled: true,
        isCustom: true,
      },
    ];
    onColumnsChange(updated);
    setShowPromptDialog(false);
    setPendingColumnName("");
    setColumnPrompt("");
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tk}`,
        },
        body: JSON.stringify({
          query,
          papers: papers.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            year: p.year,
            abstract: p.abstract,
            doi: p.doi,
            journal: p.journal,
          })),
          messages: newMessages,
          locale,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Chat failed");

      // Stream the response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      // Add empty assistant message
      setChatMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullText };
                return updated;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullText };
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setChatMessages([
        ...newMessages,
        {
          role: "assistant",
          content: locale === "pt" ? "Erro ao processar. Tente novamente." : "Error processing. Try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
      <div className="flex h-full w-80 flex-col border-l border-border bg-card">
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "chat"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {locale === "pt" ? "Chat com papers" : "Chat with papers"}
          </button>
          <button
            onClick={() => setActiveTab("columns")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "columns"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {locale === "pt" ? "Editar colunas" : "Edit columns"}
          </button>
        </div>

        {activeTab === "columns" ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Custom columns */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {locale === "pt" ? "Colunas customizadas" : "Custom columns"}
              </h4>
              {customColumns.map((col) => (
                <div key={col.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{col.name}</span>
                    {col.prompt && (
                      <span title={col.prompt}>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={col.enabled}
                      onCheckedChange={() => toggleColumn(col.name)}
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              <div
                className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const input = document.getElementById("custom-col-input");
                  input?.focus();
                }}
              >
                <Input
                  id="custom-col-input"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomColumn()}
                  placeholder={locale === "pt" ? "+ Adicionar nova..." : "+ Add new..."}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Suggested columns */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {locale === "pt" ? "Colunas sugeridas" : "Suggested columns"}
                </h4>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              {suggested.map((col) => (
                <div key={col.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm text-foreground truncate">{col.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={col.enabled}
                      onCheckedChange={() => toggleColumn(col.name)}
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {suggested.length === 0 && (
                <p className="text-xs text-muted-foreground/60">
                  {locale === "pt"
                    ? "Nenhuma sugestão disponível"
                    : "No suggestions available"}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Chat tab */
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {locale === "pt"
                      ? "Faça perguntas sobre os papers encontrados"
                      : "Ask questions about the papers found"}
                  </p>
                  <div className="space-y-1.5">
                    {(locale === "pt" ? [
                      "Quais são os principais resultados?",
                      "Compare as metodologias utilizadas",
                      "Quais são as limitações dos estudos?",
                    ] : [
                      "What are the main findings?",
                      "Compare the methodologies used",
                      "What are the study limitations?",
                    ]).map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setChatInput(suggestion);
                        }}
                        className="block w-full text-left rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "ml-6 rounded-lg bg-primary/10 p-3 text-foreground"
                      : "text-foreground/80"
                  }`}
                >
                  {msg.content ? (
                    msg.content.split("\n").map((line, j) => (
                      <p key={j} className={j > 0 ? "mt-2" : ""}>
                        {line}
                      </p>
                    ))
                  ) : (
                    chatLoading && i === chatMessages.length - 1 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {locale === "pt" ? "Buscando nos papers..." : "Searching papers..."}
                      </div>
                    )
                  )}
                  {chatLoading && i === chatMessages.length - 1 && msg.content && (
                    <span className="inline-block h-4 w-1 animate-pulse bg-primary ml-0.5" />
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
                  placeholder={
                    locale === "pt"
                      ? "Pergunte sobre os papers..."
                      : "Ask about the papers..."
                  }
                  className="text-sm"
                  disabled={chatLoading}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom column prompt dialog */}
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locale === "pt"
                ? `Configurar coluna: ${pendingColumnName}`
                : `Configure column: ${pendingColumnName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {locale === "pt"
                ? "Descreva o que deseja extrair de cada paper para esta coluna:"
                : "Describe what you want to extract from each paper for this column:"}
            </p>
            <Textarea
              value={columnPrompt}
              onChange={(e) => setColumnPrompt(e.target.value)}
              placeholder={
                locale === "pt"
                  ? "Ex: Extraia o tamanho da amostra e a metodologia utilizada no estudo..."
                  : "E.g.: Extract the sample size and methodology used in the study..."
              }
              rows={4}
              className="text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromptDialog(false)}>
              {locale === "pt" ? "Cancelar" : "Cancel"}
            </Button>
            <Button onClick={confirmCustomColumn}>
              {locale === "pt" ? "Adicionar coluna" : "Add column"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ColumnsPanel;
