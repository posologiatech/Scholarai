import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, HelpCircle, EyeOff } from "lucide-react";
import type { ScreeningDecisionRow, ScreeningDecisionValue } from "@/lib/systematicReview/dualScreening";

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
}

interface Props {
  reviewId: string;
  papers: Paper[];
  currentUserId: string;
}

const DualScreeningPanel = ({ reviewId, papers, currentUserId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(true);

  const { data: decisions = [] } = useQuery({
    queryKey: ["my-screening-decisions", reviewId, currentUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screening_decisions")
        .select("*")
        .eq("review_id", reviewId)
        .eq("user_id", currentUserId);
      if (error) throw error;
      return (data ?? []) as ScreeningDecisionRow[];
    },
  });

  const byPaper = new Map(decisions.map((d) => [d.paper_id, d]));
  const decidedCount = decisions.filter((d) => d.decision !== "pending").length;

  const decide = async (paperId: string, decision: ScreeningDecisionValue) => {
    const { error } = await supabase.from("screening_decisions").upsert(
      { review_id: reviewId, paper_id: paperId, user_id: currentUserId, decision },
      { onConflict: "review_id,paper_id,user_id" },
    );
    if (error) return;
    qc.invalidateQueries({ queryKey: ["my-screening-decisions", reviewId, currentUserId] });
    qc.invalidateQueries({ queryKey: ["review-decisions-all", reviewId] });
  };

  const visiblePapers = onlyPending ? papers.filter((p) => !byPaper.get(p.id) || byPaper.get(p.id)?.decision === "pending") : papers;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            {pt ? "Minha triagem (cega)" : "My screening (blind)"}
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">{decidedCount}/{papers.length} {pt ? "decididos" : "decided"}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {pt
          ? "Suas decisões são independentes e ficam ocultas dos demais revisores até a reconciliação."
          : "Your decisions are independent and hidden from the other reviewers until reconciliation."}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant={onlyPending ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setOnlyPending(true)}>
          {pt ? "Pendentes" : "Pending"}
        </Button>
        <Button size="sm" variant={!onlyPending ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setOnlyPending(false)}>
          {pt ? "Todos" : "All"}
        </Button>
      </div>
      <div className="max-h-[420px] overflow-y-auto space-y-1 rounded-lg border border-border">
        {visiblePapers.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">
            {pt ? "Nenhum artigo pendente. 🎉" : "No pending papers. 🎉"}
          </p>
        )}
        {visiblePapers.map((paper) => {
          const decision = byPaper.get(paper.id)?.decision as ScreeningDecisionValue | undefined;
          const isExpanded = expanded === paper.id;
          return (
            <div key={paper.id} className="border-b border-border last:border-0 p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : paper.id)}>
                  <p className="text-sm font-medium text-foreground truncate">{paper.title}</p>
                  <p className="text-xs text-muted-foreground">{paper.year && `(${paper.year})`}</p>
                  {isExpanded && paper.abstract && (
                    <p className="mt-1 text-xs text-muted-foreground">{paper.abstract}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant={decision === "include" ? "default" : "outline"}
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => decide(paper.id, "include")}
                  >
                    <CheckCircle2 className="h-3 w-3" /> {pt ? "Incluir" : "Include"}
                  </Button>
                  <Button
                    size="sm"
                    variant={decision === "maybe" ? "secondary" : "outline"}
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => decide(paper.id, "maybe")}
                  >
                    <HelpCircle className="h-3 w-3" /> {pt ? "Talvez" : "Maybe"}
                  </Button>
                  <Button
                    size="sm"
                    variant={decision === "exclude" ? "destructive" : "outline"}
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => decide(paper.id, "exclude")}
                  >
                    <XCircle className="h-3 w-3" /> {pt ? "Excluir" : "Exclude"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DualScreeningPanel;
