import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { UsageLimitDialog } from "@/components/app/UpgradeGate";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ImageOff, ExternalLink, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Figure {
  doi: string | null;
  pmcid: string;
  source_paper_title: string;
  journal: string | null;
  year: number | null;
  paper_url: string;
  image_url: string;
  caption: string | null;
  figure_label: string | null;
}

const ImageSearchResults = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const { canUse } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [hiddenUrls, setHiddenUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!query.trim()) return;
    fetchImages(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const fetchImages = async (q: string) => {
    if (!canUse("search")) {
      setShowLimitDialog(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-paper-images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: q, limit: 40 }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Search failed (${resp.status}): ${errText}`);
      }
      const data = await resp.json();
      setFigures(data.figures || []);
    } catch (err) {
      console.error("[ImageSearchResults] Error:", err);
      const message = err instanceof Error ? err.message : (pt ? "Falha ao buscar imagens" : "Failed to search images");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">
                {pt ? "Imagens de artigos" : "Article images"}
              </h1>
              <p className="text-sm text-muted-foreground truncate max-w-2xl">{query}</p>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">{pt ? "Buscando figuras em artigos de acesso aberto..." : "Searching figures in open-access papers..."}</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchImages(query)}>
                {pt ? "Tentar novamente" : "Try again"}
              </Button>
            </div>
          )}

          {!loading && !error && figures.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <ImageOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {pt ? "Nenhuma figura encontrada" : "No figures found"}
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                {pt
                  ? "Só conseguimos extrair figuras de artigos de acesso aberto com texto completo indexado. Tente reformular a busca ou use a busca normal de artigos."
                  : "We can only extract figures from open-access papers with indexed full text. Try rephrasing the query or use the regular paper search."}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}>
                {pt ? "Buscar artigos" : "Search papers"}
              </Button>
            </div>
          )}

          {!loading && !error && figures.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {figures.map((fig, idx) => (
                <div key={`${fig.pmcid}_${idx}`} className="rounded-xl border border-border overflow-hidden bg-card flex flex-col">
                  {!hiddenUrls.has(fig.image_url) && (
                    <img
                      src={fig.image_url}
                      alt={fig.figure_label || fig.source_paper_title}
                      loading="lazy"
                      className="w-full object-contain max-h-64 bg-white"
                      onError={() => setHiddenUrls((prev) => new Set(prev).add(fig.image_url))}
                    />
                  )}
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    {fig.figure_label && (
                      <span className="text-xs font-semibold text-primary">{fig.figure_label}</span>
                    )}
                    {fig.caption && (
                      <p className="text-xs text-muted-foreground line-clamp-3">{fig.caption}</p>
                    )}
                    <a
                      href={fig.paper_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto flex items-start gap-1 text-xs text-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">
                        {fig.source_paper_title}
                        {fig.journal && <span className="text-muted-foreground"> · {fig.journal}</span>}
                        {fig.year && <span className="text-muted-foreground"> · {fig.year}</span>}
                      </span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <UsageLimitDialog feature="search" open={showLimitDialog} onOpenChange={setShowLimitDialog} />
    </div>
  );
};

export default ImageSearchResults;
