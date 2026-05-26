import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

type Severity = "low" | "medium" | "high" | "critical";

interface Risk {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  message: string;
  ref?: string;
}

const SEV_COLORS: Record<Severity, string> = {
  low: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  critical: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

export default function RisksTab({ projectId }: { projectId: string }) {
  const { locale } = useLanguage();
  const qc = useQueryClient();
  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);

  const { data: tasks = [] } = useQuery({
    queryKey: ["risk-tasks", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_tasks")
        .select("id,title,status,due_date,priority,updated_at")
        .eq("project_id", projectId);
      return data ?? [];
    },
  });
  const { data: schedule = [] } = useQuery({
    queryKey: ["risk-schedule", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_schedule_items")
        .select("id,title,end_date,progress,status").eq("project_id", projectId);
      return data ?? [];
    },
  });
  const { data: ethics = [] } = useQuery({
    queryKey: ["risk-ethics", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_ethics_submissions")
        .select("id,status,protocol_number,submitted_at").eq("project_id", projectId);
      return data ?? [];
    },
  });
  const { data: meetings = [] } = useQuery({
    queryKey: ["risk-meetings", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_meetings")
        .select("id,scheduled_at").eq("project_id", projectId)
        .order("scheduled_at", { ascending: false }).limit(1);
      return data ?? [];
    },
  });
  const { data: dismissed = [] } = useQuery({
    queryKey: ["risk-dismissed", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_risk_alerts")
        .select("*").eq("project_id", projectId).eq("resolved", true);
      return data ?? [];
    },
  });

  const detected = useMemo<Risk[]>(() => {
    const now = new Date();
    const risks: Risk[] = [];

    tasks.forEach((task: any) => {
      if (task.status === "done") return;
      if (task.due_date) {
        const due = new Date(task.due_date);
        const diff = Math.floor((due.getTime() - now.getTime()) / 86400000);
        if (diff < 0) {
          risks.push({
            id: `task-overdue-${task.id}`,
            type: "task_overdue",
            severity: diff < -14 ? "critical" : "high",
            title: t("Tarefa atrasada", "Overdue task"),
            message: `"${task.title}" — ${Math.abs(diff)} ${t("dias de atraso", "days overdue")}`,
            ref: task.id,
          });
        } else if (diff <= 3 && task.priority === "urgent") {
          risks.push({
            id: `task-urgent-${task.id}`,
            type: "task_urgent_due",
            severity: "medium",
            title: t("Tarefa urgente vencendo", "Urgent task due soon"),
            message: `"${task.title}" — ${t("vence em", "due in")} ${diff} ${t("dias", "days")}`,
          });
        }
      }
    });

    schedule.forEach((item: any) => {
      if (item.status === "done") return;
      if (item.end_date) {
        const end = new Date(item.end_date);
        const diff = Math.floor((end.getTime() - now.getTime()) / 86400000);
        if (diff < 0 && (item.progress || 0) < 100) {
          risks.push({
            id: `sched-late-${item.id}`,
            type: "schedule_slip",
            severity: "high",
            title: t("Item do cronograma atrasado", "Schedule item overdue"),
            message: `"${item.title}" — ${item.progress || 0}% ${t("concluído", "complete")}`,
          });
        } else if (diff <= 7 && (item.progress || 0) < 50) {
          risks.push({
            id: `sched-risk-${item.id}`,
            type: "schedule_at_risk",
            severity: "medium",
            title: t("Marco em risco", "Milestone at risk"),
            message: `"${item.title}" — ${t("vence em", "due in")} ${diff} ${t("dias com", "days at")} ${item.progress || 0}%`,
          });
        }
      }
    });

    if (ethics.length === 0) {
      risks.push({
        id: "ethics-missing",
        type: "ethics_missing",
        severity: "medium",
        title: t("Sem submissão ao CEP", "No ethics submission"),
        message: t("Considere registrar a submissão ao Comitê de Ética.", "Consider registering an ethics committee submission."),
      });
    } else {
      ethics.forEach((e: any) => {
        if (e.status === "pending" && e.submitted_at) {
          const days = Math.floor((now.getTime() - new Date(e.submitted_at).getTime()) / 86400000);
          if (days > 60) {
            risks.push({
              id: `ethics-stale-${e.id}`,
              type: "ethics_stale",
              severity: "medium",
              title: t("Aprovação ética pendente há muito tempo", "Ethics approval pending too long"),
              message: `${e.protocol_number || "—"} — ${days} ${t("dias", "days")}`,
            });
          }
        }
      });
    }

    if (meetings[0]) {
      const last = new Date((meetings[0] as any).scheduled_at);
      const days = Math.floor((now.getTime() - last.getTime()) / 86400000);
      if (days > 30) {
        risks.push({
          id: "meetings-inactive",
          type: "low_activity",
          severity: "low",
          title: t("Sem reuniões recentes", "No recent meetings"),
          message: `${days} ${t("dias desde a última reunião", "days since last meeting")}`,
        });
      }
    } else {
      risks.push({
        id: "meetings-none",
        type: "low_activity",
        severity: "low",
        title: t("Nenhuma reunião registrada", "No meetings recorded"),
        message: t("Agende encontros regulares de orientação.", "Schedule regular advising meetings."),
      });
    }

    return risks;
  }, [tasks, schedule, ethics, meetings, locale]);

  const dismissedKeys = new Set(dismissed.map((d: any) => d.alert_type + ":" + (d.related_entity_id || "")));
  const active = detected.filter(r => !dismissedKeys.has(r.type + ":" + (r.ref || "")));

  const dismiss = async (risk: Risk) => {
    await supabase.from("research_risk_alerts").insert({
      project_id: projectId,
      alert_type: risk.type,
      severity: risk.severity,
      title: risk.title,
      message: risk.message,
      related_entity_id: risk.ref || null,
      resolved: true,
      resolved_at: new Date().toISOString(),
    });
    qc.invalidateQueries({ queryKey: ["risk-dismissed", projectId] });
    toast.success(t("Alerta resolvido", "Alert resolved"));
  };

  const reopen = async (id: string) => {
    await supabase.from("research_risk_alerts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["risk-dismissed", projectId] });
  };

  const refresh = () => {
    ["risk-tasks", "risk-schedule", "risk-ethics", "risk-meetings"].forEach(k =>
      qc.invalidateQueries({ queryKey: [k, projectId] }));
  };

  const counts = {
    critical: active.filter(r => r.severity === "critical").length,
    high: active.filter(r => r.severity === "high").length,
    medium: active.filter(r => r.severity === "medium").length,
    low: active.filter(r => r.severity === "low").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["critical", "high", "medium", "low"] as Severity[]).map(s => (
          <Card key={s} className={`border ${SEV_COLORS[s]}`}>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wider">{s}</p>
              <p className="text-2xl font-bold">{counts[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t("Alertas ativos", "Active alerts")} ({active.length})</h3>
        <Button size="sm" variant="ghost" onClick={refresh}><RefreshCw className="h-4 w-4" />{t("Atualizar", "Refresh")}</Button>
      </div>

      {active.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p>{t("Tudo certo! Nenhum risco detectado.", "All clear! No risks detected.")}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {active.map(r => (
            <Card key={r.id} className={`border-l-4 ${SEV_COLORS[r.severity]}`}>
              <CardContent className="py-3 flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{r.title}</p>
                      <Badge variant="outline" className="text-[10px]">{r.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{r.message}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => dismiss(r)}>
                  <CheckCircle2 className="h-4 w-4" />{t("Resolver", "Resolve")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dismissed.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("Resolvidos", "Resolved")} ({dismissed.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {dismissed.slice(0, 10).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                <span className="text-muted-foreground line-through">{d.title}</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => reopen(d.id)}>{t("Reabrir", "Reopen")}</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
