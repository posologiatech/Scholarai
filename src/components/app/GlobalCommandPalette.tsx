import { useState, useEffect, useMemo, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCommandPalette } from "@/contexts/CommandPaletteContext";
import {
  Compass, Search, BookOpen, Table, FileText, ShieldCheck, Palette, Bell,
  BrainCircuit, LayoutDashboard, GitBranch, Activity, BarChart3, ClipboardCheck, ClipboardList,
  Network, Users, PenLine, FlaskConical, Award, Database, Loader2,
} from "lucide-react";

interface Hit {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
  route: string;
}

interface NavEntry {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export default function GlobalCommandPalette() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const pt = locale === "pt";
  const navigate = useNavigate();
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const navEntries: NavEntry[] = useMemo(() => [
    { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.discover"), href: "/discover", icon: Compass },
    { label: t("nav.library"), href: "/library", icon: BookOpen },
    { label: t("nav.extraction"), href: "/extraction", icon: Table },
    { label: t("nav.reports"), href: "/reports", icon: FileText },
    { label: "Ref. Check", href: "/reference-check", icon: ShieldCheck },
    { label: t("nav.illustrations"), href: "/illustrations", icon: Palette },
    { label: t("nav.alerts"), href: "/alerts", icon: Bell },
    { label: "DataMind", href: "/datamind", icon: BrainCircuit },
    { label: "Dashboards", href: "/datamind/dashboards", icon: LayoutDashboard },
    { label: "Pipelines", href: "/datamind/pipelines", icon: GitBranch },
    { label: "DataSUS / SINAN", href: "/datasus", icon: Activity },
    { label: t("nav.metaAnalysis"), href: "/meta-analysis", icon: BarChart3 },
    { label: t("nav.riskOfBias"), href: "/risk-of-bias", icon: ClipboardCheck },
    { label: t("nav.surveys"), href: "/surveys", icon: ClipboardList },
    { label: pt ? "Revisão sistemática" : "Systematic review", href: "/systematic-review", icon: ClipboardCheck },
    { label: t("nav.knowledgeGraph"), href: "/knowledge-graph", icon: Network },
    { label: t("nav.coauthorship"), href: "/coauthorship", icon: Users },
    { label: t("nav.writing"), href: "/writing", icon: PenLine },
    { label: t("nav.researchProjects"), href: "/research", icon: FlaskConical },
    { label: t("nav.fundingCalls"), href: "/research/funding", icon: Award },
    { label: "Workspaces", href: "/workspaces", icon: Users },
  ], [t, pt]);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["command-palette-search", debouncedQuery],
    enabled: !!user && debouncedQuery.length >= 2,
    queryFn: async () => {
      const q = `%${debouncedQuery}%`;
      const results = await Promise.allSettled([
        supabase.from("research_projects").select("id, title").ilike("title", q).order("updated_at", { ascending: false }).limit(5),
        supabase.from("writing_documents").select("id, title").ilike("title", q).order("updated_at", { ascending: false }).limit(5),
        supabase.from("illustrations").select("id, prompt").ilike("prompt", q).order("created_at", { ascending: false }).limit(5),
        supabase.from("datamind_conversations").select("id, title").ilike("title", q).order("updated_at", { ascending: false }).limit(5),
        supabase.from("datamind_files").select("id, file_name, conversation_id").ilike("file_name", q).order("created_at", { ascending: false }).limit(5),
        supabase.from("saved_searches").select("id, query").ilike("query", q).order("created_at", { ascending: false }).limit(5),
        supabase.from("surveys").select("id, title").ilike("title", q).order("updated_at", { ascending: false }).limit(5),
        supabase.from("systematic_reviews").select("id, research_question").ilike("research_question", q).order("updated_at", { ascending: false }).limit(5),
        supabase.from("workspaces").select("id, name").ilike("name", q).order("updated_at", { ascending: false }).limit(5),
      ]);

      const [projects, docs, illustrations, dmConvos, dmFiles, searches, surveys, reviews, workspaces] = results;

      const out: Hit[] = [];
      const group = pt ? {
        projects: "Projetos", docs: "Documentos", illustrations: "Ilustrações", datamind: "DataMind",
        datasets: "Datasets", searches: "Buscas salvas", surveys: "Coleta de Dados",
        reviews: "Revisões sistemáticas", workspaces: "Workspaces",
      } : {
        projects: "Projects", docs: "Documents", illustrations: "Illustrations", datamind: "DataMind",
        datasets: "Datasets", searches: "Saved searches", surveys: "Data Collection",
        reviews: "Systematic reviews", workspaces: "Workspaces",
      };

      if (projects.status === "fulfilled" && projects.value.data) {
        for (const r of projects.value.data as { id: string; title: string }[]) {
          out.push({ id: r.id, title: r.title, icon: FlaskConical, group: group.projects, route: `/research/${r.id}` });
        }
      }
      if (docs.status === "fulfilled" && docs.value.data) {
        for (const r of docs.value.data as { id: string; title: string }[]) {
          out.push({ id: r.id, title: r.title || (pt ? "Documento sem título" : "Untitled document"), icon: PenLine, group: group.docs, route: `/writing?docId=${r.id}` });
        }
      }
      if (illustrations.status === "fulfilled" && illustrations.value.data) {
        for (const r of illustrations.value.data as { id: string; prompt: string }[]) {
          out.push({ id: r.id, title: r.prompt.slice(0, 80), icon: Palette, group: group.illustrations, route: "/illustrations" });
        }
      }
      if (dmConvos.status === "fulfilled" && dmConvos.value.data) {
        for (const r of dmConvos.value.data as { id: string; title: string }[]) {
          out.push({ id: r.id, title: r.title, icon: BrainCircuit, group: group.datamind, route: `/datamind/${r.id}` });
        }
      }
      if (dmFiles.status === "fulfilled" && dmFiles.value.data) {
        for (const r of dmFiles.value.data as { id: string; file_name: string; conversation_id: string | null }[]) {
          out.push({
            id: r.id, title: r.file_name, icon: Database, group: group.datasets,
            route: r.conversation_id ? `/datamind/${r.conversation_id}` : "/datamind",
          });
        }
      }
      if (searches.status === "fulfilled" && searches.value.data) {
        for (const r of searches.value.data as { id: string; query: string }[]) {
          out.push({ id: r.id, title: r.query, icon: Search, group: group.searches, route: "/library" });
        }
      }
      if (surveys.status === "fulfilled" && surveys.value.data) {
        for (const r of surveys.value.data as { id: string; title: string }[]) {
          out.push({ id: r.id, title: r.title, icon: ClipboardList, group: group.surveys, route: `/surveys/${r.id}/build` });
        }
      }
      if (reviews.status === "fulfilled" && reviews.value.data) {
        for (const r of reviews.value.data as { id: string; research_question: string }[]) {
          out.push({ id: r.id, title: r.research_question, icon: ClipboardCheck, group: group.reviews, route: `/systematic-review/new?id=${r.id}` });
        }
      }
      if (workspaces.status === "fulfilled" && workspaces.value.data) {
        for (const r of workspaces.value.data as { id: string; name: string }[]) {
          out.push({ id: r.id, title: r.name, icon: Users, group: group.workspaces, route: `/workspaces/${r.id}` });
        }
      }
      return out;
    },
  });

  const hitsByGroup = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const hit of hits) {
      if (!map.has(hit.group)) map.set(hit.group, []);
      map.get(hit.group)!.push(hit);
    }
    return map;
  }, [hits]);

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const showingSearch = debouncedQuery.length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <DialogTitle className="sr-only">{pt ? "Busca rápida" : "Quick search"}</DialogTitle>
        <Command
          shouldFilter={!showingSearch}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder={pt ? "Buscar projetos, documentos, ilustrações, datasets..." : "Search projects, documents, illustrations, datasets..."}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {showingSearch && isFetching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {pt ? "Buscando..." : "Searching..."}
              </div>
            )}
            {showingSearch && !isFetching && hits.length === 0 && (
              <CommandEmpty>{pt ? "Nada encontrado." : "Nothing found."}</CommandEmpty>
            )}
            {showingSearch
              ? Array.from(hitsByGroup.entries()).map(([groupLabel, groupHits]) => (
                  <CommandGroup key={groupLabel} heading={groupLabel}>
                    {groupHits.map((hit) => (
                      <CommandItem key={`${hit.group}-${hit.id}`} value={`${hit.group}-${hit.id}`} onSelect={() => go(hit.route)}>
                        <hit.icon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{hit.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              : (
                <CommandGroup heading={pt ? "Navegar" : "Navigate"}>
                  {navEntries.map((entry) => (
                    <CommandItem key={entry.href} value={entry.label} onSelect={() => go(entry.href)}>
                      <entry.icon className="mr-2 h-4 w-4 shrink-0" />
                      <span>{entry.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
