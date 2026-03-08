import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
// AppSidebar provided by ProtectedRoute
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UsageLimitDialog } from "@/components/app/UpgradeGate";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, FileText, Loader2, Trash2, Plus, Sparkles, X,
  CheckCircle2, AlertCircle, Table, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface UploadedPaper {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  title: string | null;
  extracted_text: string | null;
  extraction_data: Record<string, string>;
  status: string;
  created_at: string;
}

interface ExtractionColumn {
  name: string;
  prompt: string;
}

const EXTRACT_PDF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-pdf`;

const Extraction = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [papers, setPapers] = useState<UploadedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractingIds, setExtractingIds] = useState<Set<string>>(new Set());

  // Extraction columns
  const [columns, setColumns] = useState<ExtractionColumn[]>([]);
  const [extractionQuery, setExtractionQuery] = useState("");

  // Add column dialog
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColPrompt, setNewColPrompt] = useState("");

  useEffect(() => {
    if (user) fetchPapers();
    else setLoading(false);
  }, [user]);

  const fetchPapers = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("uploaded_papers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setPapers(data as unknown as UploadedPaper[]);
    setLoading(false);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(locale === "pt" ? "Apenas PDFs são aceitos" : "Only PDFs are accepted");
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(locale === "pt" ? "Arquivo muito grande (max 20MB)" : "File too large (max 20MB)");
        continue;
      }

      const filePath = `${user.id}/${Date.now()}_${file.name}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("papers")
          .upload(filePath, file, { contentType: "application/pdf" });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from("uploaded_papers")
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            status: "uploaded",
          });

        if (insertError) throw insertError;

        toast.success(
          locale === "pt"
            ? `${file.name} enviado com sucesso!`
            : `${file.name} uploaded successfully!`
        );
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(err.message || "Upload failed");
      }
    }

    setUploading(false);
    fetchPapers();
  };

  const handleDelete = async (paper: UploadedPaper) => {
    try {
      await supabase.storage.from("papers").remove([paper.file_path]);
      await supabase.from("uploaded_papers").delete().eq("id", paper.id);
      setPapers((prev) => prev.filter((p) => p.id !== paper.id));
      toast.success(locale === "pt" ? "Removido" : "Deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const extractPaper = async (paperId: string) => {
    if (columns.length === 0) {
      toast.error(
        locale === "pt"
          ? "Adicione ao menos uma coluna de extração"
          : "Add at least one extraction column"
      );
      return;
    }
    if (!extractionQuery.trim()) {
      toast.error(
        locale === "pt"
          ? "Defina a pergunta de pesquisa"
          : "Set the research question"
      );
      return;
    }

    setExtractingIds((prev) => new Set(prev).add(paperId));

    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const resp = await fetch(EXTRACT_PDF_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tk}`,
        },
        body: JSON.stringify({
          paper_id: paperId,
          columns,
          query: extractionQuery,
          locale,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Extraction failed");
      }

      const data = await resp.json();

      // Update local state with extraction results
      setPapers((prev) =>
        prev.map((p) => {
          if (p.id !== paperId) return p;
          const newData = { ...(p.extraction_data || {}) };
          for (const ext of data.extractions || []) {
            newData[ext.column_name] = ext.value;
          }
          return { ...p, extraction_data: newData, status: "ready" };
        })
      );

      toast.success(locale === "pt" ? "Extração concluída!" : "Extraction complete!");
    } catch (err: any) {
      console.error("Extract error:", err);
      toast.error(err.message || "Extraction failed");
    } finally {
      setExtractingIds((prev) => {
        const next = new Set(prev);
        next.delete(paperId);
        return next;
      });
    }
  };

  const extractAll = async () => {
    for (const paper of papers) {
      await extractPaper(paper.id);
    }
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    setColumns((prev) => [
      ...prev,
      { name: newColName.trim(), prompt: newColPrompt.trim() || newColName.trim() },
    ]);
    setNewColName("");
    setNewColPrompt("");
    setShowAddColumn(false);
  };

  const removeColumn = (name: string) => {
    setColumns((prev) => prev.filter((c) => c.name !== name));
  };

  const statusIcon = (status: string) => {
    if (status === "ready") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === "processing") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (status === "error") return <AlertCircle className="h-4 w-4 text-destructive" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  // Empty state - no papers uploaded
  if (!loading && papers.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center justify-center rounded-2xl py-20 px-8 max-w-lg text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold text-foreground">
              {locale === "pt"
                ? "Envie papers para começar"
                : "Upload papers to get started"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {locale === "pt"
                ? "Sua biblioteca é usada para armazenar papers e pesquisas para análise e insights."
                : "Your library is used to store papers and research for analysis and insights."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      
      <main className="container max-w-7xl flex-1 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {t("extraction.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">{t("extraction.subtitle")}</p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {locale === "pt" ? "Enviar PDFs" : "Upload PDFs"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {/* Wizard stepper */}
        {(() => {
          const hasPapers = papers.length > 0;
          const hasQuery = extractionQuery.trim().length > 0;
          const hasColumns = columns.length > 0;
          const hasExtracted = papers.some((p) => p.status === "ready");
          const currentStep = hasExtracted ? 4 : hasColumns ? 3 : hasQuery ? 2 : hasPapers ? 1 : 0;

          const steps = [
            { label: locale === "pt" ? "Upload PDFs" : "Upload PDFs", done: hasPapers },
            { label: locale === "pt" ? "Pergunta" : "Question", done: hasQuery },
            { label: locale === "pt" ? "Colunas" : "Columns", done: hasColumns },
            { label: locale === "pt" ? "Extrair" : "Extract", done: hasExtracted },
          ];

          return (
            <div className="mb-6 flex items-center justify-center gap-0">
              {steps.map((step, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep || step.done;
                return (
                  <div key={i} className="flex items-center">
                    {i > 0 && (
                      <div className={`h-px w-8 sm:w-12 ${isDone ? "bg-primary" : "bg-border"}`} />
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          isDone
                            ? "bg-primary text-primary-foreground"
                            : isActive
                            ? "border-2 border-primary text-primary bg-primary/10"
                            : "border border-border text-muted-foreground bg-muted"
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      <span
                        className={`text-[11px] font-medium ${
                          isDone || isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Research question + extraction controls */}
        <div className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Input
              value={extractionQuery}
              onChange={(e) => setExtractionQuery(e.target.value)}
              placeholder={
                locale === "pt"
                  ? "Pergunta de pesquisa (ex: Quais os efeitos da intervenção X?)"
                  : "Research question (e.g., What are the effects of intervention X?)"
              }
              className="flex-1"
            />
            <Button
              onClick={extractAll}
              disabled={
                columns.length === 0 || !extractionQuery.trim() || extractingIds.size > 0
              }
            >
              {extractingIds.size > 0 ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {locale === "pt" ? "Extrair de todos" : "Extract all"}
            </Button>
          </div>

          {/* Columns chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {locale === "pt" ? "Colunas:" : "Columns:"}
            </span>
            {columns.map((col) => (
              <span
                key={col.name}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
              >
                {col.name}
                <button
                  onClick={() => removeColumn(col.name)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => setShowAddColumn(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3 w-3" />
              {locale === "pt" ? "Adicionar coluna" : "Add column"}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          /* Papers table */
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    {locale === "pt" ? "Artigo" : "Paper"}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.name}
                      className="min-w-[200px] px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                    >
                      {col.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    {locale === "pt" ? "Ações" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => (
                  <tr
                    key={paper.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <p className="truncate text-sm font-medium text-foreground">
                          {paper.title || paper.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {paper.file_name}
                          {paper.file_size && (
                            <> · {(paper.file_size / 1024 / 1024).toFixed(1)} MB</>
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(paper.status)}
                        <span className="text-xs text-muted-foreground capitalize">
                          {paper.status}
                        </span>
                      </div>
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.name}
                        className="min-w-[200px] px-4 py-3 align-top"
                      >
                        {extractingIds.has(paper.id) ? (
                          <div className="space-y-2">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                          </div>
                        ) : paper.extraction_data?.[col.name] ? (
                          <p className="text-sm leading-relaxed text-foreground/80">
                            {paper.extraction_data[col.name]}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => extractPaper(paper.id)}
                          disabled={
                            extractingIds.has(paper.id) ||
                            columns.length === 0 ||
                            !extractionQuery.trim()
                          }
                          title={locale === "pt" ? "Extrair dados" : "Extract data"}
                        >
                          {extractingIds.has(paper.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(paper)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add column dialog */}
      <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locale === "pt" ? "Adicionar coluna" : "Add column"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder={locale === "pt" ? "Nome da coluna" : "Column name"}
              autoFocus
            />
            <Textarea
              value={newColPrompt}
              onChange={(e) => setNewColPrompt(e.target.value)}
              placeholder={
                locale === "pt"
                  ? "O que extrair? Ex: Tamanho da amostra e características demográficas"
                  : "What to extract? E.g., Sample size and demographic characteristics"
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddColumn(false)}>
              {locale === "pt" ? "Cancelar" : "Cancel"}
            </Button>
            <Button onClick={addColumn} disabled={!newColName.trim()}>
              {locale === "pt" ? "Adicionar" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Extraction;
