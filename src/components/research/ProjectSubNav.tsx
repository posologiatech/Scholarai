import { useEffect, useState } from "react";
import { FileText, Users2, BookOpen, CheckSquare, CalendarRange, Mic, GraduationCap, Lightbulb, FileSignature, Wallet, ShieldCheck, NotebookPen, Award, AlertTriangle, UserCheck, Package, Activity, Link2, Star, PanelLeftClose, PanelLeft, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

export type TabId =
  | "overview" | "activity" | "favorites"
  | "tasks" | "schedule" | "meetings" | "logbook"
  | "team" | "advisees" | "credit" | "defense"
  | "refs" | "pubs" | "outputs" | "docs" | "brainstorm"
  | "budget" | "ethics" | "compliance" | "risks" | "evals"
  | "integrations";

export type Counters = Partial<Record<TabId, number>>;

type Item = { id: TabId; icon: any; pt: string; en: string };
type Section = { id: string; pt: string; en: string; items: Item[] };

export const SECTIONS: Section[] = [
  { id: "workspace", pt: "Workspace", en: "Workspace", items: [
    { id: "overview", icon: FileText, pt: "Visão geral", en: "Overview" },
    { id: "activity", icon: Activity, pt: "Atividade", en: "Activity" },
    { id: "favorites", icon: Star, pt: "Favoritos", en: "Favorites" },
  ]},
  { id: "execucao", pt: "Execução", en: "Execution", items: [
    { id: "tasks", icon: CheckSquare, pt: "Tarefas", en: "Tasks" },
    { id: "schedule", icon: CalendarRange, pt: "Cronograma", en: "Schedule" },
    { id: "meetings", icon: Mic, pt: "Reuniões", en: "Meetings" },
    { id: "logbook", icon: NotebookPen, pt: "Diário de Bordo", en: "Logbook" },
  ]},
  { id: "pessoas", pt: "Pessoas", en: "People", items: [
    { id: "team", icon: Users2, pt: "Equipe", en: "Team" },
    { id: "advisees", icon: GraduationCap, pt: "Orientações", en: "Advisees" },
    { id: "credit", icon: UserCheck, pt: "Autoria CRediT", en: "CRediT" },
  ]},
  { id: "conhecimento", pt: "Conhecimento", en: "Knowledge", items: [
    { id: "refs", icon: BookOpen, pt: "Referências", en: "References" },
    { id: "pubs", icon: FileText, pt: "Publicações", en: "Publications" },
    { id: "outputs", icon: Package, pt: "Outputs", en: "Outputs" },
    { id: "docs", icon: FileSignature, pt: "Documentos", en: "Documents" },
    { id: "brainstorm", icon: Lightbulb, pt: "Brainstorm IA", en: "Brainstorm AI" },
  ]},
  { id: "governanca", pt: "Governança", en: "Governance", items: [
    { id: "budget", icon: Wallet, pt: "Orçamento", en: "Budget" },
    { id: "ethics", icon: ShieldCheck, pt: "Ética", en: "Ethics" },
    { id: "compliance", icon: ShieldCheck, pt: "Conformidade", en: "Compliance" },
    { id: "risks", icon: AlertTriangle, pt: "Riscos", en: "Risks" },
    { id: "evals", icon: Award, pt: "Avaliações", en: "Evaluations" },
  ]},
  { id: "sistema", pt: "Sistema", en: "System", items: [
    { id: "integrations", icon: Link2, pt: "Integrações", en: "Integrations" },
  ]},
];

export const ALL_TAB_IDS = SECTIONS.flatMap(s => s.items.map(i => i.id));

interface Props {
  projectTitle: string;
  projectStatus?: string;
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  counters?: Counters;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ProjectSubNav({ projectTitle, projectStatus, activeTab, onTabChange, counters = {}, collapsed, onToggleCollapse }: Props) {
  const { locale } = useLanguage();
  const [query, setQuery] = useState("");

  const initials = projectTitle.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const filterMatch = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          "shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-sm flex flex-col transition-[width] duration-200",
          collapsed ? "w-14" : "w-60"
        )}
      >
        {/* Project header */}
        <div className={cn("flex items-center gap-2.5 px-3 py-3 border-b border-border/60", collapsed && "justify-center px-0")}>
          <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center text-xs font-semibold shadow-sm">
            {initials || "P"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate leading-tight">{projectTitle}</div>
              {projectStatus && <div className="text-[11px] text-muted-foreground truncate">{projectStatus}</div>}
            </div>
          )}
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={locale === "pt" ? "Buscar seção..." : "Find section..."}
                className="w-full pl-7 pr-2 h-8 text-xs rounded-md bg-muted/50 border border-transparent focus:bg-background focus:border-border outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
          {SECTIONS.map(section => {
            const items = section.items.filter(i => filterMatch(locale === "pt" ? i.pt : i.en));
            if (items.length === 0) return null;
            return (
              <div key={section.id}>
                {!collapsed && (
                  <div className="px-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {locale === "pt" ? section.pt : section.en}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map(item => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    const label = locale === "pt" ? item.pt : item.en;
                    const counter = counters[item.id];
                    const button = (
                      <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                          "group w-full flex items-center gap-2.5 rounded-md text-sm transition-colors relative",
                          collapsed ? "h-9 justify-center px-0" : "h-8 px-2",
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />}
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={1.75} />
                        {!collapsed && <span className="truncate flex-1 text-left">{label}</span>}
                        {!collapsed && counter !== undefined && counter > 0 && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          )}>{counter}</span>
                        )}
                      </button>
                    );
                    return collapsed ? (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">{label}{counter ? ` · ${counter}` : ""}</TooltipContent>
                      </Tooltip>
                    ) : button;
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/60 p-2">
          <button
            onClick={onToggleCollapse}
            className={cn(
              "w-full flex items-center gap-2 h-8 rounded-md text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors",
              collapsed ? "justify-center" : "px-2"
            )}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>{locale === "pt" ? "Recolher" : "Collapse"}</span></>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export function useProjectSubNavState() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("research-subnav-collapsed") === "1";
  });
  useEffect(() => {
    localStorage.setItem("research-subnav-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  return { collapsed, toggle: () => setCollapsed(c => !c) };
}
