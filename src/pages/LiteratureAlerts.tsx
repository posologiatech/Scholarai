import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Bell, Plus, Search, Trash2, RefreshCw, Eye, EyeOff, AlertTriangle,
  Clock, CheckCircle, XCircle, ExternalLink, Loader2, Rss, Shield,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type Alert = {
  id: string;
  query: string;
  filters: any;
  is_active: boolean;
  frequency: string;
  last_checked_at: string | null;
  created_at: string;
};

type AlertResult = {
  id: string;
  alert_id: string;
  paper_title: string;
  paper_authors: any[];
  paper_year: number | null;
  paper_doi: string | null;
  paper_abstract: string | null;
  paper_url: string | null;
  paper_source: string | null;
  is_read: boolean;
  found_at: string;
  literature_alerts?: { query: string };
};

type RetractionWatch = {
  id: string;
  paper_doi: string;
  paper_title: string;
  paper_authors: any[];
  status: string;
  last_checked_at: string | null;
  created_at: string;
};

const LiteratureAlerts = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt";

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [feed, setFeed] = useState<AlertResult[]>([]);
  const [retractions, setRetractions] = useState<RetractionWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newQuery, setNewQuery] = useState("");
  const [newFrequency, setNewFrequency] = useState("weekly");
  const [addRetrDialogOpen, setAddRetrDialogOpen] = useState(false);
  const [newDoi, setNewDoi] = useState("");
  const [newRetrTitle, setNewRetrTitle] = useState("");
  const [checkingRetraction, setCheckingRetraction] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const [alertsRes, feedRes, retrRes] = await Promise.all([
      supabase.from("literature_alerts").select("*").order("created_at", { ascending: false }),
      supabase.from("alert_results").select("*, literature_alerts(query)").order("found_at", { ascending: false }).limit(100),
      supabase.from("retraction_watches").select("*").order("created_at", { ascending: false }),
    ]);
    setAlerts((alertsRes.data as any) || []);
    setFeed((feedRes.data as any) || []);
    setRetractions((retrRes.data as any) || []);
    setLoading(false);
  };

  const createAlert = async () => {
    if (!newQuery.trim() || !user) return;
    const { error } = await supabase.from("literature_alerts").insert({
      user_id: user.id,
      query: newQuery.trim(),
      frequency: newFrequency,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(pt ? "Alerta criado!" : "Alert created!");
    setDialogOpen(false);
    setNewQuery("");
    loadAll();
  };

  const deleteAlert = async (id: string) => {
    await supabase.from("literature_alerts").delete().eq("id", id);
    toast.success(pt ? "Alerta removido" : "Alert removed");
    loadAll();
  };

  const toggleAlert = async (id: string, active: boolean) => {
    await supabase.from("literature_alerts").update({ is_active: active }).eq("id", id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: active } : a)));
  };

  const checkAlertNow = async (alert: Alert) => {
    if (!user) return;
    setChecking(alert.id);
    try {
      const { data, error } = await supabase.functions.invoke("check-alerts", {
        body: { action: "check_alert", alert_id: alert.id, user_id: user.id },
      });
      if (error) throw error;
      toast.success(
        pt
          ? `${data.new_papers} novos papers encontrados`
          : `${data.new_papers} new papers found`
      );
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setChecking(null);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from("alert_results").update({ is_read: true }).eq("id", id);
    setFeed((prev) => prev.map((f) => (f.id === id ? { ...f, is_read: true } : f)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("alert_results").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setFeed((prev) => prev.map((f) => ({ ...f, is_read: true })));
    toast.success(pt ? "Todos marcados como lidos" : "All marked as read");
  };

  const addRetractionWatch = async () => {
    if (!newDoi.trim() || !newRetrTitle.trim() || !user) return;
    const { error } = await supabase.from("retraction_watches").insert({
      user_id: user.id,
      paper_doi: newDoi.trim(),
      paper_title: newRetrTitle.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(pt ? "Monitoramento adicionado!" : "Watch added!");
    setAddRetrDialogOpen(false);
    setNewDoi("");
    setNewRetrTitle("");
    loadAll();
  };

  const checkRetractionNow = async (watch: RetractionWatch) => {
    setCheckingRetraction(watch.id);
    try {
      const { data, error } = await supabase.functions.invoke("check-alerts", {
        body: { action: "check_retraction", doi: watch.paper_doi },
      });
      if (error) throw error;
      await supabase.from("retraction_watches").update({
        status: data.status,
        last_checked_at: new Date().toISOString(),
      }).eq("id", watch.id);
      setRetractions((prev) =>
        prev.map((r) => (r.id === watch.id ? { ...r, status: data.status, last_checked_at: new Date().toISOString() } : r))
      );
      toast.success(
        data.status === "active"
          ? (pt ? "Paper ativo, sem retratação" : "Paper active, no retraction")
          : (pt ? `Status: ${data.status}` : `Status: ${data.status}`)
      );
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setCheckingRetraction(null);
    }
  };

  const deleteRetraction = async (id: string) => {
    await supabase.from("retraction_watches").delete().eq("id", id);
    toast.success(pt ? "Removido" : "Removed");
    loadAll();
  };

  const unreadCount = feed.filter((f) => !f.is_read).length;

  const statusIcon = (s: string) => {
    if (s === "retracted") return <XCircle className="h-4 w-4 text-destructive" />;
    if (s === "concern") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/40 bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">{pt ? "Alertas e Monitoramento" : "Alerts & Monitoring"}</h1>
              <p className="text-sm text-muted-foreground">
                {pt ? "Vigilância científica contínua" : "Continuous scientific surveillance"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} {pt ? "novos" : "new"}</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="alerts" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="alerts">
              <Search className="h-4 w-4 mr-1" />
              {pt ? "Alertas" : "Alerts"}
            </TabsTrigger>
            <TabsTrigger value="feed">
              <Rss className="h-4 w-4 mr-1" />
              Feed {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="retractions">
              <Shield className="h-4 w-4 mr-1" />
              {pt ? "Retratações" : "Retractions"}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Alerts Tab ── */}
        <TabsContent value="alerts" className="flex-1 overflow-auto px-6 pb-6">
          <div className="flex justify-end mb-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />{pt ? "Novo Alerta" : "New Alert"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{pt ? "Criar Alerta de Literatura" : "Create Literature Alert"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input
                    placeholder={pt ? "Termos de busca..." : "Search terms..."}
                    value={newQuery}
                    onChange={(e) => setNewQuery(e.target.value)}
                  />
                  <Select value={newFrequency} onValueChange={setNewFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{pt ? "Diário" : "Daily"}</SelectItem>
                      <SelectItem value="weekly">{pt ? "Semanal" : "Weekly"}</SelectItem>
                      <SelectItem value="monthly">{pt ? "Mensal" : "Monthly"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="w-full" onClick={createAlert} disabled={!newQuery.trim()}>
                    {pt ? "Criar Alerta" : "Create Alert"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {alerts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">{pt ? "Nenhum alerta configurado" : "No alerts configured"}</p>
                <p className="text-sm mt-1">{pt ? "Crie um alerta para monitorar novas publicações" : "Create an alert to monitor new publications"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {alerts.map((a) => (
                <Card key={a.id} className={!a.is_active ? "opacity-50" : ""}>
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Search className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium truncate">{a.query}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{a.frequency}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {a.last_checked_at
                          ? `${pt ? "Última verificação" : "Last checked"}: ${new Date(a.last_checked_at).toLocaleDateString()}`
                          : (pt ? "Nunca verificado" : "Never checked")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={a.is_active} onCheckedChange={(v) => toggleAlert(a.id, v)} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkAlertNow(a)}
                        disabled={checking === a.id}
                      >
                        {checking === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteAlert(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Feed Tab ── */}
        <TabsContent value="feed" className="flex-1 overflow-hidden px-6 pb-6 flex flex-col">
          {feed.length > 0 && (
            <div className="flex justify-end mb-3">
              <Button size="sm" variant="outline" onClick={markAllRead}>
                <Eye className="h-4 w-4 mr-1" />{pt ? "Marcar todos como lidos" : "Mark all read"}
              </Button>
            </div>
          )}
          <ScrollArea className="flex-1">
            {feed.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Rss className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">{pt ? "Nenhum resultado ainda" : "No results yet"}</p>
                  <p className="text-sm mt-1">{pt ? "Execute seus alertas para encontrar novos papers" : "Run your alerts to find new papers"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {feed.map((r) => (
                  <Card key={r.id} className={r.is_read ? "opacity-60" : "border-primary/30"}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {!r.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                            <span className="font-medium text-sm leading-tight">{r.paper_title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.paper_year && `${r.paper_year} · `}
                            {r.paper_source && `${r.paper_source} · `}
                            {r.literature_alerts?.query && (
                              <span className="text-primary">"{r.literature_alerts.query}"</span>
                            )}
                          </p>
                          {r.paper_abstract && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.paper_abstract}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.paper_url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={r.paper_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {!r.is_read && (
                            <Button size="sm" variant="ghost" onClick={() => markAsRead(r.id)}>
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── Retractions Tab ── */}
        <TabsContent value="retractions" className="flex-1 overflow-auto px-6 pb-6">
          <div className="flex justify-end mb-4">
            <Dialog open={addRetrDialogOpen} onOpenChange={setAddRetrDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />{pt ? "Monitorar Paper" : "Watch Paper"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{pt ? "Monitorar Retratação" : "Watch for Retraction"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input
                    placeholder={pt ? "Título do paper" : "Paper title"}
                    value={newRetrTitle}
                    onChange={(e) => setNewRetrTitle(e.target.value)}
                  />
                  <Input
                    placeholder="DOI (ex: 10.1000/xyz123)"
                    value={newDoi}
                    onChange={(e) => setNewDoi(e.target.value)}
                  />
                  <Button className="w-full" onClick={addRetractionWatch} disabled={!newDoi.trim() || !newRetrTitle.trim()}>
                    {pt ? "Adicionar Monitoramento" : "Add Watch"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {retractions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">{pt ? "Nenhum paper monitorado" : "No papers watched"}</p>
                <p className="text-sm mt-1">{pt ? "Adicione papers que você citou para monitorar retratações" : "Add papers you cited to watch for retractions"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {retractions.map((r) => (
                <Card key={r.id} className={r.status !== "active" ? "border-destructive/50" : ""}>
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcon(r.status)}
                        <span className="font-medium text-sm truncate">{r.paper_title}</span>
                        <Badge
                          variant={r.status === "active" ? "outline" : "destructive"}
                          className="text-xs shrink-0"
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        DOI: {r.paper_doi}
                        {r.last_checked_at && ` · ${pt ? "Verificado" : "Checked"}: ${new Date(r.last_checked_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkRetractionNow(r)}
                        disabled={checkingRetraction === r.id}
                      >
                        {checkingRetraction === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRetraction(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LiteratureAlerts;
