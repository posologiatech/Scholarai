import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
// AppSidebar provided by ProtectedRoute
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Users, Trash2, Loader2, Search, FileText,
  Database, Activity, BarChart3, Settings, CheckCircle2, XCircle, Clock, UserCheck, Key, Cookie, Eye, MousePointerClick, TrendingUp,
  CreditCard, DollarSign, Zap, PieChart,
} from "lucide-react";
import ApiKeysPanel from "@/components/app/ApiKeysPanel";
import { toast } from "sonner";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface SavedSearch {
  id: string;
  query: string;
  user_id: string;
  created_at: string;
  papers: any[];
}

interface UserApproval {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  approved: boolean;
  created_at: string;
  approved_at: string | null;
}

const Admin = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<UserRole[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [approvals, setApprovals] = useState<UserApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "approvals" | "users" | "searches" | "apikeys" | "analytics" | "system">("overview");
  const [analyticsEvents, setAnalyticsEvents] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<"pending" | "approved" | "all">("pending");
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [usageTracking, setUsageTracking] = useState<any[]>([]);
  const [aiUsageLog, setAiUsageLog] = useState<any[]>([]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/dashboard");
  }, [isAdmin, adminLoading]);

  useEffect(() => {
    if (isAdmin) {
      fetchRoles();
      fetchSearches();
      fetchApprovals();
      fetchAnalytics();
    }
  }, [isAdmin]);

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRoles(data as UserRole[]);
    setLoading(false);
  };

  const fetchSearches = async () => {
    const { data } = await supabase
      .from("saved_searches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setSearches(data as unknown as SavedSearch[]);
  };

  const fetchApprovals = async () => {
    const { data } = await supabase
      .from("user_approvals")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setApprovals(data as UserApproval[]);
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    const { data } = await supabase
      .from("analytics_events" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setAnalyticsEvents(data as any[]);
    setAnalyticsLoading(false);
  };

  const approveUser = async (approvalId: string) => {
    const { error } = await supabase
      .from("user_approvals")
      .update({ approved: true, approved_at: new Date().toISOString(), approved_by: user?.id })
      .eq("id", approvalId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(locale === "pt" ? "Usuário aprovado!" : "User approved!");
      fetchApprovals();
    }
  };

  const revokeApproval = async (approvalId: string) => {
    const { error } = await supabase
      .from("user_approvals")
      .update({ approved: false, approved_at: null, approved_by: null })
      .eq("id", approvalId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(locale === "pt" ? "Acesso revogado" : "Access revoked");
      fetchApprovals();
    }
  };

  const removeRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.roleRemoved"));
      fetchRoles();
    }
  };

  const deleteSearch = async (id: string) => {
    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (!error) {
      setSearches((prev) => prev.filter((s) => s.id !== id));
      toast.success(locale === "pt" ? "Pesquisa removida" : "Search deleted");
    }
  };

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const uniqueUsers = new Set(roles.map((r) => r.user_id));
  const filteredSearches = searches.filter((s) =>
    !searchFilter || s.query.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const pendingApprovals = approvals.filter((a) => !a.approved);
  const filteredApprovals = approvals.filter((a) => {
    if (approvalFilter === "pending") return !a.approved;
    if (approvalFilter === "approved") return a.approved;
    return true;
  });

  const tabs = [
    { id: "overview" as const, label: locale === "pt" ? "Visão Geral" : "Overview", icon: BarChart3 },
    { id: "approvals" as const, label: locale === "pt" ? "Aprovações" : "Approvals", icon: UserCheck, badge: pendingApprovals.length },
    { id: "users" as const, label: locale === "pt" ? "Usuários" : "Users", icon: Users },
    { id: "searches" as const, label: locale === "pt" ? "Pesquisas" : "Searches", icon: Search },
    { id: "apikeys" as const, label: locale === "pt" ? "API Keys" : "API Keys", icon: Key },
    { id: "analytics" as const, label: "Analytics", icon: Cookie, badge: analyticsEvents.length > 0 ? analyticsEvents.length : undefined },
    { id: "system" as const, label: locale === "pt" ? "Sistema" : "System", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      
      <main className="container max-w-6xl flex-1 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{t("admin.title")}</h1>
            <p className="text-muted-foreground">{t("admin.subtitle")}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/50 p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.badge ? (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{approvals.length}</p>
                    <p className="text-xs text-muted-foreground">{locale === "pt" ? "Total de usuários" : "Total users"}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{pendingApprovals.length}</p>
                    <p className="text-xs text-muted-foreground">{locale === "pt" ? "Pendentes" : "Pending"}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{roles.filter((r) => r.role === "admin").length}</p>
                    <p className="text-xs text-muted-foreground">{t("admin.totalAdmins")}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Search className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{searches.length}</p>
                    <p className="text-xs text-muted-foreground">{locale === "pt" ? "Pesquisas salvas" : "Saved searches"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending approvals alert */}
            {pendingApprovals.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <Clock className="h-5 w-5 flex-shrink-0 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {locale === "pt"
                      ? `${pendingApprovals.length} usuário(s) aguardando aprovação`
                      : `${pendingApprovals.length} user(s) awaiting approval`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locale === "pt" ? "Clique na aba Aprovações para gerenciar" : "Click the Approvals tab to manage"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("approvals")}>
                  {locale === "pt" ? "Ver" : "View"}
                </Button>
              </div>
            )}

            {/* Recent activity */}
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {locale === "pt" ? "Atividade recente" : "Recent activity"}
                </h2>
              </div>
              <div className="divide-y divide-border">
                {searches.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{s.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.user_id.slice(0, 8)}... • {((s.papers as any[]) || []).length} papers • {new Date(s.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {searches.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {locale === "pt" ? "Nenhuma atividade recente" : "No recent activity"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === "approvals" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
                {([
                  { id: "pending" as const, label: locale === "pt" ? "Pendentes" : "Pending" },
                  { id: "approved" as const, label: locale === "pt" ? "Aprovados" : "Approved" },
                  { id: "all" as const, label: locale === "pt" ? "Todos" : "All" },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setApprovalFilter(f.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      approvalFilter === f.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredApprovals.length} {locale === "pt" ? "usuários" : "users"}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="divide-y divide-border">
                {filteredApprovals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        a.approved ? "bg-green-500/10" : "bg-amber-500/10"
                      }`}>
                        {a.approved
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <Clock className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {a.full_name || (locale === "pt" ? "Sem nome" : "No name")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.email || a.user_id.slice(0, 8) + "..."} • {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.approved ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeApproval(a.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" />
                          {locale === "pt" ? "Revogar" : "Revoke"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => approveUser(a.id)}
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          {locale === "pt" ? "Aprovar" : "Approve"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredApprovals.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {locale === "pt" ? "Nenhum usuário nesta categoria" : "No users in this category"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                <Users className="h-5 w-5" />
                {t("admin.userRoles")}
              </h2>
              <span className="text-sm text-muted-foreground">{roles.length} {locale === "pt" ? "registros" : "records"}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        role.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : role.role === "moderator"
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {role.role}
                      </div>
                      <span className="text-sm text-foreground font-mono">{role.user_id.slice(0, 8)}...</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(role.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {role.user_id !== user?.id && (
                      <Button variant="ghost" size="icon" onClick={() => removeRole(role.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {roles.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">{t("admin.noRoles")}</div>
                )}
              </div>
            )}
            <div className="border-t border-border p-4">
              <p className="text-xs text-muted-foreground">{t("admin.manageNote")}</p>
            </div>
          </div>
        )}

        {/* Searches Tab */}
        {activeTab === "searches" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={locale === "pt" ? "Filtrar pesquisas..." : "Filter searches..."}
                  className="pl-9"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredSearches.length} {locale === "pt" ? "resultados" : "results"}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card">
              <div className="divide-y divide-border">
                {filteredSearches.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{s.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {locale === "pt" ? "Usuário" : "User"}: {s.user_id.slice(0, 8)}... • {((s.papers as any[]) || []).length} papers • {new Date(s.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteSearch(s.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {filteredSearches.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {locale === "pt" ? "Nenhuma pesquisa encontrada" : "No searches found"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === "apikeys" && (
          <div className="rounded-xl border border-border bg-card p-6">
            <ApiKeysPanel />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(() => {
                    const pageViews = analyticsEvents.filter((e) => e.event_name === "page_view").length;
                    const searches = analyticsEvents.filter((e) => e.event_name === "search").length;
                    const featureUses = analyticsEvents.filter((e) => e.event_name === "feature_use").length;
                    const uniqueSessions = new Set(analyticsEvents.map((e) => e.session_id).filter(Boolean)).size;
                    return [
                      { label: locale === "pt" ? "Visualizações" : "Page Views", value: pageViews, icon: Eye, color: "bg-primary/10 text-primary" },
                      { label: locale === "pt" ? "Buscas" : "Searches", value: searches, icon: Search, color: "bg-blue-500/10 text-blue-500" },
                      { label: locale === "pt" ? "Uso de Funcionalidades" : "Feature Usage", value: featureUses, icon: MousePointerClick, color: "bg-green-500/10 text-green-500" },
                      { label: locale === "pt" ? "Sessões Únicas" : "Unique Sessions", value: uniqueSessions, icon: TrendingUp, color: "bg-amber-500/10 text-amber-500" },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl border border-border bg-card p-5">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}>
                            <card.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-foreground">{card.value}</p>
                            <p className="text-xs text-muted-foreground">{card.label}</p>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Top pages */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border p-4">
                      <Eye className="h-5 w-5 text-primary" />
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        {locale === "pt" ? "Páginas mais visitadas" : "Most visited pages"}
                      </h2>
                    </div>
                    <div className="divide-y divide-border">
                      {(() => {
                        const pageCounts: Record<string, number> = {};
                        analyticsEvents
                          .filter((e) => e.event_name === "page_view")
                          .forEach((e) => {
                            const path = e.page_path || "/";
                            pageCounts[path] = (pageCounts[path] || 0) + 1;
                          });
                        const sorted = Object.entries(pageCounts)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 10);
                        if (sorted.length === 0)
                          return (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                              {locale === "pt" ? "Nenhum dado ainda" : "No data yet"}
                            </div>
                          );
                        const max = sorted[0][1];
                        return sorted.map(([path, count]) => (
                          <div key={path} className="flex items-center gap-3 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-mono text-foreground">{path}</p>
                              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${(count / max) * 100}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-foreground">{count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Top features */}
                  <div className="rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border p-4">
                      <MousePointerClick className="h-5 w-5 text-primary" />
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        {locale === "pt" ? "Funcionalidades mais usadas" : "Most used features"}
                      </h2>
                    </div>
                    <div className="divide-y divide-border">
                      {(() => {
                        const featureCounts: Record<string, number> = {};
                        analyticsEvents
                          .filter((e) => e.event_name === "feature_use")
                          .forEach((e) => {
                            const feature = (e.metadata as any)?.feature || "unknown";
                            featureCounts[feature] = (featureCounts[feature] || 0) + 1;
                          });
                        const sorted = Object.entries(featureCounts)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 10);
                        if (sorted.length === 0)
                          return (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                              {locale === "pt" ? "Nenhum dado ainda" : "No data yet"}
                            </div>
                          );
                        const max = sorted[0][1];
                        return sorted.map(([feature, count]) => (
                          <div key={feature} className="flex items-center gap-3 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-foreground capitalize">{feature}</p>
                              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-green-500"
                                  style={{ width: `${(count / max) * 100}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-foreground">{count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Recent events table */}
                <div className="rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border p-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        {locale === "pt" ? "Eventos recentes" : "Recent events"}
                      </h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {analyticsEvents.length} {locale === "pt" ? "eventos" : "events"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{locale === "pt" ? "Evento" : "Event"}</th>
                          <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{locale === "pt" ? "Página" : "Page"}</th>
                          <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{locale === "pt" ? "Detalhes" : "Details"}</th>
                          <th className="px-4 py-2 text-xs font-medium text-muted-foreground">{locale === "pt" ? "Data" : "Date"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {analyticsEvents.slice(0, 30).map((e: any) => (
                          <tr key={e.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                e.event_name === "page_view" ? "bg-primary/10 text-primary"
                                : e.event_name === "search" ? "bg-blue-500/10 text-blue-500"
                                : e.event_name === "feature_use" ? "bg-green-500/10 text-green-500"
                                : "bg-muted text-muted-foreground"
                              }`}>
                                {e.event_name}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.page_path || "—"}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                              {e.metadata && Object.keys(e.metadata).length > 0
                                ? Object.entries(e.metadata)
                                    .filter(([k]) => k !== "user_agent")
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(", ")
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(e.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {analyticsEvents.length === 0 && (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        {locale === "pt"
                          ? "Nenhum evento registrado ainda. Os dados aparecerão quando usuários aceitarem cookies analíticos."
                          : "No events recorded yet. Data will appear when users accept analytical cookies."}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* System Tab */}
        {activeTab === "system" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {locale === "pt" ? "Informações do sistema" : "System information"}
                </h2>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: locale === "pt" ? "Plataforma" : "Platform", value: "Supabase + Lovable" },
                  { label: locale === "pt" ? "Modelo de IA" : "AI Model", value: "Google Gemini 3 Flash Preview" },
                  { label: locale === "pt" ? "Fontes de dados" : "Data Sources", value: "Semantic Scholar, PubMed, OpenAlex, ClinicalTrials.gov, Europe PMC" },
                  { label: locale === "pt" ? "Autenticação" : "Authentication", value: "Supabase Auth (Email + Google)" },
                  { label: "Edge Functions", value: "search-papers, synthesize-papers, extract-column, chat-papers, evaluate-question" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-4">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium text-foreground">
                {locale === "pt" ? "Tabelas do banco de dados" : "Database tables"}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { name: "user_roles", desc: locale === "pt" ? "Roles e permissões" : "Roles & permissions", count: roles.length },
                  { name: "user_approvals", desc: locale === "pt" ? "Aprovações de acesso" : "Access approvals", count: approvals.length },
                  { name: "saved_searches", desc: locale === "pt" ? "Pesquisas salvas" : "Saved searches", count: searches.length },
                ].map((table) => (
                  <div key={table.name} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                    <div>
                      <p className="text-sm font-mono text-foreground">{table.name}</p>
                      <p className="text-xs text-muted-foreground">{table.desc}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {table.count} {locale === "pt" ? "registros" : "rows"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
