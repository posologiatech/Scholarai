import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { Activity, TrendingUp, Calendar as CalIcon, CheckCircle2 } from "lucide-react";

export default function ActivityHeatmap({ projectId }: { projectId: string }) {
  const { locale } = useLanguage();
  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);

  const { data: events = [] } = useQuery({
    queryKey: ["activity-heatmap", projectId],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 365);
      const sinceIso = since.toISOString();
      const [tasks, logs, meetings, comments] = await Promise.all([
        supabase.from("research_tasks").select("completed_at").eq("project_id", projectId).not("completed_at", "is", null).gte("completed_at", sinceIso),
        supabase.from("research_logbook_entries").select("entry_date").eq("project_id", projectId).gte("entry_date", since.toISOString().slice(0, 10)),
        supabase.from("research_meetings").select("scheduled_at").eq("project_id", projectId).gte("scheduled_at", sinceIso),
        supabase.from("research_comments").select("created_at").eq("project_id", projectId).gte("created_at", sinceIso),
      ]);
      const dates: string[] = [];
      tasks.data?.forEach(r => dates.push(r.completed_at.slice(0, 10)));
      logs.data?.forEach(r => dates.push(r.entry_date.slice(0, 10)));
      meetings.data?.forEach(r => dates.push(r.scheduled_at.slice(0, 10)));
      comments.data?.forEach(r => dates.push(r.created_at.slice(0, 10)));
      return dates;
    },
  });

  const { counts, max, cells, totals } = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach(d => map.set(d, (map.get(d) || 0) + 1));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - 364);
    // Align to Sunday
    startDay.setDate(startDay.getDate() - startDay.getDay());

    const cells: { date: string; count: number; week: number; day: number }[] = [];
    const cursor = new Date(startDay);
    let week = 0;
    while (cursor <= today) {
      const iso = cursor.toISOString().slice(0, 10);
      cells.push({ date: iso, count: map.get(iso) || 0, week, day: cursor.getDay() });
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === 0) week++;
    }
    const max = Math.max(1, ...Array.from(map.values()));
    const totals = {
      total: events.length,
      activeDays: map.size,
      streak: (() => {
        let s = 0;
        const d = new Date(today);
        while (map.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
        return s;
      })(),
    };
    return { counts: map, max, cells, totals };
  }, [events]);

  const intensity = (c: number) => {
    if (!c) return "bg-muted/40";
    const r = c / max;
    if (r > 0.75) return "bg-primary";
    if (r > 0.5) return "bg-primary/70";
    if (r > 0.25) return "bg-primary/50";
    return "bg-primary/30";
  };

  const weeks = Math.max(...cells.map(c => c.week)) + 1;
  const dayLabels = locale === "pt" ? ["D", "S", "T", "Q", "Q", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-4 flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <div><p className="text-xs text-muted-foreground">{t("Eventos (365d)", "Events (365d)")}</p><p className="text-2xl font-bold">{totals.total}</p></div>
        </CardContent></Card>
        <Card><CardContent className="py-4 flex items-center gap-3">
          <CalIcon className="h-8 w-8 text-blue-500" />
          <div><p className="text-xs text-muted-foreground">{t("Dias ativos", "Active days")}</p><p className="text-2xl font-bold">{totals.activeDays}</p></div>
        </CardContent></Card>
        <Card><CardContent className="py-4 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-orange-500" />
          <div><p className="text-xs text-muted-foreground">{t("Sequência atual", "Current streak")}</p><p className="text-2xl font-bold">{totals.streak}</p></div>
        </CardContent></Card>
        <Card><CardContent className="py-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div><p className="text-xs text-muted-foreground">{t("Pico diário", "Peak day")}</p><p className="text-2xl font-bold">{max}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("Heatmap de produtividade", "Productivity heatmap")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <div className="flex flex-col gap-[3px] text-[10px] text-muted-foreground pt-1">
              {dayLabels.map((d, i) => (
                <div key={i} className="h-3 flex items-center">{i % 2 === 1 ? d : ""}</div>
              ))}
            </div>
            <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}>
              {cells.map(c => (
                <div
                  key={c.date}
                  title={`${c.date}: ${c.count} ${t("eventos", "events")}`}
                  className={`w-3 h-3 rounded-sm ${intensity(c.count)} hover:ring-2 hover:ring-primary/50 cursor-pointer transition-all`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
            <span>{t("Menos", "Less")}</span>
            <div className="w-3 h-3 rounded-sm bg-muted/40" />
            <div className="w-3 h-3 rounded-sm bg-primary/30" />
            <div className="w-3 h-3 rounded-sm bg-primary/50" />
            <div className="w-3 h-3 rounded-sm bg-primary/70" />
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span>{t("Mais", "More")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
