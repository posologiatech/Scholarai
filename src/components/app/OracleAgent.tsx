import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Sparkles, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ORACLE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

const SUGGESTIONS_PT = [
  "Como faço uma busca semântica?",
  "Qual ferramenta usar para revisão sistemática?",
  "Como analisar dados no DataMind?",
];

const SUGGESTIONS_EN = [
  "How do I do a semantic search?",
  "Which tool for systematic review?",
  "How to analyze data in DataMind?",
];

const OracleAgent = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pt = locale === "pt";
  const suggestions = pt ? SUGGESTIONS_PT : SUGGESTIONS_EN;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;

      const resp = await fetch(ORACLE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
        },
        body: JSON.stringify({ messages: newMessages, locale }),
      });

      if (!resp.ok || !resp.body) throw new Error("Oracle failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
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
              setMessages((prev) => {
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
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: pt
            ? "Desculpe, ocorreu um erro. Tente novamente."
            : "Sorry, an error occurred. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Don't show on public pages without auth
  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
          open
            ? "bg-muted text-muted-foreground rotate-0"
            : "bg-primary text-primary-foreground"
        }`}
        aria-label={pt ? "Abrir Oráculo" : "Open Oracle"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[9998] flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-primary/5 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                {pt ? "Oráculo ScholarAI" : "ScholarAI Oracle"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {pt ? "Pergunte qualquer coisa sobre o sistema" : "Ask anything about the system"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full space-y-5 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {pt ? "Olá! Sou o Oráculo do ScholarAI." : "Hi! I'm the ScholarAI Oracle."}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[260px]">
                    {pt
                      ? "Pergunte sobre funcionalidades, ferramentas ou como usar qualquer recurso do sistema."
                      : "Ask about features, tools, or how to use any system resource."}
                  </p>
                </div>
                <div className="w-full space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="block w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-left text-xs text-foreground hover:bg-muted hover:border-primary/30 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <div className="prose prose-sm max-w-none text-foreground [&_p]:mb-1.5 [&_ul]:mb-1.5 [&_ol]:mb-1.5 [&_li]:mb-0.5 [&_strong]:text-foreground [&_a]:text-primary">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {loading && i === messages.length - 1 && (
                          <span className="inline-block h-3.5 w-0.5 animate-pulse bg-primary ml-0.5 rounded" />
                        )}
                      </div>
                    ) : loading && i === messages.length - 1 ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-xs">{pt ? "Pensando..." : "Thinking..."}</span>
                      </div>
                    ) : null
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pt ? "Pergunte sobre o ScholarAI..." : "Ask about ScholarAI..."}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 max-h-24"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {pt ? "Especializado apenas no ScholarAI" : "Specialized in ScholarAI only"}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default OracleAgent;
