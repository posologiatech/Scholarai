import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export const NotificationsBell = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["research-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("research_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("research-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "research_notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["research-notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const unread = items.filter((n: any) => !n.read_at).length;

  const markRead = async (id: string) => {
    await supabase.from("research_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-notifications", user?.id] });
  };
  const markAllRead = async () => {
    await supabase.from("research_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["research-notifications", user?.id] });
  };
  const remove = async (id: string) => {
    await supabase.from("research_notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-notifications", user?.id] });
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
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
          <p className="text-sm font-semibold">{locale === "pt" ? "Notificações" : "Notifications"}</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" />{locale === "pt" ? "Marcar todas" : "Mark all"}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">{locale === "pt" ? "Sem notificações." : "No notifications."}</p>
          )}
          {items.map((n: any) => (
            <div key={n.id} className={`px-3 py-2 border-b last:border-0 text-sm flex items-start gap-2 ${!n.read_at ? "bg-primary/5" : ""}`}>
              <div className="flex-1 min-w-0">
                {n.link ? (
                  <Link to={n.link} onClick={() => { markRead(n.id); setOpen(false); }} className="font-medium hover:underline">{n.title}</Link>
                ) : (
                  <p className="font-medium">{n.title}</p>
                )}
                {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: locale === "pt" ? ptBR : enUS })}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {!n.read_at && (
                  <button onClick={() => markRead(n.id)} className="text-muted-foreground hover:text-primary"><Check className="h-3 w-3" /></button>
                )}
                <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
