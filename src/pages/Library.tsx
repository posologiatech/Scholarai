import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  BookOpen, Trash2, ExternalLink, Loader2, Search, Download,
  FileText, FileDown, FileUp, Pencil, Check, X, UploadCloud,
} from "lucide-react";
import ReferenceManagerSync from "@/components/app/ReferenceManagerSync";
import AddToLibraryDialog from "@/components/library/AddToLibraryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { useProjectLinkedIds } from "@/hooks/useProjectLinkedIds";
import { importPapersToReferences } from "@/lib/research/integrations";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  papersToRIS, papersToBibTeX, papersToCSV, downloadFile, type PaperRef,
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
  const linkedSearchIds = useProjectLinkedIds("search");
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container max-w-4xl flex-1 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{t("library.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("library.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Add to library */}
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <UploadCloud className="h-4 w-4 mr-2" />
              {pt ? "Enviar para Biblioteca" : "Send to Library"}
            </Button>

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

        {/* Zotero / Mendeley sync */}
        <div className="mb-8 rounded-xl border border-border/40 bg-card/50 p-4">
          <ReferenceManagerSync />
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
                {editingId === s.id ? (
                  <div className="flex-1 flex items-center gap-2 mr-2">
                    <Input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") confirmRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" onClick={confirmRename} className="shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={cancelRename} className="shrink-0">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`, { state: { savedSearch: s } })}
                  >
                    <h3 className="text-sm font-semibold text-foreground">{s.query}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(s.papers as any[])?.length || 0} papers · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <LinkToProjectButton
                    resourceType="search"
                    resourceId={s.id}
                    label={s.query}
                    attachTable="saved_searches"
                    variant="ghost"
                    linked={linkedSearchIds.has(s.id)}
                    metadata={{ papers: (s.papers as any[])?.length || 0 }}
                    onLinked={async (projectId) => {
                      try {
                        const papers = ((s.papers as any[]) || []).map((p: any) => ({
                          external_paper_id: p.id || p.external_id || p.paperId || null,
                          title: p.title || "(sem título)",
                          authors: Array.isArray(p.authors) ? p.authors.join(", ") : (p.authors || null),
                          year: p.year || null,
                          doi: p.doi || null,
                        }));
                        const n = await importPapersToReferences(projectId, papers);
                        if (n > 0) toast.success(pt ? `${n} referência(s) importada(s)` : `${n} reference(s) imported`);
                      } catch { /* non-blocking */ }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startRename(s)}
                    title={pt ? "Renomear" : "Rename"}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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

      <AddToLibraryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onImported={fetchSaved}
      />
    </div>
  );
};

export default Library;
