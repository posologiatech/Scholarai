import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { fetchCoauthorCorpus, buildCoauthorGraph, namesLooselyMatch } from "@/lib/research/coauthorGraph";

interface Member {
  id: string;
  full_name: string | null;
}

interface Suggestion {
  name: string;
  weight: number;
  viaMembers: string[];
}

/**
 * Cross-references the current project's team against the user's whole indexed
 * co-authorship graph (same corpus as /coauthorship) to surface people who have
 * published with existing members but aren't on the team yet. Name matching is a
 * best-effort heuristic (exact, or same surname + first initial) — external author
 * strings vary in format across sources, so this is a suggestion, not a guarantee.
 */
export default function SuggestedCollaborators({ projectId, members }: { projectId: string; members: Member[] }) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  const memberNames = useMemo(
    () => members.map((m) => m.full_name).filter((n): n is string => !!n && n.trim().length > 0),
    [members],
  );

  const { data: corpus = [] } = useQuery({
    queryKey: ["coauthor-corpus"],
    queryFn: fetchCoauthorCorpus,
    enabled: memberNames.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo<Suggestion[]>(() => {
    if (memberNames.length === 0 || corpus.length === 0) return [];
    const { authorPapers, edgeMap } = buildCoauthorGraph(corpus);
    const authorNames = Object.keys(authorPapers);

    const isCurrentMember = (name: string) => memberNames.some((m) => namesLooselyMatch(m, name));

    const byOther = new Map<string, Suggestion>();
    for (const memberName of memberNames) {
      const matchedAuthor = authorNames.find((a) => namesLooselyMatch(memberName, a));
      if (!matchedAuthor) continue;

      for (const [key, edge] of Object.entries(edgeMap)) {
        const [a, b] = key.split("|||");
        if (a !== matchedAuthor && b !== matchedAuthor) continue;
        const other = a === matchedAuthor ? b : a;
        if (isCurrentMember(other)) continue;

        const existing = byOther.get(other);
        if (existing) {
          existing.weight += edge.weight;
          if (!existing.viaMembers.includes(memberName)) existing.viaMembers.push(memberName);
        } else {
          byOther.set(other, { name: other, weight: edge.weight, viaMembers: [memberName] });
        }
      }
    }

    return Array.from(byOther.values())
      .filter((s) => !dismissed.has(s.name))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [corpus, memberNames, dismissed]);

  const addToTeam = async (s: Suggestion) => {
    setAdding(s.name);
    const { error } = await supabase.from("research_project_members").insert({
      project_id: projectId,
      full_name: s.name,
      role: "colaborador",
      accepted: false,
    });
    setAdding(null);
    if (error) return toast.error(error.message);
    toast.success(pt ? `"${s.name}" adicionado à equipe` : `"${s.name}" added to the team`);
    qc.invalidateQueries({ queryKey: ["research-members-credit", projectId] });
    qc.invalidateQueries({ queryKey: ["research-members", projectId] });
  };

  const dismiss = (name: string) => setDismissed((prev) => new Set(prev).add(name));

  if (memberNames.length === 0 || suggestions.length === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-indigo-500/5 to-transparent">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <p className="text-sm font-semibold">{pt ? "Colaboradores sugeridos" : "Suggested collaborators"}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {pt
            ? "Encontrados na sua rede de coautorias, mas ainda fora da equipe deste projeto."
            : "Found in your co-authorship network, but not yet on this project's team."}
        </p>
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {pt
                    ? `Coautor de ${s.viaMembers.join(", ")} · ${s.weight} artigo(s) em comum`
                    : `Co-author of ${s.viaMembers.join(", ")} · ${s.weight} shared paper(s)`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" disabled={adding === s.name} onClick={() => addToTeam(s)}>
                  <Plus className="h-3.5 w-3.5" />
                  {pt ? "Adicionar" : "Add"}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => dismiss(s.name)} title={pt ? "Ignorar" : "Dismiss"}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
