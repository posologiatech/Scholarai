import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Trash2, Search, BookOpen, BarChart3, PenLine, ClipboardList, ListChecks, Sigma, Wallet, Share2, Plus, Image, Users, Stethoscope, ShieldCheck, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { fetchProjectLinks, unlinkResource } from "@/lib/research/integrations";
import { LINK_TYPE_LABEL, type ResearchLinkType } from "@/lib/research/types";

const TYPE_ICON: Record<ResearchLinkType, any> = {
  search: Search,
  library: BookOpen,
  datamind: BarChart3,
  writing: PenLine,
  survey: ClipboardList,
  systematic_review: ListChecks,
  meta_analysis: Sigma,
  funding: Wallet,
  knowledge_graph: Share2,
  illustration: Image,
  coauthorship: Users,
  datasus: Stethoscope,
  reference_check: ShieldCheck,
  workspace: FolderOpen,
};

const GROUP_ORDER: ResearchLinkType[] = [
  "search", "library", "writing", "datamind", "survey", "systematic_review", "meta_analysis",
  "knowledge_graph", "coauthorship", "illustration", "datasus", "reference_check", "workspace", "funding",
];

interface Props { projectId: string }

export default function ConnectionsTab({ projectId }: Props) {
  const { locale } = useLanguage();
  const qc = useQueryClient();

  const { data: links = [] } = useQuery({
    queryKey: ["research-project-links", projectId],
    queryFn: () => fetchProjectLinks(projectId),
  });

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const l of links as any[]) {
      (map[l.resource_type] ||= []).push(l);
    }
    return map;
  }, [links]);

  const remove = async (id: string) => {
    try {
      await unlinkResource(id);
      qc.invalidateQueries({ queryKey: ["research-project-links", projectId] });
      toast.success(locale === "pt" ? "Vínculo removido" : "Link removed");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resourceHref = (l: any): string => {
    const base = LINK_TYPE_LABEL[l.resource_type as ResearchLinkType]?.route || "/";
    switch (l.resource_type) {
      case "datamind": return l.resource_id ? `/datamind/${l.resource_id}` : "/datamind";
      case "survey": return l.resource_id ? `/surveys/${l.resource_id}/build` : "/surveys";
      case "knowledge_graph": return "/knowledge-graph";
      case "coauthorship": return "/coauthorship";
      case "workspace": return l.resource_id ? `/workspaces/${l.resource_id}` : "/workspaces";
      default: return l.url || base;
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <h3 className="text-sm font-semibold">{locale === "pt" ? "Conexões do projeto" : "Project connections"}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          {locale === "pt"
            ? "Centralize aqui todos os recursos da plataforma ligados a este projeto: buscas, biblioteca, análises do DataMind, escrita científica, pesquisas de coleta, revisões sistemáticas e editais. Vincule recursos a partir de cada módulo usando o botão \"Vincular a projeto\"."
            : "Centralize every platform resource linked to this project: searches, library, DataMind analyses, scientific writing, surveys, systematic reviews and funding calls. Link resources from each module using the \"Link to project\" button."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {GROUP_ORDER.map((type) => {
          const items = grouped[type] || [];
          const Icon = TYPE_ICON[type];
          const meta = LINK_TYPE_LABEL[type];
          return (
            <Card key={type} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {meta[locale]}
                  </span>
                  <div className="flex items-center gap-2">
                    {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      <Link to={meta.route}><Plus className="h-3.5 w-3.5" />{locale === "pt" ? "Abrir" : "Open"}</Link>
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">
                    {locale === "pt" ? "Nenhum recurso vinculado." : "No linked resources."}
                  </p>
                )}
                {items.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2.5 py-1.5 text-sm hover:bg-muted/40 transition-colors">
                    <span className="truncate flex-1">{l.label || l.resource_id || "—"}</span>
                    <Button asChild size="icon" variant="ghost" className="h-6 w-6">
                      <a href={resourceHref(l)} target={l.url ? "_blank" : undefined} rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
