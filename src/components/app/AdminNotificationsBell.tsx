import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

interface AdminNotification {
  id: string;
  type: string;
  ticket_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_PREFIX: Record<string, { pt: string; en: string }> = {
  new_ticket: { pt: "Novo chamado: ", en: "New ticket: " },
  ticket_reply: { pt: "Nova resposta: ", en: "New reply: " },
  cost_ceiling_breach: { pt: "Teto de custo: ", en: "Cost ceiling: " },
};

export const AdminNotificationsBell = () => {
  const { isAdmin } = useAdmin();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pt = locale === "pt";

  const { data: items = [] } = useQuery({
    queryKey: ["admin-notifications"],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as AdminNotification[];
    },
  });

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, qc]);

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = async (id: string) => {
    await supabase.from("admin_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  };
  const markAllRead = async () => {
    await supabase.from("admin_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  };

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Support notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">{pt ? "Chamados de suporte" : "Support tickets"}</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" />{pt ? "Marcar todas" : "Mark all"}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">{pt ? "Sem notificações." : "No notifications."}</p>
          )}
          {items.map((n) => (
            <div key={n.id} className={`px-3 py-2 border-b last:border-0 text-sm flex items-start gap-2 ${!n.read_at ? "bg-primary/5" : ""}`}>
              <div className="flex-1 min-w-0">
                <button
                  className="font-medium hover:underline text-left"
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                    navigate(n.link || (n.ticket_id ? `/admin?tab=tickets&ticket=${n.ticket_id}` : "/admin"));
                  }}
                >
                  {pt ? TYPE_PREFIX[n.type]?.pt : TYPE_PREFIX[n.type]?.en}
                  {n.title}
                </button>
                {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt ? ptBR : enUS })}
                </p>
              </div>
              {!n.read_at && (
                <button onClick={() => markRead(n.id)} className="text-muted-foreground hover:text-primary">
                  <Check className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AdminNotificationsBell;
