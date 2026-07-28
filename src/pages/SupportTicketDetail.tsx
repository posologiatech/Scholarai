import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

const CATEGORY_LABELS: Record<string, { pt: string; en: string }> = {
  bug: { pt: "Bug", en: "Bug" },
  billing: { pt: "Cobrança", en: "Billing" },
  technical: { pt: "Dúvida técnica", en: "Technical question" },
  suggestion: { pt: "Sugestão", en: "Suggestion" },
  other: { pt: "Outro", en: "Other" },
};

const STATUS_LABELS: Record<string, { pt: string; en: string; className: string }> = {
  open: { pt: "Aberto", en: "Open", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  in_progress: { pt: "Em andamento", en: "In progress", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  resolved: { pt: "Resolvido", en: "Resolved", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  closed: { pt: "Fechado", en: "Closed", className: "bg-muted text-muted-foreground border-border" },
};

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_admin_reply: boolean;
  body: string;
  created_at: string;
}

const SupportTicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pt = locale === "pt";
  const bottomRef = useRef<HTMLDivElement>(null);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const { data: ticket, isLoading: loadingTicket } = useQuery({
    queryKey: ["support-ticket", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, category, status, priority, created_at")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Ticket;
    },
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["support-ticket-messages", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("id, ticket_id, sender_id, is_admin_reply, body, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TicketMessage[];
    },
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`support-ticket-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_ticket_messages", filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["support-ticket-messages", id] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["support-ticket", id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !reply.trim()) return;

    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from("support_ticket_messages")
        .insert({ ticket_id: id, sender_id: user.id, body: reply.trim() })
        .select("id")
        .single();
      if (error) throw error;

      supabase.functions
        .invoke("notify-support-ticket", { body: { ticketId: id, messageId: msg.id } })
        .catch((err) => console.error("notify-support-ticket failed:", err));

      setReply("");
      qc.invalidateQueries({ queryKey: ["support-ticket-messages", id] });
    } catch (err: any) {
      console.error("Reply error:", err);
      toast.error(pt ? "Erro ao enviar resposta" : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  if (loadingTicket || loadingMessages) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{pt ? "Chamado não encontrado" : "Ticket not found"}</p>
        <Button variant="outline" onClick={() => navigate("/support")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {pt ? "Voltar" : "Back"}
        </Button>
      </div>
    );
  }

  const s = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.open;
  const c = CATEGORY_LABELS[ticket.category];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container max-w-3xl flex-1 py-8 px-4">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/support")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {pt ? "Meus chamados" : "My tickets"}
        </Button>

        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">{ticket.subject}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {c ? (pt ? c.pt : c.en) : ticket.category} · {format(new Date(ticket.created_at), "PPp", { locale: pt ? ptBR : enUS })}
              </p>
            </div>
            <Badge variant="outline" className={s.className}>{pt ? s.pt : s.en}</Badge>
          </div>
        </div>

        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.is_admin_reply ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  m.is_admin_reply
                    ? "border border-border bg-card"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {m.is_admin_reply && (
                  <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary">
                    <ShieldCheck className="h-3 w-3" />
                    {pt ? "Suporte ScholarAI" : "ScholarAI Support"}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1.5 text-[10px] ${m.is_admin_reply ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                  {format(new Date(m.created_at), "PPp", { locale: pt ? ptBR : enUS })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {ticket.status !== "closed" && (
          <form onSubmit={handleReply} className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={pt ? "Escreva sua resposta..." : "Write your reply..."}
              rows={3}
              maxLength={4000}
            />
            <Button type="submit" disabled={sending || !reply.trim()}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {pt ? "Enviar" : "Send"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
};

export default SupportTicketDetail;
