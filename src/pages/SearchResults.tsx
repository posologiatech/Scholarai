import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import CitationBadge from "@/components/app/CitationBadge";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
// AppSidebar provided by ProtectedRoute
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
  Info,
  Zap,
  Database,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { toast } from "sonner";
import ColumnsPanel, { type ColumnDef } from "@/components/app/ColumnsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef as TanStackColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

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
  studyType?: string;
}

interface AdvancedFilters {
  hasPdf: boolean;
  yearRange: [number, number];
  studyTypes: string[];
  abstractKeyword: string;
  sourceFilter: string;
  minCitations: number;
  authorKeyword: string;
}

const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-column`;
const currentYear = new Date().getFullYear();

const STUDY_TYPES = [
  { value: "review", label: "Review" },
  { value: "meta-analysis", label: "Meta-Analysis" },
  { value: "systematic-review", label: "Systematic Review" },
  { value: "rct", label: "RCT" },
  { value: "clinical-trial", label: "Clinical Trial" },
  { value: "observational", label: "Observational" },
  { value: "cohort", label: "Cohort" },
  { value: "case-report", label: "Case Report" },
];

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
  const [columnCitations, setColumnCitations] = useState<Record<string, Record<number, string>>>({});
  const [columnCacheStatus, setColumnCacheStatus] = useState<Record<string, Record<number, boolean>>>({});
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [showPanel, setShowPanel] = useState(true);
  const [embeddingStatus, setEmbeddingStatus] = useState<'idle' | 'processing' | 'done'>('idle');

  // Sorting & filters
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({
    hasPdf: false,
    yearRange: [2000, currentYear],
    studyTypes: [],
    abstractKeyword: "",
    sourceFilter: "all",
    minCitations: 0,
    authorKeyword: "",
  });
  const [searchInResults, setSearchInResults] = useState("");
  const [showSearchInResults, setShowSearchInResults] = useState(false);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [studyTypeCounts, setStudyTypeCounts] = useState<Record<string, number>>({});

  // Column resizing state
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // Virtualizer ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Initialize from navigation state (saved search or suggested columns)
  useEffect(() => {
    const state = location.state as {
      suggestedColumns?: { name: string; description: string }[];
      savedSearch?: { papers: any[]; columns: any[]; column_data: Record<string, Record<number, string>> };
    } | null;

    if (state?.savedSearch) {
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
    if (state?.savedSearch) return;
    if (query) fetchPapers(query);
  }, [query]);

  useEffect(() => {
    if (papers.length > 0) {
      const enabledCols = columns.filter((c) => c.enabled && !columnData[c.name]);
      enabledCols.forEach((col) => extractColumnData(col.name, col.prompt));
      triggerEmbeddings(papers);
    }
  }, [papers]);

  const triggerEmbeddings = async (papersToEmbed: Paper[]) => {
    if (embeddingStatus !== 'idle') return;
    setEmbeddingStatus('processing');
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-papers`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          papers: papersToEmbed.map((p) => ({
            id: p.id,
            title: p.title,
            abstract: p.abstract,
          })),
        }),
      });
      setEmbeddingStatus('done');
    } catch (err) {
      console.error('Embedding trigger failed:', err);
      setEmbeddingStatus('idle');
    }
  };

  const fetchPapers = async (q: string, appliedFilters?: AdvancedFilters) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-papers`;
      const f = appliedFilters || filters;
      const hasActiveFilters = f.hasPdf || f.studyTypes.length > 0 || f.minCitations > 0 ||
        f.yearRange[0] !== 2000 || f.yearRange[1] !== currentYear;

      const body: any = { query: q, limit: 20 };
      if (hasActiveFilters) {
        body.filters = {
          yearMin: f.yearRange[0],
          yearMax: f.yearRange[1],
          openAccessOnly: f.hasPdf,
          studyTypes: f.studyTypes.length > 0 ? f.studyTypes : undefined,
          minCitations: f.minCitations > 0 ? f.minCitations : undefined,
        };
      }
      if (f.sourceFilter !== "all") {
        body.sources = [f.sourceFilter];
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Search failed (${resp.status}): ${errText}`);
      }
      const data = await resp.json();
      setPapers(data.papers || []);
      setSourceCounts(data.source_counts || {});
      setStudyTypeCounts(data.study_type_counts || {});
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
            id: p.id,
            title: p.title,
            authors: p.authors,
            year: p.year,
            abstract: p.abstract,
          })),
          column_name: columnName,
          custom_prompt: customPrompt,
          locale,
          stream: true,
        }),
      });
      if (!resp.ok) throw new Error("Extraction failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.done) break;

            const { paper_index, value: extractedValue, citation_context, from_cache } = parsed;
            if (paper_index !== undefined && extractedValue) {
              setColumnData((prev) => ({
                ...prev,
                [columnName]: { ...(prev[columnName] || {}), [paper_index]: extractedValue },
              }));
              if (citation_context) {
                setColumnCitations((prev) => ({
                  ...prev,
                  [columnName]: { ...(prev[columnName] || {}), [paper_index]: citation_context },
                }));
              }
              if (from_cache) {
                setColumnCacheStatus((prev) => ({
                  ...prev,
                  [columnName]: { ...(prev[columnName] || {}), [paper_index]: true },
                }));
              }
            }
          } catch { /* incomplete JSON, skip */ }
        }
      }
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

  // Apply client-side filters
  const filtered = useMemo(() => papers.filter((p) => {
    if (filters.authorKeyword.trim()) {
      const kw = filters.authorKeyword.toLowerCase();
      if (!p.authors.some((a) => a.toLowerCase().includes(kw))) return false;
    }
    if (filters.abstractKeyword.trim()) {
      const kw = filters.abstractKeyword.toLowerCase();
      if (!p.abstract?.toLowerCase().includes(kw) && !p.title.toLowerCase().includes(kw)) return false;
    }
    if (searchInResults.trim()) {
      const q = searchInResults.toLowerCase();
      const text = `${p.title} ${p.abstract || ''} ${p.authors.join(' ')} ${p.journal || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  }), [papers, filters, searchInResults]);

  const enabledColumns = columns.filter((c) => c.enabled);

  // Count active filters for badge
  const activeFilterCount = [
    filters.hasPdf,
    filters.studyTypes.length > 0,
    filters.minCitations > 0,
    filters.yearRange[0] !== 2000 || filters.yearRange[1] !== currentYear,
    filters.sourceFilter !== "all",
    filters.abstractKeyword.trim(),
    filters.authorKeyword.trim(),
  ].filter(Boolean).length;

  // Active filter chips for display
  const activeFilterChips: { label: string; onRemove: () => void }[] = [];
  if (filters.sourceFilter !== "all") {
    activeFilterChips.push({
      label: sourceLabel(filters.sourceFilter),
      onRemove: () => setFilters((p) => ({ ...p, sourceFilter: "all" })),
    });
  }
  if (filters.hasPdf) {
    activeFilterChips.push({
      label: "Open Access",
      onRemove: () => setFilters((p) => ({ ...p, hasPdf: false })),
    });
  }
  if (filters.yearRange[0] !== 2000 || filters.yearRange[1] !== currentYear) {
    activeFilterChips.push({
      label: `${filters.yearRange[0]}–${filters.yearRange[1]}`,
      onRemove: () => setFilters((p) => ({ ...p, yearRange: [2000, currentYear] })),
    });
  }
  filters.studyTypes.forEach((st) => {
    const label = STUDY_TYPES.find((s) => s.value === st)?.label || st;
    activeFilterChips.push({
      label,
      onRemove: () => setFilters((p) => ({ ...p, studyTypes: p.studyTypes.filter((s) => s !== st) })),
    });
  });
  if (filters.minCitations > 0) {
    activeFilterChips.push({
      label: `≥${filters.minCitations} ${locale === "pt" ? "citações" : "citations"}`,
      onRemove: () => setFilters((p) => ({ ...p, minCitations: 0 })),
    });
  }
  if (filters.authorKeyword.trim()) {
    activeFilterChips.push({
      label: `${locale === "pt" ? "Autor" : "Author"}: ${filters.authorKeyword}`,
      onRemove: () => setFilters((p) => ({ ...p, authorKeyword: "" })),
    });
  }

  const handleApplyFilters = () => {
    setShowFilters(false);
    if (query) fetchPapers(query, filters);
  };

  const handleClearAllFilters = () => {
    const cleared: AdvancedFilters = {
      hasPdf: false,
      yearRange: [2000, currentYear],
      studyTypes: [],
      abstractKeyword: "",
      sourceFilter: "all",
      minCitations: 0,
      authorKeyword: "",
    };
    setFilters(cleared);
    if (query) fetchPapers(query, cleared);
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
    doc.text(`${filtered.length} ${locale === "pt" ? "resultados" : "results"} — ${new Date().toLocaleDateString()}`, 14, 21);

    const head = ["Paper", ...enabledColumns.map((c) => c.name)];
    const body = filtered.map((paper, idx) => {
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
        papers: filtered as any,
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

  // --- TanStack Table setup ---
  type RowData = { paper: Paper; originalIndex: number };

  const tableData = useMemo<RowData[]>(
    () => filtered.map((paper, idx) => ({ paper, originalIndex: idx })),
    [filtered]
  );

  const columnHelper = createColumnHelper<RowData>();

  const tableColumns = useMemo<TanStackColumnDef<RowData, any>[]>(() => {
    const cols: TanStackColumnDef<RowData, any>[] = [
      columnHelper.accessor("paper", {
        id: "paper",
        header: "Paper",
        size: enabledColumns.length > 1 ? 240 : 320,
        minSize: 180,
        cell: ({ row }) => {
          const paper = row.original.paper;
          return (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold leading-snug text-primary hover:underline">
                <a
                  href={`/paper/${encodeURIComponent(paper.id)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/paper/${encodeURIComponent(paper.id)}`);
                  }}
                >
                  {paper.title}
                </a>
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
                <CitationBadge paperId={paper.id} compact />
              </div>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          return (rowA.original.paper.year || 0) - (rowB.original.paper.year || 0);
        },
      }),
    ];

    enabledColumns.forEach((col) => {
      cols.push(
        columnHelper.display({
          id: col.name,
          header: () => (
            <div className="flex items-center gap-1 truncate">
              {col.name}
              {loadingColumns.has(col.name) && (
                <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
              )}
            </div>
          ),
          size: columnSizing[col.name] || 300,
          minSize: 120,
          cell: ({ row }) => {
            const idx = row.original.originalIndex;
            const isLoading = loadingColumns.has(col.name);
            const value = columnData[col.name]?.[idx];
            const citation = columnCitations[col.name]?.[idx];
            const isCached = columnCacheStatus[col.name]?.[idx];

            if (isLoading && !value) {
              return (
                <div className="space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              );
            }

            if (value) {
              return (
                <div className="space-y-1">
                  {citation ? (
                    <HoverCard openDelay={200}>
                      <HoverCardTrigger asChild>
                        <p className="text-sm leading-relaxed text-foreground/80 cursor-help border-b border-dashed border-muted-foreground/30 whitespace-normal break-words">
                          {value}
                        </p>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 text-xs leading-relaxed" side="top">
                        <p className="font-medium text-foreground mb-1">
                          {locale === "pt" ? "Trecho original:" : "Source excerpt:"}
                        </p>
                        <p className="italic text-foreground/70">"{citation}"</p>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/80 whitespace-normal break-words">{value}</p>
                  )}
                  <div className="flex items-center gap-1.5">
                    {isCached && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title={locale === "pt" ? "Resultado do cache (instantâneo)" : "Cached result (instant)"}>
                        <Zap className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {citation && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline md:hidden">
                            <Info className="h-2.5 w-2.5" />
                            <span>{locale === "pt" ? "Fonte" : "Source"}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-xs leading-relaxed text-foreground/70" side="top">
                          <p className="font-medium text-foreground mb-1">{locale === "pt" ? "Trecho original:" : "Source excerpt:"}</p>
                          <p className="italic">"{citation}"</p>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              );
            }

            return <span className="text-xs text-muted-foreground/50">—</span>;
          },
        })
      );
    });

    return cols;
  }, [enabledColumns, loadingColumns, columnData, columnCitations, columnCacheStatus, columnSizing, locale]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      

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

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              {/* Sort */}
              <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select
                  value={sorting.length > 0 ? sorting[0].id : "relevance"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "relevance") {
                      setSorting([]);
                    } else if (val === "year") {
                      setSorting([{ id: "paper", desc: true }]);
                    } else if (val === "citations") {
                      setSorting([{ id: "paper", desc: true }]);
                    }
                  }}
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
              {showSearchInResults ? (
                <div className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchInResults}
                    onChange={(e) => setSearchInResults(e.target.value)}
                    placeholder={locale === "pt" ? "Buscar nos resultados..." : "Search in results..."}
                    className="w-40 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-primary"
                    autoFocus
                  />
                  <button
                    onClick={() => { setShowSearchInResults(false); setSearchInResults(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSearchInResults(true)}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>{locale === "pt" ? "Buscar" : "Search"}</span>
                </button>
              )}

              <div className="h-5 w-px bg-border" />

              {/* Filters */}
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Filter className="h-3.5 w-3.5" />
                    <span>{locale === "pt" ? "Filtros" : "Filters"}</span>
                    {activeFilterCount > 0 && (
                      <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0 z-50 bg-card border border-border shadow-lg" align="start">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <button
                      onClick={handleClearAllFilters}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {locale === "pt" ? "Limpar tudo" : "Clear all"}
                    </button>
                    <Button size="sm" onClick={handleApplyFilters}>
                      {locale === "pt" ? "Aplicar filtros" : "Apply filters"}
                    </Button>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
                    {/* Open Access */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Open Access</span>
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

                    {/* Min Citations */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Citações mínimas" : "Minimum citations"}
                      </h4>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[filters.minCitations]}
                          onValueChange={(v) => setFilters((p) => ({ ...p, minCitations: v[0] }))}
                          min={0}
                          max={500}
                          step={5}
                          className="flex-1"
                        />
                        <span className="text-sm font-mono text-foreground w-10 text-right">{filters.minCitations}</span>
                      </div>
                    </div>

                    {/* Source with counts */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Fonte" : "Source"}
                      </h4>
                      <div className="space-y-1.5">
                        {[
                          { value: "all", label: locale === "pt" ? "Todas as fontes" : "All sources" },
                          { value: "semantic_scholar", label: "Semantic Scholar" },
                          { value: "pubmed", label: "PubMed" },
                          { value: "openalex", label: "OpenAlex" },
                          { value: "clinical_trials", label: "ClinicalTrials.gov" },
                          { value: "europe_pmc", label: "Europe PMC" },
                        ].map((src) => (
                          <label key={src.value} className="flex items-center justify-between cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="source"
                                checked={filters.sourceFilter === src.value}
                                onChange={() => setFilters((p) => ({ ...p, sourceFilter: src.value }))}
                                className="accent-primary"
                              />
                              <span className="text-sm text-foreground">{src.label}</span>
                            </div>
                            {src.value !== "all" && sourceCounts[src.value] !== undefined && (
                              <span className="text-xs text-muted-foreground">{sourceCounts[src.value]}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Study Type with counts */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Tipo de estudo" : "Study Type"}
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {STUDY_TYPES.map((st) => (
                          <label key={st.value} className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted">
                            <Checkbox
                              checked={filters.studyTypes.includes(st.value)}
                              onCheckedChange={() => toggleStudyType(st.value)}
                            />
                            <span className="text-sm text-foreground">{st.label}</span>
                            {studyTypeCounts[st.label] && (
                              <span className="text-xs text-muted-foreground">({studyTypeCounts[st.label]})</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Author search */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">
                        {locale === "pt" ? "Buscar por autor" : "Search by author"}
                      </h4>
                      <Input
                        value={filters.authorKeyword}
                        onChange={(e) => setFilters((p) => ({ ...p, authorKeyword: e.target.value }))}
                        placeholder={locale === "pt" ? "Nome do autor..." : "Author name..."}
                        className="text-sm"
                      />
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
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </button>

              <div className="h-5 w-px bg-border" />

              {/* Save to library */}
              <button
                onClick={handleSaveToLibrary}
                disabled={savingToLibrary || filtered.length === 0}
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

            {/* Active filter chips */}
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {locale === "pt" ? "Filtros ativos:" : "Active filters:"}
                </span>
                {activeFilterChips.map((chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {chip.label}
                    <button onClick={chip.onRemove} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={handleClearAllFilters}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {locale === "pt" ? "Limpar tudo" : "Clear all"}
                </button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm font-medium">{t("search.loading")}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {["Semantic Scholar", "PubMed", "OpenAlex", "Europe PMC"].map((source, i) => (
                    <span
                      key={source}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground animate-pulse"
                      style={{ animationDelay: `${i * 200}ms` }}
                    >
                      <Database className="h-3 w-3" />
                      {source}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground/60">
                  {locale === "pt"
                    ? "Consultando múltiplas bases de dados científicas..."
                    : "Querying multiple scientific databases..."}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Table with virtualization */}
            {!loading && !error && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{rows.length} {locale === "pt" ? "fontes" : "sources"}</span>
                  {loadingColumns.size > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {locale === "pt"
                        ? `Extraindo coluna: ${Array.from(loadingColumns).join(", ")}`
                        : `Extracting column: ${Array.from(loadingColumns).join(", ")}`}
                    </span>
                  )}
                </div>

                <div
                  ref={tableContainerRef}
                  className="overflow-auto rounded-lg border border-border"
                  style={{ maxHeight: "calc(100vh - 280px)" }}
                >
                  <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      {table.getHeaderGroups()[0]?.headers.map((header) => (
                        <col
                          key={header.id}
                          style={{ width: header.getSize() }}
                        />
                      ))}
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-card">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="border-b border-border">
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="relative py-3 px-3 text-left text-sm font-medium text-muted-foreground group"
                              style={{ width: header.getSize() }}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                              {/* Resize handle */}
                              <div
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/30 transition-opacity ${
                                  header.column.getIsResizing() ? "bg-primary/50 opacity-100" : ""
                                }`}
                              />
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody
                      style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        position: "relative",
                      }}
                    >
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                          <tr
                            key={row.id}
                            data-index={virtualRow.index}
                            ref={(node) => rowVirtualizer.measureElement(node)}
                            className="border-b border-border/50 hover:bg-muted/30"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                className="px-3 py-4 align-top"
                                style={{ width: cell.column.getSize() }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {rows.length === 0 && (
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
