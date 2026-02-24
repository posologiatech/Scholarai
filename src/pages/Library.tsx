import { useState, useEffect } from "react";
import AppHeader from "@/components/app/AppHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { BookOpen, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SavedSearch {
  id: string;
  query: string;
  papers: any[];
  created_at: string;
}

const Library = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchSaved();
  }, [user]);

  const fetchSaved = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_searches")
      .select("id, query, papers, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setSearches(data as SavedSearch[]);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (!error) {
      setSearches((prev) => prev.filter((s) => s.id !== id));
      toast.success(locale === "pt" ? "Removido!" : "Removed!");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="container max-w-4xl flex-1 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">{t("library.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("library.subtitle")}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : searches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 py-20">
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{t("library.empty")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("library.emptyDesc")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {searches.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`)}
                >
                  <h3 className="text-sm font-semibold text-foreground">{s.query}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(s.papers as any[])?.length || 0} papers · {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(s.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Library;
