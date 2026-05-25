import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { GraduationCap, ArrowLeft, BookOpen, Activity } from "lucide-react";

export default function AdvisorDashboard() {
  const { user } = useAuth();
  const { locale } = useLanguage();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["advisor-projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: pj } = await supabase.from("research_projects").select("*").eq("owner_id", user!.id);
      const { data: pm } = await supabase.from("research_project_members")
        .select("project_id, research_projects(*)").eq("user_id", user!.id).in("role", ["pi", "co_pi"]);
      const all = new Map<string, any>();
      (pj ?? []).forEach(p => all.set(p.id, p));
      (pm ?? []).forEach((m: any) => m.research_projects && all.set(m.research_projects.id, m.research_projects));
      const ids = Array.from(all.keys());
      if (!ids.length) return [];
      const [advisees, tasks, logs, pubs] = await Promise.all([
        supabase.from("research_advisees").select("*").in("project_id", ids),
        supabase.from("research_tasks").select("project_id,status").in("project_id", ids),
        supabase.from("research_logbook_entries").select("project_id,status,entry_date").in("project_id", ids),
        supabase.from("research_publications").select("project_id,status").in("project_id", ids),
      ]);
      return ids.map(id => {
        const p = all.get(id);
        const ads = (advisees.data ?? []).filter((a: any) => a.project_id === id);
        const ts = (tasks.data ?? []).filter((t: any) => t.project_id === id);
        const lg = (logs.data ?? []).filter((l: any) => l.project_id === id);
        const pb = (pubs.data ?? []).filter((x: any) => x.project_id === id);
        const pending = lg.filter((l: any) => l.status === "assinado").length;
        const lastLog = lg.map((l: any) => l.entry_date).sort().pop() || null;
        return {
          ...p, advisees: ads, totalTasks: ts.length,
          doneTasks: ts.filter((t: any) => t.status === "concluida").length,
          pendingSignatures: pending, lastLogDate: lastLog,
          publishedCount: pb.filter((x: any) => x.status === "publicado").length,
          totalPubs: pb.length,
        };
      });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/research"><ArrowLeft className="h-4 w-4" />{locale === "pt" ? "Voltar" : "Back"}</Link>
      </Button>
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          {locale === "pt" ? "Modo Orientador" : "Advisor Mode"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {locale === "pt" ? "Visão consolidada de todos os projetos onde você atua como PI ou co-PI." : "Consolidated view of all projects where you are PI or co-PI."}
        </p>
      </header>

      {isLoading && <p className="text-muted-foreground">{locale === "pt" ? "Carregando..." : "Loading..."}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base line-clamp-2">
                <Link to={`/research/${p.id}`} className="hover:text-primary">{p.title}</Link>
              </CardTitle>
              <Badge variant="outline" className="w-fit text-[10px]">{p.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">{locale === "pt" ? "Orientandos" : "Advisees"}</span><span className="font-medium">{p.advisees.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{locale === "pt" ? "Tarefas" : "Tasks"}</span><span className="font-medium">{p.doneTasks}/{p.totalTasks}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{locale === "pt" ? "Publicações" : "Publications"}</span><span className="font-medium">{p.publishedCount}/{p.totalPubs}</span></div>
              {p.pendingSignatures > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{locale === "pt" ? "Contra-assinaturas pendentes" : "Pending countersignatures"}</span>
                  <span className="font-bold">{p.pendingSignatures}</span>
                </div>
              )}
              {p.lastLogDate && (
                <div className="flex justify-between text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{locale === "pt" ? "Última entrada" : "Last log"}</span>
                  <span>{p.lastLogDate}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && !projects.length && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            {locale === "pt" ? "Nenhum projeto onde você atua como PI/co-PI." : "No projects where you are PI/co-PI."}
          </p>
        )}
      </div>
    </div>
  );
}
