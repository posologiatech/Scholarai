import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  BookOpen, Trash2, ExternalLink, Loader2, Search, Download, Upload,
  FileText, FileDown, FileUp, Pencil, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  papersToRIS, papersToBibTeX, papersToCSV, parseRIS, parseBibTeX, parseCSV,
  downloadFile, type PaperRef,
} from "@/lib/referenceFormats";

interface SavedSearch {
  id: string;
  query: string;
  papers: any[];
  created_at: string;
}

const Library = () => {
  const { t, locale } = useLanguage();
  const pt = locale === "pt";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<PaperRef[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
      toast.success(pt ? "Removido!" : "Removed!");
    }
  };

  const startRename = (s: SavedSearch) => {
    setEditingId(s.id);
    setEditingName(s.query);
  };

  const confirmRename = async () => {
    if (!editingId || !editingName.trim()) return;
    const { error } = await supabase
      .from("saved_searches")
      .update({ query: editingName.trim() })
      .eq("id", editingId);
    if (!error) {
      setSearches(prev => prev.map(s => s.id === editingId ? { ...s, query: editingName.trim() } : s));
      toast.success(pt ? "Renomeado!" : "Renamed!");
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  // ── Collect all papers from all saved searches ──
  const allPapers: PaperRef[] = searches.flatMap((s) =>
    (s.papers as any[]).map((p: any) => ({
      title: p.title,
      authors: p.authors,
      year: p.year,
      doi: p.doi,
      journal: p.journal,
      abstract: p.abstract,
      url: p.url,
      source: p.source,
    }))
  );

  // ── Export handlers ──
  const exportRIS = () => {
    if (!allPapers.length) { toast.error(pt ? "Nenhum paper para exportar" : "No papers to export"); return; }
    downloadFile(papersToRIS(allPapers), "arca_library.ris", "application/x-research-info-systems");
    toast.success(pt ? "Exportado em RIS" : "Exported as RIS");
  };

  const exportBibTeX = () => {
    if (!allPapers.length) { toast.error(pt ? "Nenhum paper para exportar" : "No papers to export"); return; }
    downloadFile(papersToBibTeX(allPapers), "arca_library.bib", "application/x-bibtex");
    toast.success(pt ? "Exportado em BibTeX" : "Exported as BibTeX");
  };

  const exportCSV = () => {
    if (!allPapers.length) { toast.error(pt ? "Nenhum paper para exportar" : "No papers to export"); return; }
    downloadFile(papersToCSV(allPapers), "arca_library.csv", "text/csv");
    toast.success(pt ? "Exportado em CSV" : "Exported as CSV");
  };

  // ── Import handler ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      let papers: PaperRef[] = [];
      const ext = file.name.toLowerCase();
      if (ext.endsWith(".ris")) papers = parseRIS(content);
      else if (ext.endsWith(".bib") || ext.endsWith(".bibtex")) papers = parseBibTeX(content);
      else if (ext.endsWith(".csv")) papers = parseCSV(content);
      else { toast.error(pt ? "Formato não suportado. Use .ris, .bib ou .csv" : "Unsupported format. Use .ris, .bib or .csv"); return; }

      if (!papers.length) { toast.error(pt ? "Nenhum paper encontrado no arquivo" : "No papers found in file"); return; }
      setImportPreview(papers);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!importPreview || !user) return;
    setImporting(true);
    try {
      // Save as a new search entry
      const { error } = await supabase.from("saved_searches").insert({
        user_id: user.id,
        query: `Imported (${importPreview.length} papers)`,
        papers: importPreview.map((p) => ({
          title: p.title,
          authors: p.authors || [],
          year: p.year,
          doi: p.doi,
          journal: p.journal,
          abstract: p.abstract,
          url: p.url,
          source: "import",
        })),
        columns: [],
        column_data: {},
      });
      if (error) throw error;
      toast.success(pt ? `${importPreview.length} papers importados!` : `${importPreview.length} papers imported!`);
      setImportPreview(null);
      fetchSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container max-w-4xl flex-1 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{t("library.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("library.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import */}
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {pt ? "Importar" : "Import"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".ris,.bib,.bibtex,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!allPapers.length}>
                  <Download className="h-4 w-4 mr-2" />
                  {pt ? "Exportar" : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportRIS}>
                  <FileText className="h-4 w-4 mr-2" />
                  RIS (Zotero, Mendeley, EndNote)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportBibTeX}>
                  <FileDown className="h-4 w-4 mr-2" />
                  BibTeX (LaTeX)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSV}>
                  <FileUp className="h-4 w-4 mr-2" />
                  CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
            <Button className="mt-4" onClick={() => navigate("/dashboard")}>
              <Search className="mr-2 h-4 w-4" />
              {t("library.goSearch")}
            </Button>
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
                  onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`, { state: { savedSearch: s } })}
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
                    onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`, { state: { savedSearch: s } })}
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

      {/* Import Preview Dialog */}
      <Dialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{pt ? "Importar Referências" : "Import References"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {importPreview?.length} {pt ? "papers encontrados no arquivo" : "papers found in file"}
          </p>
          <div className="flex-1 overflow-auto border rounded-lg divide-y divide-border max-h-[50vh]">
            {importPreview?.slice(0, 50).map((p, i) => (
              <div key={i} className="px-3 py-2">
                <p className="text-sm font-medium leading-tight">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  {Array.isArray(p.authors) ? p.authors.slice(0, 3).join(", ") : ""}{" "}
                  {p.year && `(${p.year})`}
                </p>
              </div>
            ))}
            {(importPreview?.length || 0) > 50 && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                +{(importPreview?.length || 0) - 50} {pt ? "mais" : "more"}...
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setImportPreview(null)}>{pt ? "Cancelar" : "Cancel"}</Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {pt ? "Importar" : "Import"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Library;
