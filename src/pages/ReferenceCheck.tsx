import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
// AppSidebar provided by ProtectedRoute
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, XCircle, Shield, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { RegisterOutputButton } from "@/components/research/RegisterOutputButton";

interface ReferenceResult {
  raw_text: string;
  authors?: string;
  year?: string;
  title?: string;
  doi?: string;
  matched_doi?: string;
  status: "ok" | "warning" | "retracted" | "unverified";
  issues: { type: string; message: string; contexts?: string[] }[];
  citation_stats?: { supporting: number; contrasting: number; mentioning: number };
}

interface CheckSummary {
  total: number;
  ok: number;
  warning: number;
  unverified: number;
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
      let text = "";

      if (file.name.toLowerCase().endsWith(".pdf")) {
        // For PDFs, send as base64 to edge function for extraction
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        
        // First extract text from PDF via edge function
        const extractUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-pdf`;
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess?.session?.access_token;
        if (!tk) throw new Error("Not authenticated");

        const extractResp = await fetch(extractUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tk}`,
          },
          body: JSON.stringify({ pdf_base64: base64, file_name: file.name }),
        });
        
        if (extractResp.ok) {
          const extractData = await extractResp.json();
          text = extractData.text || extractData.extracted_text || "";
        }
        
        if (!text) {
          toast.error(locale === "pt" ? "Não foi possível extrair texto do PDF" : "Could not extract text from PDF");
          setLoading(false);
          return;
        }
      } else {
        // Text-based files (TXT, DOCX)
        text = await file.text();
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-references`;
      const { data: sess3 } = await supabase.auth.getSession();
      const tk3 = sess3?.session?.access_token;
      if (!tk3) throw new Error("Not authenticated");

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tk3}`,
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
      } else if (data.summary?.unverified > 0) {
        toast.warning(
          locale === "pt"
            ? `${data.summary.unverified} referência(s) não puderam ser confirmadas — podem não existir`
            : `${data.summary.unverified} reference(s) could not be confirmed — may not exist`
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
            ? "Todas as referências foram confirmadas em bases bibliográficas reais!"
            : "All references were confirmed against real bibliographic databases!"
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
      case "unverified": return <HelpCircle className="h-5 w-5 text-orange-500" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "retracted":
        return <Badge variant="destructive">{locale === "pt" ? "Retratado" : "Retracted"}</Badge>;
      case "unverified":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">{locale === "pt" ? "Não verificada" : "Unverified"}</Badge>;
      case "warning":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">{locale === "pt" ? "Contestado" : "Contested"}</Badge>;
      default:
        return <Badge variant="secondary" className="bg-success/10 text-success">{locale === "pt" ? "Confirmada" : "Confirmed"}</Badge>;
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
                ? "Faça upload do seu manuscrito. Cada referência é conferida contra o CrossRef para confirmar que existe de verdade — e não só uma citação com aparência plausível — além de checar retratação e contestação pela comunidade científica."
                : "Upload your manuscript. Every reference is checked against CrossRef to confirm it actually exists — not just that it looks plausible — plus retraction and community contestation checks."}
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
                  {" · TXT, DOCX, PDF"}
                </p>
                <input
                  type="file"
                  accept=".txt,.doc,.docx,.pdf"
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
            <div className="grid gap-4 sm:grid-cols-5">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Referências" : "References"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-success">{summary.ok}</p>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Confirmadas" : "Confirmed"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-orange-500">{summary.unverified}</p>
                  <p className="text-xs text-muted-foreground">{locale === "pt" ? "Não verificadas" : "Unverified"}</p>
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
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">
                  {locale === "pt" ? "Relatório de Referências" : "Reference Report"}
                </CardTitle>
                {summary && (
                  <RegisterOutputButton
                    defaultTitle={locale === "pt" ? `Checagem de referências: ${file?.name || ""}` : `Reference check: ${file?.name || ""}`}
                    outputType="report"
                    description={locale === "pt" ? "Relatório de verificação de referências gerado na plataforma." : "Reference verification report generated on the platform."}
                    linkType="reference_check"
                    metrics={summary as unknown as Record<string, number>}
                    size="sm"
                    variant="ghost"
                  />
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.map((ref, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-4 ${
                        ref.status === "retracted"
                          ? "border-destructive/40 bg-destructive/5"
                          : ref.status === "unverified"
                          ? "border-orange-500/40 bg-orange-500/5"
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
                          {ref.matched_doi && (
                            <p className="text-xs text-muted-foreground">
                              {locale === "pt" ? "Possível DOI correto encontrado: " : "Possible correct DOI found: "}
                              <a href={`https://doi.org/${ref.matched_doi}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {ref.matched_doi}
                              </a>
                            </p>
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
