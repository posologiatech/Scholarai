import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ExternalLink, Send, Loader2, ArrowLeft, ShieldCheck,
  LifeBuoy, Clock, CircleDot, CheckCircle2, User, CreditCard, Activity, BrainCircuit, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

const CATEGORIES = ["bug", "billing", "technical", "suggestion", "other"] as const;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

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

const PRIORITY_LABELS: Record<string, { pt: string; en: string; className: string }> = {
  low: { pt: "Baixa", en: "Low", className: "bg-muted text-muted-foreground" },
  medium: { pt: "Média", en: "Medium", className: "bg-blue-500/10 text-blue-600" },
  high: { pt: "Alta", en: "High", className: "bg-destructive/10 text-destructive" },
};

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  browser_info: { url?: string; user_agent?: string; viewport?: string; referrer?: string | null } | null;
  last_message_at: string;
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

interface Approval {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

interface Props {
  initialTicketId?: string | null;
}

export default function SupportTicketsPanel({ initialTicketId }: Props) {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const pt = locale === "pt";

  const [statusFilter, setStatusFilter] = useState<"all" | typeof STATUSES[number]>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | typeof CATEGORIES[number]>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialTicketId ?? null);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["admin-support-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_approvals").select("user_id, email, full_name");
      if (error) throw error;
      return (data ?? []) as Approval[];
    },
  });

  const approvalMap = useMemo(() => new Map(approvals.map((a) => [a.user_id, a])), [approvals]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-support-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_ticket_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        if (selectedId) qc.invalidateQueries({ queryKey: ["admin-support-ticket-messages", selectedId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, selectedId]);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const categoryBreakdown = CATEGORIES.map((c) => ({
    category: c,
    count: tickets.filter((t) => t.category === c).length,
  })).filter((c) => c.count > 0);

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const a = approvalMap.get(t.user_id);
      const haystack = `${t.subject} ${a?.email ?? ""} ${a?.full_name ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const selectedTicket = tickets.find((t) => t.id === selectedId) || null;

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-support-ticket-messages", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", selectedId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TicketMessage[];
    },
  });

  // Diagnostics for the customer who owns the selected ticket.
  const { data: diagnostics } = useQuery({
    queryKey: ["admin-support-diagnostics", selectedTicket?.user_id],
    enabled: !!selectedTicket?.user_id,
    queryFn: async () => {
      const uid = selectedTicket!.user_id;
      const period = new Date().toISOString().slice(0, 7);
      const [{ data: sub }, { data: usage }, { data: aiLogs }, { data: analytics }] = await Promise.all([
        supabase.from("subscriptions").select("plan, status, stripe_customer_id, current_period_end").eq("user_id", uid).maybeSingle(),
        supabase.from("usage_tracking").select("feature, count").eq("user_id", uid).eq("period", period),
        supabase.from("ai_usage_log").select("estimated_cost_usd, created_at").eq("user_id", uid).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("analytics_events").select("event_name, page_path, metadata, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
      ]);
      return { subscription: sub, usage: usage ?? [], aiCost: (aiLogs ?? []).reduce((s, l) => s + (l.estimated_cost_usd || 0), 0), aiRequests: aiLogs?.length ?? 0, analytics: analytics ?? [] };
    },
  });

  const updateTicket = async (patch: Partial<Ticket>) => {
    if (!selectedId) return;
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", selectedId);
    if (error) {
      toast.error(error.message);
    } else {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    }
  };

  const handleReply = async () => {
    if (!user || !selectedId || !reply.trim()) return;
    setSendingReply(true);
    try {
      const { error } = await supabase
        .from("support_ticket_messages")
        .insert({ ticket_id: selectedId, sender_id: user.id, body: reply.trim() });
      if (error) throw error;
      setReply("");
      qc.invalidateQueries({ queryKey: ["admin-support-ticket-messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    } catch (err: any) {
      toast.error(err.message || (pt ? "Erro ao responder" : "Failed to reply"));
    } finally {
      setSendingReply(false);
    }
  };

  if (selectedTicket) {
    const a = approvalMap.get(selectedTicket.user_id);
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {pt ? "Voltar para a lista" : "Back to list"}
        </Button>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Thread */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">{selectedTicket.subject}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a?.full_name || a?.email || selectedTicket.user_id.slice(0, 12)} · {CATEGORY_LABELS[selectedTicket.category]?.[pt ? "pt" : "en"] || selectedTicket.category} · {format(new Date(selectedTicket.created_at), "PPp", { locale: pt ? ptBR : enUS })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedTicket.priority} onValueChange={(v) => updateTicket({ priority: v })}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABELS[p][pt ? "pt" : "en"]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedTicket.status} onValueChange={(v) => updateTicket({ status: v })}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s][pt ? "pt" : "en"]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.is_admin_reply ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${m.is_admin_reply ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                    {!m.is_admin_reply && (
                      <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                        <User className="h-3 w-3" />
                        {a?.full_name || a?.email || (pt ? "Cliente" : "Customer")}
                      </p>
                    )}
                    {m.is_admin_reply && (
                      <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary-foreground/90">
                        <ShieldCheck className="h-3 w-3" />
                        {pt ? "Você" : "You"}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1.5 text-[10px] ${m.is_admin_reply ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(new Date(m.created_at), "PPp", { locale: pt ? ptBR : enUS })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={pt ? "Escreva sua resposta ao cliente..." : "Write your reply to the customer..."}
                rows={3}
              />
              <Button onClick={handleReply} disabled={sendingReply || !reply.trim()}>
                {sendingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {pt ? "Enviar resposta" : "Send reply"}
              </Button>
            </div>
          </div>

          {/* Diagnostics */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{pt ? "Cliente" : "Customer"}</h3>
              </div>
              <p className="text-sm text-foreground">{a?.full_name || (pt ? "Sem nome" : "No name")}</p>
              <p className="text-xs text-muted-foreground">{a?.email || "—"}</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{pt ? "Assinatura" : "Subscription"}</h3>
              </div>
              {diagnostics?.subscription ? (
                <div className="space-y-1 text-xs">
                  <p><span className="text-muted-foreground">{pt ? "Plano:" : "Plan:"}</span> <span className="font-medium capitalize text-foreground">{diagnostics.subscription.plan}</span></p>
                  <p><span className="text-muted-foreground">Status:</span> <span className="font-medium text-foreground">{diagnostics.subscription.status}</span></p>
                  {diagnostics.subscription.current_period_end && (
                    <p><span className="text-muted-foreground">{pt ? "Renova em:" : "Renews:"}</span> {new Date(diagnostics.subscription.current_period_end).toLocaleDateString(pt ? "pt-BR" : "en-US")}</p>
                  )}
                  {diagnostics.subscription.stripe_customer_id && (
                    <a
                      href={`https://dashboard.stripe.com/customers/${diagnostics.subscription.stripe_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                    >
                      {pt ? "Ver no Stripe" : "View in Stripe"} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{pt ? "Plano Free" : "Free plan"}</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{pt ? "Uso este mês" : "Usage this month"}</h3>
              </div>
              {diagnostics?.usage?.length ? (
                <div className="space-y-1 text-xs">
                  {diagnostics.usage.map((u: { feature: string; count: number }) => (
                    <p key={u.feature} className="flex justify-between">
                      <span className="text-muted-foreground">{u.feature}</span>
                      <span className="font-medium text-foreground">{u.count}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{pt ? "Sem uso registrado" : "No usage recorded"}</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{pt ? "IA (30 dias)" : "AI (30 days)"}</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {diagnostics?.aiRequests ?? 0} {pt ? "requisições" : "requests"} · ${(diagnostics?.aiCost ?? 0).toFixed(2)}
              </p>
            </div>

            {selectedTicket.browser_info && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{pt ? "Ambiente do chamado" : "Ticket environment"}</h3>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground break-all">
                  {selectedTicket.browser_info.url && <p>URL: {selectedTicket.browser_info.url}</p>}
                  {selectedTicket.browser_info.user_agent && <p>UA: {selectedTicket.browser_info.user_agent}</p>}
                  {selectedTicket.browser_info.viewport && <p>Viewport: {selectedTicket.browser_info.viewport}</p>}
                  {selectedTicket.browser_info.referrer && <p>Referrer: {selectedTicket.browser_info.referrer}</p>}
                </div>
              </div>
            )}

            {!!diagnostics?.analytics?.length && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{pt ? "Atividade recente" : "Recent activity"}</h3>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {diagnostics.analytics.slice(0, 6).map((ev: { event_name: string; page_path: string | null; created_at: string }, i: number) => (
                    <p key={i} className="truncate">
                      {ev.event_name} {ev.page_path ? `· ${ev.page_path}` : ""} · {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: pt ? ptBR : enUS })}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <CircleDot className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{openCount}</p>
              <p className="text-xs text-muted-foreground">{pt ? "Chamados abertos" : "Open tickets"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">{pt ? "Em andamento" : "In progress"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <LifeBuoy className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{tickets.length}</p>
              <p className="text-xs text-muted-foreground">{pt ? "Total" : "Total"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">{pt ? "Por categoria" : "By category"}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {categoryBreakdown.map((c) => (
              <Badge key={c.category} variant="outline" className="text-[10px]">
                {CATEGORY_LABELS[c.category]?.[pt ? "pt" : "en"]}: {c.count}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Filters + table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={pt ? "Buscar por cliente ou assunto..." : "Search by customer or subject..."} className="pl-9" />
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {(["all", ...STATUSES] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f === "all" ? (pt ? "Todos" : "All") : STATUS_LABELS[f][pt ? "pt" : "en"]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {(["all", ...CATEGORIES] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCategoryFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${categoryFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f === "all" ? (pt ? "Todas" : "All") : CATEGORY_LABELS[f][pt ? "pt" : "en"]}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{filteredTickets.length} {pt ? "resultados" : "results"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{pt ? "Cliente" : "Customer"}</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{pt ? "Assunto" : "Subject"}</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{pt ? "Categoria" : "Category"}</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{pt ? "Prioridade" : "Priority"}</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{pt ? "Última atividade" : "Last activity"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTickets.map((t) => {
                const a = approvalMap.get(t.user_id);
                const s = STATUS_LABELS[t.status] ?? STATUS_LABELS.open;
                const p = PRIORITY_LABELS[t.priority] ?? PRIORITY_LABELS.medium;
                return (
                  <tr key={t.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(t.id)}>
                    <td className="px-4 py-2">
                      <p className="text-sm text-foreground">{a?.full_name || (pt ? "Sem nome" : "No name")}</p>
                      <p className="text-xs text-muted-foreground">{a?.email || `${t.user_id.slice(0, 12)}...`}</p>
                    </td>
                    <td className="px-4 py-2 max-w-[220px] truncate text-foreground">{t.subject}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {CATEGORY_LABELS[t.category]?.[pt ? "pt" : "en"] || t.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${p.className}`}>
                        {p[pt ? "pt" : "en"]}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.className}`}>
                        {s[pt ? "pt" : "en"]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: pt ? ptBR : enUS })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTickets.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {pt ? "Nenhum chamado encontrado" : "No tickets found"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
