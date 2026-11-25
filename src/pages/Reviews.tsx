import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewReviewDialog } from "@/components/review/NewReviewDialog";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { deleteReview, listReviews } from "@/lib/review/api";
import type { ReviewRecord } from "@/lib/review/protocol";
import { getReviewType } from "@/lib/review/types";

const Reviews = () => {
  const { locale } = useLanguage();
  const lang = (locale === "pt" ? "pt" : "en") as "pt" | "en";
  const pt = lang === "pt";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    listReviews()
      .then(setReviews)
      .catch((e) => { console.error(e); toast.error(pt ? "Erro ao carregar as revisões" : "Failed to load reviews"); })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const remove = async (id: string) => {
    try {
      await deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success(pt ? "Revisão excluída" : "Review deleted");
    } catch {
      toast.error(pt ? "Erro ao excluir" : "Failed to delete");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-foreground">{pt ? "Revisões guiadas" : "Guided reviews"}</h1>
              <p className="text-sm text-muted-foreground">
                {pt ? "Sistemática, de escopo ou integrativa, conduzida etapa por etapa." : "Systematic, scoping or integrative, guided step by step."}
              </p>
            </div>
            <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="h-4 w-4" />{pt ? "Nova revisão" : "New review"}</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">{pt ? "Nenhuma revisão ainda. Escolha o tipo e o sistema guia o resto." : "No reviews yet. Pick a type and the system guides the rest."}</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreating(true)}>{pt ? "Começar uma revisão" : "Start a review"}</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.map((r) => {
                const def = getReviewType(r.review_type);
                const stage = def?.stages.find((s) => s.key === r.current_stage);
                return (
                  <div
                    key={r.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/reviews/${r.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/reviews/${r.id}`); }}
                    className="flex min-w-0 cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{r.title || (pt ? "Sem título" : "Untitled")}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{def?.label[lang] ?? r.review_type}</span>
                        {stage && <><span>·</span><span>{stage.title[lang]}</span></>}
                        <span>·</span>
                        <span>{new Date(r.updated_at).toLocaleDateString(pt ? "pt-BR" : "en-US")}</span>
                      </div>
                    </div>
                    {r.protocol_locked_at && <Badge variant="outline" className="gap-1 text-xs"><Lock className="h-3 w-3" />{pt ? "Protocolo congelado" : "Protocol locked"}</Badge>}
                    {r.owner_id === user?.id && (
                      <button
                        aria-label={pt ? "Excluir revisão" : "Delete review"}
                        onClick={(e) => { e.stopPropagation(); remove(r.id); }}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      ><Trash2 className="h-4 w-4" /></button>
                    )}
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <NewReviewDialog open={creating} onOpenChange={setCreating} locale={lang} />
    </div>
  );
};

export default Reviews;
