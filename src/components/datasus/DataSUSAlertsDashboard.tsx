import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  Bell, BellRing, Plus, Trash2, AlertTriangle, CheckCircle2,
  Shield, ShieldAlert, ShieldCheck, Clock, MapPin, X, Eye, EyeOff,
} from "lucide-react";
import BrazilSVGMap from "./BrazilSVGMap";

interface Alert {
  id: string;
  disease: string;
  location: string;
  state_codes: string[];
  threshold_std_dev: number;
  is_active: boolean;
  frequency: string;
  last_checked_at: string | null;
  created_at: string;
}

interface AlertResult {
  id: string;
  alert_id: string;
  alert_level: string;
  title: string;
  description: string;
  current_value: number;
  historical_mean: number;
  z_score: number;
  location: string;
  disease: string;
  period: string;
  is_read: boolean;
  detected_at: string;
}

const DISEASE_OPTIONS = [
  { value: "Dengue", label: "Dengue" },
  { value: "Chikungunya", label: "Chikungunya" },
  { value: "Zika", label: "Zika" },
];

const REGION_OPTIONS = [
  { value: "Brasil", codes: ["12","27","16","13","29","23","53","32","52","21","51","50","31","15","25","41","26","22","33","24","43","11","14","42","35","28","17"] },
  { value: "Sudeste", codes: ["32","31","33","35"] },
  { value: "Nordeste", codes: ["27","29","23","21","25","26","22","24","28"] },
  { value: "Sul", codes: ["41","43","42"] },
  { value: "Norte", codes: ["12","16","13","15","11","14","17"] },
  { value: "Centro-Oeste", codes: ["53","52","51","50"] },
  { value: "São Paulo", codes: ["35"] },
  { value: "Rio de Janeiro", codes: ["33"] },
  { value: "Minas Gerais", codes: ["31"] },
  { value: "Bahia", codes: ["29"] },
  { value: "Ceará", codes: ["23"] },
];

const ALERT_LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof ShieldAlert; label: string }> = {
  red: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ShieldAlert, label: "Crítico" },
  orange: { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle, label: "Alto" },
  yellow: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Shield, label: "Moderado" },
  green: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: ShieldCheck, label: "Normal" },
};

interface Props {
  isPt: boolean;
}

export default function DataSUSAlertsDashboard({ isPt }: Props) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertResults, setAlertResults] = useState<AlertResult[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDisease, setNewDisease] = useState("Dengue");
  const [newLocation, setNewLocation] = useState("Brasil");
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: alertsData }, { data: resultsData }] = await Promise.all([
      (supabase as any).from("datasus_alerts").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("datasus_alert_results").select("*").order("detected_at", { ascending: false }).limit(50),
    ]);
    if (alertsData) setAlerts(alertsData);
    if (resultsData) setAlertResults(resultsData);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Build map data from results
  const stateAlertLevels: Record<string, string> = {};
  for (const r of alertResults) {
    const loc = r.location;
    const existing = stateAlertLevels[loc];
    const levels = ["green", "yellow", "orange", "red"];
    if (!existing || levels.indexOf(r.alert_level) > levels.indexOf(existing)) {
      stateAlertLevels[loc] = r.alert_level;
    }
  }

  const createAlert = async () => {
    if (!user) return;
    const regionOpt = REGION_OPTIONS.find(r => r.value === newLocation);
    if (!regionOpt) return;

    const { error } = await (supabase as any).from("datasus_alerts").insert({
      user_id: user.id,
      disease: newDisease,
      location: newLocation,
      state_codes: regionOpt.codes,
      threshold_std_dev: 2.0,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isPt ? "Alerta criado" : "Alert created", description: isPt ? `Monitorando ${newDisease} em ${newLocation}` : `Monitoring ${newDisease} in ${newLocation}` });
      setShowCreateForm(false);
      loadAlerts();
    }
  };

  const toggleAlert = async (id: string, active: boolean) => {
    await (supabase as any).from("datasus_alerts").update({ is_active: active }).eq("id", id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: active } : a));
  };

  const deleteAlert = async (id: string) => {
    await (supabase as any).from("datasus_alerts").delete().eq("id", id);
    setAlerts(prev => prev.filter(a => a.id !== id));
    setAlertResults(prev => prev.filter(r => r.alert_id !== id));
  };

  const markAsRead = async (id: string) => {
    await (supabase as any).from("datasus_alert_results").update({ is_read: true }).eq("id", id);
    setAlertResults(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
  };

  const unreadCount = alertResults.filter(r => !r.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <BellRing className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isPt ? "Alertas Epidemiológicos" : "Epidemiological Alerts"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isPt ? "Detecção automática de surtos via análise estatística" : "Automatic outbreak detection via statistical analysis"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white hover:bg-red-600 rounded-full text-xs px-2">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm" className="gap-2 rounded-xl">
          <Plus className="h-4 w-4" />
          {isPt ? "Novo Alerta" : "New Alert"}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{isPt ? "Doença" : "Disease"}</label>
                <Select value={newDisease} onValueChange={setNewDisease}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISEASE_OPTIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{isPt ? "Região" : "Region"}</label>
                <Select value={newLocation} onValueChange={setNewLocation}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_OPTIONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pt-4">
                <Button onClick={createAlert} size="sm" className="rounded-lg">
                  {isPt ? "Criar" : "Create"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} className="rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brazil Map */}
        <Card className="border-border/30">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {isPt ? "Mapa de Alertas" : "Alert Map"}
            </h3>
            <BrazilSVGMap stateAlertLevels={stateAlertLevels} />
            <div className="flex items-center gap-4 mt-3 justify-center">
              {["green", "yellow", "orange", "red"].map(level => {
                const cfg = ALERT_LEVEL_CONFIG[level];
                return (
                  <div key={level} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-sm ${cfg.bg} border ${cfg.border}`} />
                    <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Active alerts config */}
        <Card className="border-border/30">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {isPt ? "Monitoramentos Ativos" : "Active Monitors"}
            </h3>
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  {isPt ? "Nenhum alerta configurado" : "No alerts configured"}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                      <Switch
                        checked={alert.is_active}
                        onCheckedChange={(v) => toggleAlert(alert.id, v)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {alert.disease} — {alert.location}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {alert.last_checked_at
                            ? `${isPt ? "Última verificação" : "Last check"}: ${new Date(alert.last_checked_at).toLocaleDateString()}`
                            : (isPt ? "Nunca verificado" : "Never checked")}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteAlert(alert.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert Results */}
      {alertResults.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {isPt ? "Detecções Recentes" : "Recent Detections"}
          </h3>
          <div className="space-y-2">
            {alertResults.map(result => {
              const cfg = ALERT_LEVEL_CONFIG[result.alert_level] || ALERT_LEVEL_CONFIG.yellow;
              const Icon = cfg.icon;
              return (
                <Card key={result.id} className={`border ${result.is_read ? "border-border/20 opacity-70" : cfg.border} transition-all`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4.5 w-4.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{result.title}</p>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 rounded ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{result.description}</p>
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70 pt-1">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{result.location}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{result.period}</span>
                          <span>{new Date(result.detected_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {!result.is_read && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => markAsRead(result.id)}>
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
