import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gavel, AlertTriangle } from "lucide-react";
import {
  cohensKappa,
  reconcilePaper,
  type ReviewerAssignment,
  type ScreeningDecisionRow,
  type ScreeningDecisionValue,
} from "@/lib/systematicReview/dualScreening";

interface Paper {
  id: string;
  title: string;
  year?: number;
}

interface Props {
  reviewId: string;
  papers: Paper[];
  reviewers: ReviewerAssignment[];
  currentUserId: string;
  ownerUserId: string;
  onIncludedIdsComputed: (ids: string[]) => void;
}

const decisionLabel = (d: ScreeningDecisionValue | undefined, pt: boolean) => {
  if (d === "include") return pt ? "Incluir" : "Include";
  if (d === "exclude") return pt ? "Excluir" : "Exclude";
  if (d === "maybe") return pt ? "Talvez" : "Maybe";
  return pt ? "Pendente" : "Pending";
};

const ConflictsPanel = ({ reviewId, papers, reviewers, currentUserId, ownerUserId, onIncludedIdsComputed }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const qc = useQueryClient();

  const reviewerIds = reviewers.filter((r) => r.role === "reviewer").map((r) => r.user_id);
  const adjudicatorId = reviewers.find((r) => r.role === "adjudicator")?.user_id || ownerUserId;

  const { data: decisions = [] } = useQuery({
    queryKey: ["review-decisions-all", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase.from("screening_decisions").select("*").eq("review_id", reviewId);
      if (error) throw error;
      return (data ?? []) as ScreeningDecisionRow[];
    },
  });

  const byPaper = new Map<string, ScreeningDecisionRow[]>();
  for (const d of decisions) {
    if (!byPaper.has(d.paper_id)) byPaper.set(d.paper_id, []);
    byPaper.get(d.paper_id)!.push(d);
  }

  const reconciled = papers.map((p) => ({
    paper: p,
    result: reconcilePaper(byPaper.get(p.id) || [], reviewerIds, adjudicatorId),
  }));

  const conflicts = reconciled.filter((r) => r.result.status === "conflict");
  const agreedOrResolved = reconciled.filter((r) => r.result.status === "agreed" || r.result.status === "resolved");
  const pending = reconciled.filter((r) => r.result.status === "pending");

  const decisionOf = (result: ReturnType<typeof reconcilePaper>): ScreeningDecisionValue | undefined =>
    result.status === "agreed" || result.status === "resolved" ? result.decision : undefined;

  const includedIds = agreedOrResolved
    .filter((r) => {
      const d = decisionOf(r.result);
      return d === "include" || d === "maybe";
    })
    .map((r) => r.paper.id);
  const includedKey = includedIds.slice().sort().join(",");

  useEffect(() => {
    onIncludedIdsComputed(includedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includedKey]);

  const resolve = async (paperId: string, decision: ScreeningDecisionValue) => {
    const { error } = await supabase.from("screening_decisions").upsert(
      { review_id: reviewId, paper_id: paperId, user_id: currentUserId, decision },
      { onConflict: "review_id,paper_id,user_id" },
    );
    if (error) return;
    qc.invalidateQueries({ queryKey: ["review-decisions-all", reviewId] });
  };

  const canAdjudicate = currentUserId === adjudicatorId;

  let kappa: number | null = null;
  if (reviewerIds.length === 2) {
    const [uidA, uidB] = reviewerIds;
    const pairs: [string, string][] = [];
    for (const p of papers) {
      const ds = byPaper.get(p.id) || [];
      const a = ds.find((d) => d.user_id === uidA && d.decision !== "pending");
      const b = ds.find((d) => d.user_id === uidB && d.decision !== "pending");
      if (a && b) pairs.push([a.decision, b.decision]);
    }
    kappa = cohensKappa(pairs);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{pt ? "Conflitos de triagem" : "Screening conflicts"}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{agreedOrResolved.length} {pt ? "concordam" : "agreed"}</span>
          <span>· {conflicts.length} {pt ? "conflitos" : "conflicts"}</span>
          <span>· {pending.length} {pt ? "pendentes" : "pending"}</span>
          {kappa !== null && (
            <Badge variant="outline" className="text-[10px]" title={pt ? "Confiabilidade inter-avaliador entre os 2 revisores humanos" : "Inter-rater reliability between the 2 human reviewers"}>
              {pt ? "κ entre revisores" : "κ inter-reviewer"} = {kappa.toFixed(2)}
              {kappa >= 0.8 ? " ✅" : kappa >= 0.6 ? " ⚠️" : " ❌"}
            </Badge>
          )}
        </div>
      </div>

      {conflicts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {pt ? "Nenhum conflito no momento." : "No conflicts right now."}
        </p>
      ) : (
        <div className="space-y-2">
          {conflicts.map(({ paper }) => {
            const paperDecisions = byPaper.get(paper.id) || [];
            return (
              <div key={paper.id} className="rounded-lg border border-yellow-300/50 bg-yellow-50 dark:bg-yellow-950/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-foreground flex-1">{paper.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {reviewerIds.map((uid) => {
                    const d = paperDecisions.find((x) => x.user_id === uid);
                    return (
                      <Badge key={uid} variant="outline" className="text-[10px]">
                        {pt ? "Revisor" : "Reviewer"} {uid.slice(0, 6)}: {decisionLabel(d?.decision as ScreeningDecisionValue, pt)}
                      </Badge>
                    );
                  })}
                </div>
                {canAdjudicate ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => resolve(paper.id, "include")} className="h-7 text-xs">
                      {pt ? "Adjudicar: Incluir" : "Adjudicate: Include"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => resolve(paper.id, "exclude")} className="h-7 text-xs">
                      {pt ? "Adjudicar: Excluir" : "Adjudicate: Exclude"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {pt ? "Aguardando adjudicação." : "Awaiting adjudication."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConflictsPanel;
