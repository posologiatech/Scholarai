import { Link, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GraduationCap, Globe, LogOut, BookOpen, Table, FileText,
  LayoutDashboard, Shield, ShieldCheck, Palette, BrainCircuit,
  PanelLeftClose, PanelLeft, Network, Users, PenLine, BarChart3, Bell, ClipboardCheck, GitBranch,
  ClipboardList, Activity, Rocket,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PlanBadge } from "@/components/app/UsageMeter";

const AppSidebar = ({ children }: { children: React.ReactNode }) => {
  const { t, locale, setLocale } = useLanguage();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const toggleLocale = () => setLocale(locale === "pt" ? "en" : "pt");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navLinks = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.library"), href: "/library", icon: BookOpen },
    { label: t("nav.extraction"), href: "/extraction", icon: Table },
    { label: t("nav.reports"), href: "/reports", icon: FileText },
    { label: "Ref. Check", href: "/reference-check", icon: ShieldCheck },
    { label: t("nav.illustrations"), href: "/illustrations", icon: Palette },
    { label: "DataMind", href: "/datamind", icon: BrainCircuit },
    { label: "Dashboards", href: "/datamind/dashboards", icon: LayoutDashboard },
    { label: "Pipelines", href: "/datamind/pipelines", icon: GitBranch },
    { label: locale === "pt" ? "Mapa de Conhecimento" : "Knowledge Map", href: "/knowledge-graph", icon: Network },
    { label: "Workspaces", href: "/workspaces", icon: Users },
    { label: locale === "pt" ? "Escrita Científica" : "Writing Assistant", href: "/writing", icon: PenLine },
    { label: locale === "pt" ? "Meta-análise" : "Meta-Analysis", href: "/meta-analysis", icon: BarChart3 },
    { label: locale === "pt" ? "Alertas" : "Alerts", href: "/alerts", icon: Bell },
    { label: locale === "pt" ? "Qualidade (RoB)" : "Risk of Bias", href: "/risk-of-bias", icon: ClipboardCheck },
    { label: locale === "pt" ? "Pesquisas" : "Surveys", href: "/surveys", icon: ClipboardList },
    { label: "DataSUS / SINAN", href: "/datasus", icon: Activity },
    { label: locale === "pt" ? "Atualizações" : "Changelog", href: "/changelog", icon: Rocket },
    ...(isAdmin ? [{ label: t("nav.admin"), href: "/admin", icon: Shield }] : []),
  ];

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-40 flex h-screen flex-col border-r border-border/40 bg-background/95 backdrop-blur-sm transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-border/40 px-3">
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-6 w-6 shrink-0 text-primary" />
            {!collapsed && (
              <span className="font-display text-lg font-bold text-foreground truncate">
                ScholarAI
              </span>
            )}
          </Link>
        </div>

        {/* Nav links */}
        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-0.5 px-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href || location.pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  title={collapsed ? link.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Bottom section */}
        <div className="border-t border-border/40 p-2 space-y-1">
          {!collapsed && (
            <Link to="/my-plan" className="block px-3 py-1 flex items-center justify-between hover:bg-muted/50 rounded-lg transition-colors">
              {user?.email && (
                <p className="text-xs text-muted-foreground truncate flex-1 mr-2">
                  {user.email}
                </p>
              )}
              <PlanBadge />
            </Link>
          )}
          <div className={cn("flex gap-1", collapsed ? "flex-col items-center" : "")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLocale}
              aria-label="Toggle language"
              className="h-8 w-8"
            >
              <Globe className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label={t("dashboard.signOut")}
              className="h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          {!collapsed && (
            <p className="px-3 py-1 text-[10px] text-muted-foreground/60 leading-tight">
              Desenvolvido por Sérgio Araújo. Posologia Produções
            </p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
};

export default AppSidebar;
