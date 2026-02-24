import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import AppHeader from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Users, Trash2, Loader2, Search, FileText,
  Database, Activity, BarChart3, Settings,
} from "lucide-react";
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

const Admin = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<UserRole[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "searches" | "system">("overview");
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/dashboard");
  }, [isAdmin, adminLoading]);

  useEffect(() => {
    if (isAdmin) {
      fetchRoles();
      fetchSearches();
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

  const tabs = [
    { id: "overview" as const, label: locale === "pt" ? "Visão Geral" : "Overview", icon: BarChart3 },
    { id: "users" as const, label: locale === "pt" ? "Usuários" : "Users", icon: Users },
    { id: "searches" as const, label: locale === "pt" ? "Pesquisas" : "Searches", icon: Search },
    { id: "system" as const, label: locale === "pt" ? "Sistema" : "System", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
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
        <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
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
                    <p className="text-2xl font-bold text-foreground">{uniqueUsers.size}</p>
                    <p className="text-xs text-muted-foreground">{locale === "pt" ? "Usuários únicos" : "Unique users"}</p>
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
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                    <FileText className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {searches.reduce((acc, s) => acc + ((s.papers as any[]) || []).length, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">{locale === "pt" ? "Papers indexados" : "Papers indexed"}</p>
                  </div>
                </div>
              </div>
            </div>

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
