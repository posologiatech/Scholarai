import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, FileText, Calendar, Award } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { STATUS_LABEL } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PublicProject() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useLanguage();
  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);

  const { data: project, isLoading } = useQuery({
    queryKey: ["public-project", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_projects")
        .select("*").eq("public_slug", slug!).eq("is_public", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: publications = [] } = useQuery({
    queryKey: ["public-pubs", project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      const { data } = await supabase.from("research_publications")
        .select("*").eq("project_id", project!.id).order("year", { ascending: false });
      return data ?? [];
    },
  });

  const { data: schedule = [] } = useQuery({
    queryKey: ["public-schedule", project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      const { data } = await supabase.from("research_schedule_items")
        .select("*").eq("project_id", project!.id).order("start_date");
      return data ?? [];
    },
  });

  if (isLoading) return <div className="p-12 text-center">{t("Carregando...", "Loading...")}</div>;
  if (!project) return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md"><CardContent className="py-12 text-center">
        <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-xl font-bold">{t("Projeto não encontrado", "Project not found")}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t("Este projeto pode estar privado ou o link está incorreto.", "This project may be private or the link is incorrect.")}</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Globe className="h-3 w-3" />{t("Página pública", "Public page")}
        </div>
        <h1 className="text-4xl font-display font-bold mb-3">{project.title}</h1>
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <Badge>{STATUS_LABEL[project.status as keyof typeof STATUS_LABEL][locale]}</Badge>
          {project.cnpq_area && <Badge variant="outline">{project.cnpq_area}</Badge>}
          {project.start_date && <span className="text-xs text-muted-foreground">{new Date(project.start_date).toLocaleDateString()} {project.end_date && `→ ${new Date(project.end_date).toLocaleDateString()}`}</span>}
        </div>
        {project.description && <p className="text-lg text-muted-foreground mb-8">{project.description}</p>}

        {project.objectives && (
          <Card className="mb-6"><CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />{t("Objetivos", "Objectives")}</CardTitle></CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{project.objectives}</ReactMarkdown></CardContent></Card>
        )}

        {project.full_content && (
          <Card className="mb-6"><CardHeader><CardTitle className="text-base">{t("Sobre o projeto", "About the project")}</CardTitle></CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{project.full_content}</ReactMarkdown></CardContent></Card>
        )}

        {schedule.length > 0 && (
          <Card className="mb-6"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />{t("Cronograma", "Schedule")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {schedule.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.start_date && new Date(s.start_date).toLocaleDateString()} {s.end_date && `→ ${new Date(s.end_date).toLocaleDateString()}`}</p>
                  </div>
                  <Badge variant="outline">{s.progress || 0}%</Badge>
                </div>
              ))}
            </CardContent></Card>
        )}

        {publications.length > 0 && (
          <Card className="mb-6"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />{t("Publicações", "Publications")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {publications.map((p: any) => (
                <div key={p.id} className="py-2 border-b last:border-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.venue}{p.year ? ` · ${p.year}` : ""}</p>
                  {p.doi && <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">DOI: {p.doi}</a>}
                </div>
              ))}
            </CardContent></Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-12">
          {t("Publicado via", "Published via")} <a href="/" className="text-primary hover:underline">ScholarAI</a>
        </p>
      </div>
    </div>
  );
}
