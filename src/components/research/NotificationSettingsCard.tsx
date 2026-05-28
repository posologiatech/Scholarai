import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

type Prefs = {
  digest_frequency: "off" | "daily" | "weekly";
  notify_mentions: boolean;
  notify_tasks: boolean;
  notify_meetings: boolean;
  notify_risks: boolean;
  notify_comments: boolean;
  email_digest: boolean;
};

const DEFAULTS: Prefs = {
  digest_frequency: "daily",
  notify_mentions: true,
  notify_tasks: true,
  notify_meetings: true,
  notify_risks: true,
  notify_comments: true,
  email_digest: true,
};

export const NotificationSettingsCard = ({ projectId }: { projectId: string }) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("research_notification_prefs")
        .select("*")
        .eq("project_id", projectId).eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs({ ...DEFAULTS, ...data } as Prefs);
      setLoaded(true);
    })();
  }, [user, projectId]);

  const save = async (next: Prefs) => {
    if (!user) return;
    setPrefs(next);
    const { error } = await supabase.from("research_notification_prefs").upsert({
      user_id: user.id, project_id: projectId, ...next,
    }, { onConflict: "user_id,project_id" });
    if (error) toast.error(error.message);
  };

  if (!loaded) return null;

  const Row = ({ id, label, value }: { id: keyof Prefs; label: string; value: boolean }) => (
    <div className="flex items-center justify-between py-2">
      <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
      <Switch id={id} checked={value} onCheckedChange={(v) => save({ ...prefs, [id]: v })} />
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />{locale === "pt" ? "Preferências de notificação" : "Notification preferences"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between py-2">
          <Label className="text-sm">{locale === "pt" ? "Frequência do digest" : "Digest frequency"}</Label>
          <Select value={prefs.digest_frequency} onValueChange={(v: any) => save({ ...prefs, digest_frequency: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">{locale === "pt" ? "Desligado" : "Off"}</SelectItem>
              <SelectItem value="daily">{locale === "pt" ? "Diário" : "Daily"}</SelectItem>
              <SelectItem value="weekly">{locale === "pt" ? "Semanal" : "Weekly"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Row id="notify_mentions" label={locale === "pt" ? "Menções (@você)" : "Mentions (@you)"} value={prefs.notify_mentions} />
        <Row id="notify_tasks" label={locale === "pt" ? "Tarefas atribuídas" : "Assigned tasks"} value={prefs.notify_tasks} />
        <Row id="notify_meetings" label={locale === "pt" ? "Reuniões" : "Meetings"} value={prefs.notify_meetings} />
        <Row id="notify_risks" label={locale === "pt" ? "Alertas de risco" : "Risk alerts"} value={prefs.notify_risks} />
        <Row id="notify_comments" label={locale === "pt" ? "Comentários em itens que sigo" : "Comments on my items"} value={prefs.notify_comments} />
        <Row id="email_digest" label={locale === "pt" ? "Enviar digest por e-mail" : "Send digest by email"} value={prefs.email_digest} />
      </CardContent>
    </Card>
  );
};

export default NotificationSettingsCard;
