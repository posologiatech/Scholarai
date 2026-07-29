import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Search, Loader2, FileText, Upload, AlertTriangle, X, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectAndParse, findDuplicates, type DuplicateGroup } from "@/lib/bibliographyParsers";
import BooleanQueryBuilder from "./BooleanQueryBuilder";

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  source?: string;
  doi?: string;
  url?: string;
  journal?: string;
}

interface StepCollectionProps {
  question: string;
  papers: Paper[];
  onPapersChange: (papers: Paper[]) => void;
  onNext: () => void;
  onPrev: () => void;
  duplicatesRemoved?: number;
  onDuplicatesRemovedChange?: (n: number) => void;
  searchStrategy?: string;
  onSearchStrategyChange?: (s: string) => void;
  locked?: boolean;
}

const StepCollection = ({ question, papers, onPapersChange, onNext, onPrev, duplicatesRemoved = 0, onDuplicatesRemovedChange, searchStrategy: persistedStrategy, onSearchStrategyChange, locked }: StepCollectionProps) => {
  const { locale } = useLanguage();
  const [searching, setSearching] = useState(false);
  const [searchCount, setSearchCount] = useState(200);
  const [importing, setImporting] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [showBooleanBuilder, setShowBooleanBuilder] = useState(false);
  const [searchStrategy, setSearchStrategy] = useState(persistedStrategy || "");
  const [customQuery, setCustomQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pt = locale === "pt";

  const handleSearch = async (queryOverride?: string) => {
    const q = queryOverride || customQuery || question;
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-papers", {
        body: { query: q, limit: searchCount },
      });
      if (error) throw error;
      const results: Paper[] = (data?.papers || data?.results || []).map((p: any) => ({
        id: p.paperId || p.id || crypto.randomUUID(),
        title: p.title,
        authors: p.authors?.map((a: any) => a.name || a) || [],
        year: p.year,
        abstract: p.abstract,
        source: p.source || "semantic_scholar",
        doi: p.doi,
        url: p.url,
      }));
      const merged = [...papers, ...results];
      runDeduplication(merged);
      toast.success(pt ? `${results.length} artigos encontrados` : `${results.length} papers found`);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    let totalImported = 0;
    try {
      const allImported: Paper[] = [];
      for (const file of Array.from(files)) {
        const text = await file.text();
        const parsed = detectAndParse(text, file.name);
        allImported.push(...parsed);
        totalImported += parsed.length;
      }
      if (totalImported === 0) {
        toast.error(pt ? "Nenhum artigo encontrado nos arquivos" : "No papers found in files");
        return;
      }
      const merged = [...papers, ...allImported];
      runDeduplication(merged);
      toast.success(pt ? `${totalImported} artigos importados` : `${totalImported} papers imported`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runDeduplication = (allPapers: Paper[]) => {
    const { unique, duplicateGroups: groups } = findDuplicates(allPapers);
    const removedCount = allPapers.length - unique.length;
    onPapersChange(unique);
    setDuplicateGroups(groups);
    if (removedCount > 0) {
      onDuplicatesRemovedChange?.((duplicatesRemoved || 0) + removedCount);
      setShowDuplicates(true);
      toast.info(pt ? `${removedCount} duplicatas detectadas e removidas` : `${removedCount} duplicates detected and removed`);
    }
  };

  const removePaper = (id: string) => {
    onPapersChange(papers.filter((p) => p.id !== id));
  };

  const sourceCounts: Record<string, number> = {};
  papers.forEach((p) => {
    const src = p.source || "unknown";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  const downloadStrategy = () => {
    if (!searchStrategy) return;
    const blob = new Blob([searchStrategy], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "search-strategy.md";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(pt ? "Estratégia exportada!" : "Strategy exported!");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <FileText className="h-4 w-4" />
          {pt ? "Etapa 2: Coleta de Artigos" : "Step 2: Article Collection"}
        </div>
        <p className="text-sm text-muted-foreground">
          {pt
            ? "Busque via API, use busca booleana avançada ou importe artigos de arquivos RIS, BibTeX ou CSV."
            : "Search via API, use advanced boolean search, or import papers from RIS, BibTeX or CSV files."}
        </p>
      </div>

      {/* Boolean Query Builder toggle */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowBooleanBuilder(!showBooleanBuilder)}
          className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {pt ? "Busca Booleana Avançada + Estratégia de Busca" : "Advanced Boolean Search + Search Strategy"}
            </span>
          </div>
          {showBooleanBuilder ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showBooleanBuilder && (
          <div className="border-t border-border p-4">
            <BooleanQueryBuilder
              onQueryGenerated={(q) => {
                setCustomQuery(q);
                handleSearch(q);
              }}
              onStrategyExport={(s) => {
                setSearchStrategy(s);
                if (!locked) onSearchStrategyChange?.(s);
              }}
            />
          </div>
        )}
      </div>

      {/* Search strategy download */}
      {searchStrategy && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground flex-1">
            {locked
              ? (pt ? "Estratégia de busca registrada no protocolo (bloqueada)" : "Search strategy registered in the protocol (locked)")
              : (pt ? "Estratégia de busca documentada disponível" : "Documented search strategy available")}
          </span>
          <Button size="sm" variant="outline" onClick={downloadStrategy} className="gap-1.5 text-xs">
            {pt ? "Baixar .md" : "Download .md"}
          </Button>
        </div>
      )}

      {/* Simple search controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex-1 text-sm text-muted-foreground truncate">
          <span className="font-medium text-foreground">{pt ? "Pergunta:" : "Question:"}</span> {question}
        </div>
        <select
          value={searchCount}
          onChange={(e) => setSearchCount(Number(e.target.value))}
          className="rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value={100}>100 {pt ? "artigos" : "papers"}</option>
          <option value={200}>200 {pt ? "artigos" : "papers"}</option>
          <option value={500}>500 {pt ? "artigos" : "papers"}</option>
        </select>
        <Button onClick={() => handleSearch()} disabled={searching} className="gap-2">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {pt ? "Buscar" : "Search"}
        </Button>
      </div>

      {/* Import section */}
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Upload className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {pt ? "Importar de bases externas" : "Import from external databases"}
            </p>
            <p className="text-xs text-muted-foreground">
              {pt ? "Suporta RIS (Scopus, WoS), BibTeX (Google Scholar), CSV e EndNote XML" : "Supports RIS (Scopus, WoS), BibTeX (Google Scholar), CSV and EndNote XML"}
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept=".ris,.bib,.bibtex,.csv,.txt,.enw,.xml" multiple onChange={handleFileImport} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {pt ? "Importar arquivos" : "Import files"}
          </Button>
        </div>
      </div>

      {/* Deduplication notice */}
      {showDuplicates && duplicateGroups.length > 0 && (
        <div className="rounded-xl border border-yellow-300/50 bg-yellow-50 dark:bg-yellow-950/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {pt ? `${duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0)} duplicatas removidas` : `${duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0)} duplicates removed`}
              </span>
            </div>
            <button onClick={() => setShowDuplicates(false)} className="text-yellow-600 hover:text-yellow-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {duplicateGroups.slice(0, 10).map((g, i) => (
              <div key={i} className="text-xs text-yellow-700 dark:text-yellow-300">
                <span className="font-medium">{g.keep.title.slice(0, 60)}...</span>
                <span className="text-yellow-600 dark:text-yellow-400"> ({g.duplicates.length} dup.)</span>
              </div>
            ))}
            {duplicateGroups.length > 10 && (
              <p className="text-xs text-yellow-600">+{duplicateGroups.length - 10} {pt ? "mais grupos" : "more groups"}</p>
            )}
          </div>
        </div>
      )}

      {/* Source breakdown */}
      {papers.length > 0 && Object.keys(sourceCounts).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(sourceCounts).map(([src, count]) => (
            <Badge key={src} variant="secondary" className="text-xs">
              {src.replace(/_/g, " ").replace("imported ", "📥 ")}: {count}
            </Badge>
          ))}
          {duplicatesRemoved > 0 && (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
              🔁 {pt ? "Duplicatas removidas" : "Duplicates removed"}: {duplicatesRemoved}
            </Badge>
          )}
        </div>
      )}

      {/* Papers list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            {pt ? `${papers.length} artigos coletados` : `${papers.length} papers collected`}
          </h3>
        </div>
        {papers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {pt ? "Busque ou importe artigos para começar" : "Search or import papers to get started"}
            </p>
          </div>
        ) : (
          <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {papers.map((paper) => (
              <div key={paper.id} className="flex items-start gap-3 rounded-lg p-2 text-sm hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{paper.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {paper.authors?.slice(0, 3).join(", ")}
                    {(paper.authors?.length || 0) > 3 && " et al."} {paper.year && `(${paper.year})`}
                    {paper.source?.startsWith("imported") && (
                      <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4">
                        {paper.source.replace("imported_", "📥 ")}
                      </Badge>
                    )}
                  </p>
                </div>
                <button onClick={() => removePaper(paper.id)} className="shrink-0 text-xs text-muted-foreground hover:text-destructive">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {pt ? "Anterior" : "Previous"}
        </Button>
        <Button onClick={onNext} disabled={papers.length === 0} className="gap-2">
          {pt ? "Próximo: Triagem" : "Next: Screening"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepCollection;
