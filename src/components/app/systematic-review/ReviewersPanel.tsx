import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserCheck, Gavel, X } from "lucide-react";
import type { ReviewerAssignment } from "@/lib/systematicReview/dualScreening";

interface ProjectMember {
  id: string;
  user_id: string | null;
  full_name: string | null;
  invited_email: string | null;
}

interface Props {
  reviewId: string;
  researchProjectId: string | null;
}

const ReviewersPanel = ({ reviewId, researchProjectId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const qc = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["review-project-members", researchProjectId],
    enabled: !!researchProjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_project_members")
        .select("id, user_id, full_name, invited_email")
        .eq("project_id", researchProjectId!)
        .not("user_id", "is", null);
      if (error) throw error;
      return (data ?? []) as ProjectMember[];
    },
  });

  const { data: reviewers = [] } = useQuery({
    queryKey: ["review-reviewers", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("systematic_review_reviewers")
        .select("*")
        .eq("review_id", reviewId);
      if (error) throw error;
      return (data ?? []) as ReviewerAssignment[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["review-reviewers", reviewId] });

  const assign = async (memberId: string, userId: string) => {
    const { error } = await supabase.from("systematic_review_reviewers").insert({
      review_id: reviewId,
      user_id: userId,
      role: "reviewer",
      project_member_id: memberId,
    });
    if (error) return toast.error(error.message);
    invalidate();
  };

  const changeRole = async (id: string, role: "reviewer" | "adjudicator") => {
    const { error } = await supabase.from("systematic_review_reviewers").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("systematic_review_reviewers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const nameOf = (m?: ProjectMember) => m?.full_name || m?.invited_email || "—";

  if (!researchProjectId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        {pt
          ? "Vincule esta revisão a um projeto de pesquisa (botão no topo da página) para poder atribuir revisores."
          : "Link this review to a research project (button at the top of the page) to assign reviewers."}
      </div>
    );
  }

  const unassigned = members.filter((m) => !reviewers.some((r) => r.user_id === m.user_id));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {pt ? "Revisores da triagem" : "Screening reviewers"}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {pt
          ? "Atribua 2 revisores para triagem cega independente. Cada um decide sem ver a decisão do outro; divergências vão para a aba Conflitos."
          : "Assign 2 reviewers for independent blind screening. Each decides without seeing the other's decision; disagreements go to the Conflicts tab."}
      </p>

      {reviewers.length > 0 && (
        <div className="space-y-1.5">
          {reviewers.map((r) => {
            const member = members.find((m) => m.id === r.project_member_id);
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                {r.role === "adjudicator" ? (
                  <Gavel className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="flex-1 truncate">{nameOf(member)}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {r.role === "adjudicator" ? (pt ? "Adjudicador" : "Adjudicator") : (pt ? "Revisor" : "Reviewer")}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs shrink-0"
                  onClick={() => changeRole(r.id, r.role === "adjudicator" ? "reviewer" : "adjudicator")}
                >
                  {pt ? "Alternar papel" : "Toggle role"}
                </Button>
                <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {pt ? "Adicionar do time do projeto" : "Add from project team"}
          </p>
          {unassigned.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-dashed border-border p-2 text-sm">
              <span className="truncate">{nameOf(m)}</span>
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => assign(m.id, m.user_id!)}>
                {pt ? "+ Revisor" : "+ Reviewer"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {pt
            ? "Nenhum membro com conta vinculada neste projeto ainda."
            : "No members with a linked account in this project yet."}
        </p>
      )}
    </div>
  );
};

export default ReviewersPanel;
