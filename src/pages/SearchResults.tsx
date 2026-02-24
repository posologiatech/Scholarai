import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import AppHeader from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Search,
  ExternalLink,
  Filter,
  Loader2,
  AlertCircle,
  ArrowUpDown,
  PanelRightOpen,
  PanelRightClose,
  FileText,
  ChevronDown,
} from "lucide-react";
import ColumnsPanel, { type ColumnDef } from "@/components/app/ColumnsPanel";

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

const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-column`;

const SearchResults = () => {
  const { t, locale } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = searchParams.get("q") || "";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuery, setNewQuery] = useState(query);

  // Columns
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: "Summary", enabled: true },
  ]);
  const [columnData, setColumnData] = useState<Record<string, Record<number, string>>>({});
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [showPanel, setShowPanel] = useState(true);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("relevance");

  // Initialize suggested columns from navigation state
  useEffect(() => {
    const state = location.state as { suggestedColumns?: { name: string; description: string }[] } | null;
    if (state?.suggestedColumns?.length) {
      setColumns([
        { name: "Summary", enabled: true },
        ...state.suggestedColumns.map((c) => ({
          name: c.name,
          description: c.description,
          enabled: false,
        })),
      ]);
    }
  }, []);

  useEffect(() => {
    if (query) fetchPapers(query);
  }, [query]);

  // When papers load and Summary is enabled, extract Summary
  useEffect(() => {
    if (papers.length > 0) {
      const enabledCols = columns.filter((c) => c.enabled && !columnData[c.name]);
      enabledCols.forEach((col) => extractColumnData(col.name));
    }
  }, [papers]);

  const fetchPapers = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-papers`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query: q, limit: 20 }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Search failed (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      setPapers(data.papers || []);
    } catch (err: any) {
      console.error("[SearchResults] Error:", err);
      setError(err.message || "Failed to search");
    } finally {
      setLoading(false);
    }
  };

  const extractColumnData = async (columnName: string) => {
    if (papers.length === 0) return;
    setLoadingColumns((prev) => new Set(prev).add(columnName));
    try {
      const resp = await fetch(EXTRACT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          query,
          papers: papers.map((p) => ({
            title: p.title,
            authors: p.authors,
            year: p.year,
            abstract: p.abstract,
          })),
          column_name: columnName,
          locale,
        }),
      });

      if (!resp.ok) throw new Error("Extraction failed");
      const data = await resp.json();
      const extracted: Record<number, string> = {};
      (data.extractions || []).forEach((e: { paper_index: number; value: string }) => {
        extracted[e.paper_index] = e.value;
      });
      setColumnData((prev) => ({ ...prev, [columnName]: extracted }));
    } catch (err) {
      console.error(`Failed to extract column ${columnName}:`, err);
    } finally {
      setLoadingColumns((prev) => {
        const next = new Set(prev);
        next.delete(columnName);
        return next;
      });
    }
  };

  const handleColumnsChange = (updated: ColumnDef[]) => {
    // Check for newly enabled columns that need extraction
    const newlyEnabled = updated.filter(
      (u) => u.enabled && !columns.find((c) => c.name === u.name)?.enabled
    );
    setColumns(updated);
    newlyEnabled.forEach((col) => {
      if (!columnData[col.name]) {
        extractColumnData(col.name);
      }
    });
  };

  const handleSearch = () => {
    if (!newQuery.trim()) return;
    const recent: string[] = JSON.parse(localStorage.getItem("scholarai_recent") || "[]");
    const updated = [newQuery, ...recent.filter((s) => s !== newQuery)].slice(0, 8);
    localStorage.setItem("scholarai_recent", JSON.stringify(updated));
    navigate(`/search?q=${encodeURIComponent(newQuery)}`);
  };

  const filtered = papers.filter((p) => {
    if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "year") return (b.year || 0) - (a.year || 0);
    if (sortBy === "citations") return (b.citationCount || 0) - (a.citationCount || 0);
    return 0;
  });

  const enabledColumns = columns.filter((c) => c.enabled);
  const sourceLabel = (s: string) =>
    s === "semantic_scholar" ? "Semantic Scholar" : "PubMed";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Search bar */}
            <div className="relative max-w-2xl">
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

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none"
                >
                  <option value="relevance">
                    {locale === "pt" ? "Mais relevante" : "Most relevant"}
                  </option>
                  <option value="year">
                    {locale === "pt" ? "Mais recente" : "Most recent"}
                  </option>
                  <option value="citations">
                    {locale === "pt" ? "Mais citado" : "Most cited"}
                  </option>
                </select>
              </button>

              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Filter className="h-3.5 w-3.5" />
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none"
                >
                  <option value="all">{t("search.allSources")}</option>
                  <option value="semantic_scholar">Semantic Scholar</option>
                  <option value="pubmed">PubMed</option>
                </select>
              </button>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPanel(!showPanel)}
                  className="text-xs"
                >
                  {showPanel ? (
                    <PanelRightClose className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <PanelRightOpen className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {locale === "pt" ? "Colunas" : "Columns"}
                </Button>
              </div>
            </div>

            {/* Loading */}
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

            {/* Table */}
            {!loading && !error && (
              <div className="overflow-x-auto">
                {/* Table header */}
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{sorted.length} {locale === "pt" ? "fontes" : "sources"}</span>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 pr-4 text-left text-sm font-medium text-muted-foreground">
                        Paper
                      </th>
                      {enabledColumns.map((col) => (
                        <th
                          key={col.name}
                          className="min-w-[280px] py-3 px-4 text-left text-sm font-medium text-muted-foreground"
                        >
                          <div className="flex items-center gap-1">
                            {col.name}
                            {loadingColumns.has(col.name) && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((paper, idx) => (
                      <tr key={paper.id} className="border-b border-border/50 hover:bg-muted/30">
                        {/* Paper cell */}
                        <td className="py-4 pr-4 align-top">
                          <div className="max-w-lg space-y-1.5">
                            <h3 className="text-sm font-semibold leading-snug text-primary hover:underline">
                              {paper.url ? (
                                <a href={paper.url} target="_blank" rel="noopener noreferrer">
                                  {paper.title}
                                </a>
                              ) : (
                                paper.title
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {paper.authors.slice(0, 3).join(", ")}
                              {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {sourceLabel(paper.source)}
                                {paper.year && `, ${paper.year}`}
                                {paper.citationCount != null && `, ${paper.citationCount} ${locale === "pt" ? "citações" : "citations"}`}
                              </span>
                              {paper.doi && (
                                <a
                                  href={`https://doi.org/${paper.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  DOI
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground/70">
                              {paper.abstract ? (
                                paper.abstract.length > 100
                                  ? "Abstract only"
                                  : "Full text"
                              ) : "Abstract only"}
                            </p>
                          </div>
                        </td>

                        {/* Data columns */}
                        {enabledColumns.map((col) => (
                          <td key={col.name} className="min-w-[280px] px-4 py-4 align-top">
                            {loadingColumns.has(col.name) ? (
                              <div className="space-y-2">
                                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                              </div>
                            ) : columnData[col.name]?.[idx] ? (
                              <p className="text-sm leading-relaxed text-foreground/80">
                                {columnData[col.name][idx]}
                              </p>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {sorted.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    <Search className="mx-auto h-10 w-10 opacity-30" />
                    <p className="mt-3">{t("search.noResults")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Columns panel */}
        {showPanel && !loading && papers.length > 0 && (
          <ColumnsPanel
            suggestedColumns={columns}
            onColumnsChange={handleColumnsChange}
          />
        )}
      </div>
    </div>
  );
};

export default SearchResults;
