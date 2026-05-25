import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles, Send, X, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  projectTitle: string;
}

const SUGGESTIONS_PT = [
  "Resuma o estado atual do projeto para o comitê.",
  "Quais tarefas estão em risco?",
  "Que pontos pendentes ainda não foram fechados nas reuniões?",
  "Sugira a pauta da próxima reunião.",
  "Quais lacunas existem no texto do projeto?",
];
const SUGGESTIONS_EN = [
  "Summarize the current state of the project for the committee.",
  "Which tasks are at risk?",
  "Which open items haven't been closed in meetings?",
  "Suggest the agenda for the next meeting.",
  "What gaps exist in the project body?",
];

export const ResearchCopilot = ({ projectId, projectTitle }: Props) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["copilot-msgs", projectId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_copilot_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    try {
      // Save user message
      await supabase.from("research_copilot_messages").insert({
        project_id: projectId, user_id: user!.id, role: "user", content: msg,
      });
      qc.invalidateQueries({ queryKey: ["copilot-msgs", projectId] });

      // Build full conversation history for the model
      const fullMessages = [
        ...history.map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: msg },
      ];

      const { data, error } = await supabase.functions.invoke("research-project-copilot", {
        body: { project_id: projectId, messages: fullMessages, locale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reply = data?.reply ?? "";
      await supabase.from("research_copilot_messages").insert({
        project_id: projectId, user_id: user!.id, role: "assistant", content: reply,
      });
      qc.invalidateQueries({ queryKey: ["copilot-msgs", projectId] });
    } catch (e: any) {
      toast.error(e.message ?? (locale === "pt" ? "Erro no Copiloto" : "Copilot error"));
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    if (!confirm(locale === "pt" ? "Apagar todo o histórico do Copiloto?" : "Delete entire Copilot history?")) return;
    await supabase.from("research_copilot_messages").delete().eq("project_id", projectId);
    qc.invalidateQueries({ queryKey: ["copilot-msgs", projectId] });
  };

  const suggestions = locale === "pt" ? SUGGESTIONS_PT : SUGGESTIONS_EN;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 shadow-lg rounded-full h-14 px-5 gap-2 bg-gradient-to-r from-primary to-primary/80"
        size="lg"
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-semibold">{locale === "pt" ? "Copiloto" : "Copilot"}</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full">
          <SheetHeader className="border-b px-5 py-4 flex-row items-center justify-between space-y-0">
            <div>
              <SheetTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {locale === "pt" ? "Copiloto do Projeto" : "Project Copilot"}
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{projectTitle}</p>
            </div>
            <div className="flex gap-1">
              {history.length > 0 && (
                <Button variant="ghost" size="icon" onClick={clearAll} title={locale === "pt" ? "Limpar histórico" : "Clear history"}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {history.length === 0 && (
              <div className="space-y-4 pt-4">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">{locale === "pt" ? "Pergunte qualquer coisa sobre este projeto" : "Ask anything about this project"}</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {locale === "pt"
                      ? "Tenho memória completa: overview, equipe, tarefas, reuniões, cronograma, referências."
                      : "I have full memory: overview, team, tasks, meetings, schedule, references."}
                  </p>
                </div>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-sm rounded-lg border bg-card hover:bg-accent transition-colors px-3 py-2"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {history.map((m: any) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 max-w-none"
                )}>
                  {m.role === "user" ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-2.5 bg-muted/50 text-sm text-muted-foreground italic">
                  {locale === "pt" ? "Analisando o projeto…" : "Analyzing project…"}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={locale === "pt" ? "Pergunte ao Copiloto…" : "Ask the Copilot…"}
                rows={2}
                className="resize-none min-h-[44px] max-h-32"
              />
              <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
