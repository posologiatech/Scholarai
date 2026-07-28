import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LifeBuoy, Plus, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

const CATEGORIES = [
  { value: "bug", pt: "Bug", en: "Bug" },
  { value: "billing", pt: "Cobrança", en: "Billing" },
  { value: "technical", pt: "Dúvida técnica", en: "Technical question" },
  { value: "suggestion", pt: "Sugestão", en: "Suggestion" },
  { value: "other", pt: "Outro", en: "Other" },
];

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
  last_message_at: string;
  created_at: string;
}

const Support = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pt = locale === "pt";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, category, status, priority, last_message_at, created_at")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`support-tickets-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["support-tickets", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const resetForm = () => {
    setCategory("other");
    setSubject("");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !message.trim()) {
      toast.error(pt ? "Preencha assunto e mensagem" : "Fill in subject and message");
      return;
    }

    setSending(true);
    try {
      const browserInfo = {
        url: window.location.href,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer || null,
      };

      const { data: ticket, error: ticketErr } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject: subject.trim(), category, browser_info: browserInfo })
        .select("id")
        .single();
      if (ticketErr) throw ticketErr;

      const { data: msg, error: msgErr } = await supabase
        .from("support_ticket_messages")
        .insert({ ticket_id: ticket.id, sender_id: user.id, body: message.trim() })
        .select("id")
        .single();
      if (msgErr) throw msgErr;

      supabase.functions
        .invoke("notify-support-ticket", { body: { ticketId: ticket.id, messageId: msg.id } })
        .catch((err) => console.error("notify-support-ticket failed:", err));

      toast.success(pt ? "Chamado aberto com sucesso!" : "Ticket opened successfully!");
      setDialogOpen(false);
      resetForm();
      navigate(`/support/${ticket.id}`);
    } catch (err: any) {
      console.error("Create ticket error:", err);
      toast.error(pt ? "Erro ao abrir chamado. Tente novamente." : "Failed to open ticket. Try again.");
    } finally {
      setSending(false);
    }
  };

  const categoryLabel = (value: string) => {
    const c = CATEGORIES.find((c) => c.value === value);
    return c ? (pt ? c.pt : c.en) : value;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container max-w-4xl flex-1 py-8 px-4">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {pt ? "Suporte" : "Support"}
              </h1>
              <p className="text-muted-foreground">
                {pt ? "Abra um chamado ou acompanhe suas conversas com nossa equipe" : "Open a ticket or follow up on your conversations with our team"}
              </p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {pt ? "Novo chamado" : "New ticket"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{pt ? "Abrir novo chamado" : "Open new ticket"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {pt ? "Categoria" : "Category"}
                  </label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{pt ? c.pt : c.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {pt ? "Assunto *" : "Subject *"}
                  </label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={pt ? "Resumo do problema" : "Summary of the issue"} maxLength={200} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {pt ? "Mensagem *" : "Message *"}
                  </label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={pt ? "Descreva o que está acontecendo..." : "Describe what's happening..."} rows={5} maxLength={4000} />
                </div>
                <Button type="submit" disabled={sending} className="w-full">
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {pt ? "Abrir chamado" : "Open ticket"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 px-8 text-center">
            <MessageSquare className="mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
              {pt ? "Nenhum chamado ainda" : "No tickets yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {pt ? "Abra um chamado se precisar de ajuda com o ScholarAI." : "Open a ticket if you need help with ScholarAI."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const s = STATUS_LABELS[t.status] ?? STATUS_LABELS.open;
              return (
                <Link
                  key={t.id}
                  to={`/support/${t.id}`}
                  className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{t.subject}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {categoryLabel(t.category)} · {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: pt ? ptBR : enUS })}
                      </p>
                    </div>
                    <Badge variant="outline" className={s.className}>
                      {pt ? s.pt : s.en}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Support;
