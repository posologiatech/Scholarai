import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardList,
  Plus,
  Trash2,
  ArrowRight,
  Loader2,
  FileText,
  Filter,
  Table,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface ReviewRow {
  id: string;
  research_question: string;
  status: string;
  papers: any[];
  included_paper_ids: string[];
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: { pt: string; en: string }; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: { pt: "Rascunho", en: "Draft" }, icon: FileText, variant: "secondary" },
  screening: { label: { pt: "Triagem", en: "Screening" }, icon: Filter, variant: "outline" },
  extracting: { label: { pt: "Extração", en: "Extracting" }, icon: Table, variant: "outline" },
  complete: { label: { pt: "Completa", en: "Complete" }, icon: CheckCircle2, variant: "default" },
};

const SystematicReviewList = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) loadReviews();
  }, [user?.id]);

  const loadReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("systematic_reviews")
      .select("id, research_question, status, papers, included_paper_ids, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (!error && data) setReviews(data as ReviewRow[]);
    setLoading(false);
  };

  const deleteReview = async (id: string) => {
    const { error } = await supabase.from("systematic_reviews").delete().eq("id", id);
    if (error) {
      toast.error(locale === "pt" ? "Erro ao excluir" : "Failed to delete");
    } else {
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success(locale === "pt" ? "Revisão excluída" : "Review deleted");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {locale === "pt" ? "Revisões Sistemáticas" : "Systematic Reviews"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {locale === "pt"
                  ? "Gerencie suas revisões sistemáticas salvas"
                  : "Manage your saved systematic reviews"}
              </p>
            </div>
            <Button onClick={() => navigate("/systematic-review/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              {locale === "pt" ? "Nova Revisão" : "New Review"}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                {locale === "pt"
                  ? "Nenhuma revisão sistemática salva. Crie uma nova a partir do Dashboard."
                  : "No saved systematic reviews. Create a new one from the Dashboard."}
              </p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/dashboard")}>
                {locale === "pt" ? "Ir para Dashboard" : "Go to Dashboard"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.map((review) => {
                const config = statusConfig[review.status] || statusConfig.draft;
                const StatusIcon = config.icon;
                const papersCount = Array.isArray(review.papers) ? review.papers.length : 0;
                const includedCount = Array.isArray(review.included_paper_ids) ? review.included_paper_ids.length : 0;

                return (
                  <div
                    key={review.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/systematic-review/new?id=${review.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{review.research_question}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{papersCount} {locale === "pt" ? "artigos" : "papers"}</span>
                        <span>·</span>
                        <span>{includedCount} {locale === "pt" ? "incluídos" : "included"}</span>
                        <span>·</span>
                        <span>{new Date(review.updated_at).toLocaleDateString(locale === "pt" ? "pt-BR" : "en-US")}</span>
                      </div>
                    </div>
                    <Badge variant={config.variant} className="gap-1 text-xs">
                      <StatusIcon className="h-3 w-3" />
                      {config.label[locale as "pt" | "en"]}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReview(review.id);
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SystematicReviewList;
