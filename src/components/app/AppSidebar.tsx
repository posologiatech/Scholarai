import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { fetchProjectLinks } from "@/lib/research/integrations";
import type { ResearchLinkType } from "@/lib/research/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectPicker } from "@/components/research/ProjectPicker";
import {
  GraduationCap, Globe, LogOut, BookOpen, Table, FileText,
  LayoutDashboard, Shield, ShieldCheck, Palette, BrainCircuit,
  PanelLeftClose, PanelLeft, Network, Users, PenLine, BarChart3, Bell, ClipboardCheck, GitBranch,
  ClipboardList, Activity, Rocket, FlaskConical, Award, LifeBuoy, Compass, X,
} from "lucide-react";
import { useState, useMemo, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { PlanBadge } from "@/components/app/UsageMeter";
import { AdminNotificationsBell } from "@/components/app/AdminNotificationsBell";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** When set, the item gets a dot indicator if the active project already has a link of this type. */
  linkType?: ResearchLinkType;
}

const AppSidebar = ({ children }: { children: React.ReactNode }) => {
  const { t, locale, setLocale } = useLanguage();
  const pt = locale === "pt";
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { activeProjectId, activeProjectTitle, setActiveProject } = useActiveProject();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const { data: activeProjectLinks = [] } = useQuery({
    queryKey: ["research-project-links", activeProjectId],
    queryFn: () => fetchProjectLinks(activeProjectId!),
    enabled: !!activeProjectId,
  });
  const linkedTypes = useMemo(
    () => new Set((activeProjectLinks as { resource_type: string }[]).map((l) => l.resource_type)),
    [activeProjectLinks],
  );

  const toggleLocale = () => setLocale(locale === "pt" ? "en" : "pt");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: pt ? "Descoberta & Biblioteca" : "Discovery & Library",
      items: [
        { label: t("nav.discover"), href: "/discover", icon: Compass },
        { label: t("nav.library"), href: "/library", icon: BookOpen, linkType: "library" },
        { label: t("nav.extraction"), href: "/extraction", icon: Table },
        { label: t("nav.reports"), href: "/reports", icon: FileText },
        { label: "Ref. Check", href: "/reference-check", icon: ShieldCheck, linkType: "reference_check" },
        { label: t("nav.illustrations"), href: "/illustrations", icon: Palette, linkType: "illustration" },
        { label: t("nav.alerts"), href: "/alerts", icon: Bell },
      ],
    },
    {
      title: pt ? "Análise" : "Analysis",
      items: [
        { label: "DataMind", href: "/datamind", icon: BrainCircuit, linkType: "datamind" },
        { label: "Dashboards", href: "/datamind/dashboards", icon: LayoutDashboard },
        { label: "Pipelines", href: "/datamind/pipelines", icon: GitBranch },
        { label: "DataSUS / SINAN", href: "/datasus", icon: Activity, linkType: "datasus" },
        { label: t("nav.metaAnalysis"), href: "/meta-analysis", icon: BarChart3, linkType: "meta_analysis" },
        { label: t("nav.riskOfBias"), href: "/risk-of-bias", icon: ClipboardCheck },
        { label: t("nav.surveys"), href: "/surveys", icon: ClipboardList, linkType: "survey" },
      ],
    },
    {
      title: pt ? "Redes" : "Networks",
      items: [
        { label: t("nav.knowledgeGraph"), href: "/knowledge-graph", icon: Network, linkType: "knowledge_graph" },
        { label: t("nav.coauthorship"), href: "/coauthorship", icon: Users, linkType: "coauthorship" },
      ],
    },
    {
      title: pt ? "Escrita & Saídas" : "Writing & Outputs",
      items: [
        { label: t("nav.writing"), href: "/writing", icon: PenLine, linkType: "writing" },
      ],
    },
    {
      title: pt ? "Gestão de Pesquisa" : "Research Management",
      items: [
        { label: t("nav.researchProjects"), href: "/research", icon: FlaskConical },
        { label: t("nav.fundingCalls"), href: "/research/funding", icon: Award, linkType: "funding" },
        { label: "Workspaces", href: "/workspaces", icon: Users, linkType: "workspace" },
      ],
    },
  ];

  const footerLinks: NavItem[] = [
    { label: t("nav.changelog"), href: "/changelog", icon: Rocket },
    { label: t("nav.support"), href: "/support", icon: LifeBuoy },
    ...(isAdmin ? [{ label: t("nav.admin"), href: "/admin", icon: Shield }] : []),
  ];

  const renderItem = (link: NavItem) => {
    const isActive = location.pathname === link.href || location.pathname.startsWith(link.href + "/");
    const isLinked = !!link.linkType && linkedTypes.has(link.linkType);
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
        {!collapsed && (
          <span className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="truncate">{link.label}</span>
            {isLinked && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                title={pt ? `Vinculado a "${activeProjectTitle}"` : `Linked to "${activeProjectTitle}"`}
              />
            )}
          </span>
        )}
      </Link>
    );
  };

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

        {/* Active project switcher */}
        {!collapsed && (
          <div className="border-b border-border/40 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {pt ? "Projeto ativo" : "Active project"}
            </p>
            <div className="flex items-center gap-1">
              <ProjectPicker
                value={activeProjectId}
                onChange={(id, title) => setActiveProject(id, title)}
                placeholder={pt ? "Nenhum" : "None"}
                className="h-8 text-xs"
              />
              {activeProjectId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  title={pt ? "Limpar projeto ativo" : "Clear active project"}
                  onClick={() => setActiveProject(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Nav links */}
        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-0.5 px-2">
            {renderItem({ label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard })}

            {navGroups.map((group) => (
              <div key={group.title} className="mt-3 first:mt-1">
                {!collapsed && (
                  <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    {group.title}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.items.map(renderItem)}
                </div>
              </div>
            ))}

            <div className="mt-3 flex flex-col gap-0.5 border-t border-border/40 pt-2">
              {footerLinks.map(renderItem)}
            </div>
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
          {!collapsed && (
            <Link
              to="/account/privacy"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("nav.accountPrivacy")}
            </Link>
          )}
          <div className={cn("flex gap-1", collapsed ? "flex-col items-center" : "")}>
            <AdminNotificationsBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLocale}
              aria-label={t("nav.toggleLanguage")}
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
