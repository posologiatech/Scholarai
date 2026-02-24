import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import AppHeader from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  ExternalLink,
  Filter,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import AISynthesis from "@/components/app/AISynthesis";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  source: "semantic_scholar" | "pubmed";
  citationCount?: number;
  doi?: string;
  url?: string;
}

const SearchResults = () => {
  const { t, locale } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuery, setNewQuery] = useState(query);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<string>>(new Set());

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [yearFrom, setYearFrom] = useState<string>("");

  useEffect(() => {
    if (query) fetchPapers(query);
  }, [query]);

  const fetchPapers = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("search-papers", {
        body: { query: q, limit: 20 },
      });
      if (fnError) throw fnError;
      setPapers(data.papers || []);
    } catch (err: any) {
      setError(err.message || "Failed to search");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!newQuery.trim()) return;
    // Save to recent
    const recent: string[] = JSON.parse(localStorage.getItem("scholarai_recent") || "[]");
    const updated = [newQuery, ...recent.filter((s) => s !== newQuery)].slice(0, 8);
    localStorage.setItem("scholarai_recent", JSON.stringify(updated));
    navigate(`/search?q=${encodeURIComponent(newQuery)}`);
  };

  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Apply filters
  const filtered = papers.filter((p) => {
    if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
    if (yearFrom && p.year && p.year < parseInt(yearFrom)) return false;
    return true;
  });

  const sourceLabel = (s: string) =>
    s === "semantic_scholar" ? "Semantic Scholar" : "PubMed";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="container max-w-4xl py-6 space-y-6">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full rounded-xl border border-border bg-card py-3 pl-12 pr-28 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            onClick={handleSearch}
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("search.searchButton")}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            {t("search.filters")}
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          >
            <option value="all">{t("search.allSources")}</option>
            <option value="semantic_scholar">Semantic Scholar</option>
            <option value="pubmed">PubMed</option>
          </select>
          <input
            type="number"
            placeholder={t("search.yearFrom")}
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            className="w-24 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm">{t("search.loading")}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* AI Synthesis */}
        <AISynthesis query={query} papers={papers} loading={loading} />

        {/* Results */}
        {!loading && !error && (
          <>
            <p className="text-sm text-muted-foreground">
              {filtered.length} {t("search.results")} "{query}"
            </p>

            <div className="space-y-4">
              {filtered.map((paper) => (
                <article
                  key={paper.id}
                  className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          paper.source === "semantic_scholar"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/10 text-accent"
                        }`}>
                          {sourceLabel(paper.source)}
                        </span>
                        {paper.year && (
                          <span className="text-xs text-muted-foreground">{paper.year}</span>
                        )}
                        {paper.citationCount != null && (
                          <span className="text-xs text-muted-foreground">
                            {paper.citationCount} {t("search.citations")}
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-base font-semibold leading-snug text-foreground">
                        {paper.title}
                      </h3>

                      <p className="text-sm text-muted-foreground">
                        {paper.authors.slice(0, 4).join(", ")}
                        {paper.authors.length > 4 && ` +${paper.authors.length - 4}`}
                      </p>

                      {paper.abstract && (
                        <div>
                          <p className={`text-sm text-muted-foreground ${
                            !expandedAbstracts.has(paper.id) ? "line-clamp-2" : ""
                          }`}>
                            {paper.abstract}
                          </p>
                          <button
                            onClick={() => toggleAbstract(paper.id)}
                            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {expandedAbstracts.has(paper.id) ? (
                              <>
                                <ChevronUp className="h-3 w-3" /> {t("search.showLess")}
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" /> {t("search.showMore")}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {paper.url && (
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </article>
              ))}

              {filtered.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <Search className="mx-auto h-10 w-10 opacity-30" />
                  <p className="mt-3">{t("search.noResults")}</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SearchResults;
