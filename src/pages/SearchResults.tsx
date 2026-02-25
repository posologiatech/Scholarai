import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import AppHeader from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  Loader2,
  AlertCircle,
  ArrowUpDown,
  PanelRightOpen,
  PanelRightClose,
  FileText,
  Plus,
  Download,
  BookmarkPlus,
  X,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import ColumnsPanel, { type ColumnDef } from "@/components/app/ColumnsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  source: "semantic_scholar" | "pubmed" | "openalex" | "clinical_trials" | "europe_pmc";
  citationCount?: number;
  doi?: string;
  url?: string;
  journal?: string;
  openAccess?: boolean;
}

interface AdvancedFilters {
  hasPdf: boolean;
  yearRange: [number, number];
  studyTypes: string[];
  abstractKeyword: string;
  sourceFilter: string;
}

const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-column`;
const currentYear = new Date().getFullYear();

const STUDY_TYPES = [
  { value: "review", label: "Review" },
  { value: "meta-analysis", label: "Meta-Analysis" },
  { value: "systematic-review", label: "Systematic Review" },
  { value: "rct", label: "RCT" },
  { value: "longitudinal", label: "Longitudinal" },
];

const SearchResults = () => {
  const { t, locale } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const query = searchParams.get("q") || "";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuery, setNewQuery] = useState(query);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  // Columns
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: "Summary", enabled: true },
  ]);
  const [columnData, setColumnData] = useState<Record<string, Record<number, string>>>({});
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [showPanel, setShowPanel] = useState(true);

  // Sorting & filters
  const [sortBy, setSortBy] = useState<string>("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({
    hasPdf: false,
    yearRange: [2000, currentYear],
    studyTypes: [],
    abstractKeyword: "",
    sourceFilter: "all",
  });

  const tableRef = useRef<HTMLTableElement>(null);

  // Initialize from navigation state (saved search or suggested columns)
  useEffect(() => {
    const state = location.state as {
      suggestedColumns?: { name: string; description: string }[];
      savedSearch?: { papers: any[]; columns: any[]; column_data: Record<string, Record<number, string>> };
    } | null;

    if (state?.savedSearch) {
      // Restore full saved search: papers, columns, and extracted data
      setPapers(state.savedSearch.papers || []);
      if (Array.isArray(state.savedSearch.columns) && state.savedSearch.columns.length > 0) {
        setColumns(state.savedSearch.columns);
      }
      if (state.savedSearch.column_data && typeof state.savedSearch.column_data === "object") {
        setColumnData(state.savedSearch.column_data);
      }
      setLoading(false);
      return;
    }

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
    const state = location.state as { savedSearch?: any } | null;
    // Don't fetch if we loaded from a saved search
    if (state?.savedSearch) return;
    if (query) fetchPapers(query);
  }, [query]);

  useEffect(() => {
    if (papers.length > 0) {
      const enabledCols = columns.filter((c) => c.enabled && !columnData[c.name]);
      enabledCols.forEach((col) => extractColumnData(col.name, col.prompt));
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

  const extractColumnData = async (columnName: string, customPrompt?: string) => {
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
          custom_prompt: customPrompt,
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
    const newlyEnabled = updated.filter(
      (u) => u.enabled && !columns.find((c) => c.name === u.name)?.enabled
    );
    setColumns(updated);
    newlyEnabled.forEach((col) => {
      if (!columnData[col.name]) {
        extractColumnData(col.name, col.prompt);
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

  // Apply filters
  const filtered = papers.filter((p) => {
    if (filters.sourceFilter !== "all" && p.source !== filters.sourceFilter) return false;
    if (filters.hasPdf && !p.openAccess) return false;
    if (p.year && (p.year < filters.yearRange[0] || p.year > filters.yearRange[1])) return false;
    if (filters.abstractKeyword.trim()) {
      const kw = filters.abstractKeyword.toLowerCase();
      if (!p.abstract?.toLowerCase().includes(kw) && !p.title.toLowerCase().includes(kw)) return false;
    }
    if (filters.studyTypes.length > 0) {
      const titleLower = (p.title + " " + (p.abstract || "")).toLowerCase();
      const matches = filters.studyTypes.some((st) => {
        if (st === "rct") return titleLower.includes("randomized") || titleLower.includes("randomised");
        return titleLower.includes(st.replace("-", " "));
      });
      if (!matches) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "year") return (b.year || 0) - (a.year || 0);
    if (sortBy === "citations") return (b.citationCount || 0) - (a.citationCount || 0);
    return 0;
  });

  const enabledColumns = columns.filter((c) => c.enabled);

  const sourceLabel = (s: string) => {
    const labels: Record<string, string> = {
      semantic_scholar: "Semantic Scholar",
      pubmed: "PubMed",
      openalex: "OpenAlex",
      clinical_trials: "ClinicalTrials.gov",
      europe_pmc: "Europe PMC",
    };
    return labels[s] || s;
  };

  // Export PDF
  const handleExportPDF = () => {
    const colCount = enabledColumns.length + 1;
    const isLandscape = colCount > 2;

    const doc = new jsPDF({
      orientation: isLandscape ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text(`${locale === "pt" ? "Pesquisa" : "Search"}: ${query}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`${sorted.length} ${locale === "pt" ? "resultados" : "results"} — ${new Date().toLocaleDateString()}`, 14, 21);

    const head = ["Paper", ...enabledColumns.map((c) => c.name)];
    const body = sorted.map((paper, idx) => {
      const paperCell = `${paper.title}\n${paper.authors.slice(0, 2).join(", ")}${paper.authors.length > 2 ? " et al." : ""}, ${paper.year || "n.d."}`;
      const dataCells = enabledColumns.map((col) => columnData[col.name]?.[idx] || "—");
      return [paperCell, ...dataCells];
    });

    autoTable(doc, {
      startY: 25,
      head: [head],
      body,
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: isLandscape ? 80 : 60 },
      },
      theme: "grid",
    });

    doc.save(`search-${query.slice(0, 30).replace(/\s+/g, "_")}.pdf`);
    toast.success(locale === "pt" ? "PDF exportado!" : "PDF exported!");
  };

  // Save to library
  const handleSaveToLibrary = async () => {
    if (!user) {
      toast.error(locale === "pt" ? "Faça login para salvar" : "Login to save");
      return;
    }
    setSavingToLibrary(true);
    try {
      const { error } = await supabase.from("saved_searches").insert({
        user_id: user.id,
        query,
        papers: sorted as any,
        columns: columns as any,
        column_data: columnData as any,
      });
      if (error) throw error;
      toast.success(locale === "pt" ? "Salvo na biblioteca!" : "Saved to library!");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(locale === "pt" ? "Erro ao salvar" : "Failed to save");
    } finally {
      setSavingToLibrary(false);
    }
  };

  const toggleStudyType = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      studyTypes: prev.studyTypes.includes(value)
        ? prev.studyTypes.filter((s) => s !== value)
        : [...prev.studyTypes, value],
    }));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
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

            {/* Toolbar — matches reference image layout */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              {/* Sort */}
              <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none cursor-pointer"
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

              <div className="h-5 w-px bg-border" />

              {/* Search in results */}
              <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Search className="h-3.5 w-3.5" />
                <span>{locale === "pt" ? "Buscar" : "Search"}</span>
              </button>

              <div className="h-5 w-px bg-border" />

              {/* Filters */}
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Filter className="h-3.5 w-3.5" />
                    <span>{locale === "pt" ? "Filtros" : "Filters"}</span>
                    {(filters.hasPdf || filters.studyTypes.length > 0 || filters.abstractKeyword || filters.sourceFilter !== "all") && (
                      <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                        !
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 z-50 bg-card border border-border shadow-lg" align="start">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {locale === "pt" ? "Cancelar" : "Cancel"}
                    </button>
                    <Button size="sm" onClick={() => setShowFilters(false)}>
                      {locale === "pt" ? "Aplicar" : "Apply"}
                    </Button>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
                    {/* Has PDF */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Tem PDF" : "Has PDF"}
                      </span>
                      <Switch
                        checked={filters.hasPdf}
                        onCheckedChange={(v) => setFilters((p) => ({ ...p, hasPdf: v }))}
                      />
                    </div>

                    {/* Publication date */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Data de publicação" : "Publication date"}
                      </h4>
                      <Slider
                        value={filters.yearRange}
                        onValueChange={(v) => setFilters((p) => ({ ...p, yearRange: v as [number, number] }))}
                        min={1990}
                        max={currentYear}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{filters.yearRange[0]}</span>
                        <span>{filters.yearRange[1]}</span>
                      </div>
                    </div>

                    {/* Source */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Fonte" : "Source"}
                      </h4>
                      <select
                        value={filters.sourceFilter}
                        onChange={(e) => setFilters((p) => ({ ...p, sourceFilter: e.target.value }))}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                      >
                        <option value="all">{locale === "pt" ? "Todas as fontes" : "All sources"}</option>
                        <option value="semantic_scholar">Semantic Scholar</option>
                        <option value="pubmed">PubMed</option>
                        <option value="openalex">OpenAlex</option>
                        <option value="clinical_trials">ClinicalTrials.gov</option>
                        <option value="europe_pmc">Europe PMC</option>
                      </select>
                    </div>

                    {/* Study Type */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Tipo de estudo" : "Study Type"}
                      </h4>
                      {STUDY_TYPES.map((st) => (
                        <label key={st.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={filters.studyTypes.includes(st.value)}
                            onCheckedChange={() => toggleStudyType(st.value)}
                          />
                          <span className="text-sm text-foreground">{st.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Abstract keywords */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Palavras-chave no abstract" : "Abstract Keywords"}
                      </h4>
                      <Input
                        value={filters.abstractKeyword}
                        onChange={(e) => setFilters((p) => ({ ...p, abstractKeyword: e.target.value }))}
                        placeholder={locale === "pt" ? "Abstract contém..." : "Abstract contains..."}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="h-5 w-px bg-border" />

              {/* Add column */}
              <button
                onClick={() => setShowPanel(true)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{locale === "pt" ? "Adicionar coluna" : "Add a column"}</span>
              </button>

              <div className="h-5 w-px bg-border" />

              {/* Export */}
              <button
                onClick={handleExportPDF}
                disabled={sorted.length === 0}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </button>

              <div className="h-5 w-px bg-border" />

              {/* Save to library */}
              <button
                onClick={handleSaveToLibrary}
                disabled={savingToLibrary || sorted.length === 0}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                {savingToLibrary ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                <span>{locale === "pt" ? "Salvar na biblioteca" : "Save to library"}</span>
              </button>

              {/* Toggle panel - push right */}
              <div className="ml-auto">
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
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{sorted.length} {locale === "pt" ? "fontes" : "sources"}</span>
                </div>

                <table ref={tableRef} className="w-full border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: enabledColumns.length > 1 ? "240px" : "320px" }} />
                    {enabledColumns.map((col) => (
                      <col key={col.name} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 pr-3 text-left text-sm font-medium text-muted-foreground">
                        Paper
                      </th>
                      {enabledColumns.map((col) => (
                        <th
                          key={col.name}
                          className="py-3 px-3 text-left text-sm font-medium text-muted-foreground"
                        >
                          <div className="flex items-center gap-1 truncate">
                            {col.name}
                            {loadingColumns.has(col.name) && (
                              <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((paper, idx) => (
                      <tr key={paper.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-4 pr-3 align-top">
                          <div className="space-y-1.5">
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
                                {paper.journal || sourceLabel(paper.source)}
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
                                  ⌕ DOI
                                </a>
                              )}
                              {paper.openAccess && (
                                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Open Access
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                paper.source === "semantic_scholar" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" :
                                paper.source === "pubmed" ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" :
                                paper.source === "openalex" ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" :
                                paper.source === "clinical_trials" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" :
                                "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400"
                              }`}>
                                {sourceLabel(paper.source)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {enabledColumns.map((col) => (
                          <td key={col.name} className="px-3 py-4 align-top">
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

        {showPanel && !loading && papers.length > 0 && (
          <ColumnsPanel
            suggestedColumns={columns}
            onColumnsChange={handleColumnsChange}
            papers={papers}
            query={query}
          />
        )}
      </div>
    </div>
  );
};

export default SearchResults;
