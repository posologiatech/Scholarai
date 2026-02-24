import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/app/AppHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Table, Columns, ArrowRight, Loader2, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SavedSearch {
  id: string;
  query: string;
  papers: any[];
  columns: any[];
  column_data: Record<string, Record<number, string>>;
  created_at: string;
}

const Extraction = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchSaved();
    else setLoading(false);
  }, [user]);

  const fetchSaved = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setSavedSearches(data as unknown as SavedSearch[]);
    setLoading(false);
  };

  const deleteSaved = async (id: string) => {
    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
      toast.success(locale === "pt" ? "Removido" : "Deleted");
    }
  };

  const getEnabledColumnsCount = (columns: any[]) => {
    if (!Array.isArray(columns)) return 0;
    return columns.filter((c: any) => c.enabled).length;
  };

  const getExtractedDataCount = (columnData: any) => {
    if (!columnData || typeof columnData !== "object") return 0;
    return Object.keys(columnData).length;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="container max-w-5xl flex-1 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">{t("extraction.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("extraction.subtitle")}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : savedSearches.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {locale === "pt"
                ? "Clique em uma pesquisa para abrir a tabela de extração com colunas customizáveis."
                : "Click a search to open the extraction table with customizable columns."}
            </p>
            <div className="grid gap-3">
              {savedSearches.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <button
                    onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`)}
                    className="flex flex-1 items-center gap-4 text-left"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Table className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{s.query}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{(s.papers || []).length} papers</span>
                        <span>{getEnabledColumnsCount(s.columns)} {locale === "pt" ? "colunas" : "columns"}</span>
                        <span>{getExtractedDataCount(s.column_data)} {locale === "pt" ? "extrações" : "extractions"}</span>
                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); deleteSaved(s.id); }}
                    className="ml-2 text-destructive opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 py-20">
            <Table className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{t("extraction.empty")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("extraction.emptyDesc")}</p>
            <Button className="mt-6" onClick={() => navigate("/dashboard")}>
              <Search className="mr-2 h-4 w-4" />
              {locale === "pt" ? "Fazer uma pesquisa" : "Start a search"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Extraction;
