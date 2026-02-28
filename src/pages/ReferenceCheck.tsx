import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
// AppSidebar provided by ProtectedRoute
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, XCircle, Shield } from "lucide-react";
import { toast } from "sonner";

interface ReferenceResult {
  raw_text: string;
  authors?: string;
  year?: string;
  title?: string;
  doi?: string;
  status: "ok" | "warning" | "retracted";
  issues: { type: string; message: string; contexts?: string[] }[];
  citation_stats?: { supporting: number; contrasting: number; mentioning: number };
}

interface CheckSummary {
  total: number;
  ok: number;
  warning: number;
  retracted: number;
}

const ReferenceCheck = () => {
  const { locale } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReferenceResult[] | null>(null);
  const [summary, setSummary] = useState<CheckSummary | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleCheck = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    setSummary(null);

    try {
      // Read file as text (for now, support text-based content)
      const text = await file.text();

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-references`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!resp.ok) throw new Error("Check failed");

      const data = await resp.json();
      setResults(data.references || []);
      setSummary(data.summary || null);

      if (data.summary?.retracted > 0) {
        toast.error(
          locale === "pt"
            ? `${data.summary.retracted} referência(s) retratada(s) encontrada(s)!`
            : `${data.summary.retracted} retracted reference(s) found!`
        );
      } else if (data.summary?.warning > 0) {
        toast.warning(
          locale === "pt"
            ? `${data.summary.warning} referência(s) contestada(s)`
            : `${data.summary.warning} contested reference(s)`
        );
      } else {
        toast.success(
          locale === "pt"
            ? "Todas as referências parecem válidas!"
            : "All references appear valid!"
        );
      }
    } catch (err) {
      console.error("Reference check failed:", err);
      toast.error(locale === "pt" ? "Erro na verificação" : "Check failed");
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "retracted": return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "retracted":
        return <Badge variant="destructive">{locale === "pt" ? "Retratado" : "Retracted"}</Badge>;
      case "warning":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">{locale === "pt" ? "Contestado" : "Contested"}</Badge>;
      default:
        return <Badge variant="secondary" className="bg-success/10 text-success">{locale === "pt" ? "OK" : "OK"}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl py-8 space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                {locale === "pt" ? "Verificador de Referências" : "Reference Check"}
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              {locale === "pt"
                ? "Faça upload do seu manuscrito e verifique se alguma das referências citadas foi retratada ou amplamente contestada pela comunidade científica."
                : "Upload your manuscript and check if any cited references have been retracted or widely contested by the scientific community."}
            </p>
          </div>

          {/* Upload area */}
          <Card>
            <CardContent className="pt-6">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {locale === "pt"
                    ? "Arraste seu manuscrito aqui"
                    : "Drag your manuscript here"}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {locale === "pt" ? "ou clique para selecionar" : "or click to select"}
                  {" · TXT, DOCX"}
                </p>
                <input
                  type="file"
                  accept=".txt,.doc,.docx"
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </div>

              {file && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleCheck} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {locale === "pt" ? "Verificar referências" : "Check references"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          {summary && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Referências" : "References"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-success">{summary.ok}</p>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Válidas" : "Valid"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">{summary.warning}</p>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Contestadas" : "Contested"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{summary.retracted}</p>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Retratadas" : "Retracted"}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Results */}
          {results && results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {locale === "pt" ? "Relatório de Referências" : "Reference Report"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.map((ref, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-4 ${
                        ref.status === "retracted"
                          ? "border-destructive/40 bg-destructive/5"
                          : ref.status === "warning"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {statusIcon(ref.status)}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {statusBadge(ref.status)}
                            {ref.doi && (
                              <a
                                href={`https://doi.org/${ref.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                DOI: {ref.doi}
                              </a>
                            )}
                          </div>
                          <p className="text-sm text-foreground">{ref.title || ref.raw_text}</p>
                          {ref.authors && (
                            <p className="text-xs text-muted-foreground">{ref.authors}{ref.year ? `, ${ref.year}` : ""}</p>
                          )}
                          {ref.issues.map((issue, iIdx) => (
                            <div key={iIdx} className="rounded bg-muted/50 p-2 text-xs text-foreground/80">
                              <p className="font-medium">{issue.message}</p>
                              {issue.contexts?.map((ctx, cIdx) => (
                                <p key={cIdx} className="mt-1 italic text-muted-foreground">"{ctx}"</p>
                              ))}
                            </div>
                          ))}
                          {ref.citation_stats && (
                            <div className="flex gap-2 text-[10px]">
                              <span className="text-success">{ref.citation_stats.supporting} {locale === "pt" ? "apoio" : "supporting"}</span>
                              <span className="text-destructive">{ref.citation_stats.contrasting} {locale === "pt" ? "contraste" : "contrasting"}</span>
                              <span className="text-muted-foreground">{ref.citation_stats.mentioning} {locale === "pt" ? "menção" : "mentioning"}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReferenceCheck;
