import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Shield, Loader2, Play, Download, CheckCircle, AlertTriangle,
  XCircle, HelpCircle, Star, Plus, Trash2, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { downloadFile } from "@/lib/referenceFormats";

type StudyInput = {
  title: string;
  authors: string;
  year: string;
  abstract: string;
};

type DomainResult = {
  domain_id: string;
  domain_name: string;
  judgment: string;
  rationale: string;
};

type Assessment = {
  study_index: number;
  study_title: string;
  domains: DomainResult[];
  overall_judgment: string;
  overall_rationale: string;
};

const EMPTY_STUDY: StudyInput = { title: "", authors: "", year: "", abstract: "" };

const RiskOfBias = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt";

  const [framework, setFramework] = useState("rob2");
  const [studies, setStudies] = useState<StudyInput[]>([{ ...EMPTY_STUDY }]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [libraryPapers, setLibraryPapers] = useState<any[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);

  useEffect(() => {
    if (user) loadLibrary();
  }, [user]);

  const loadLibrary = async () => {
    setLoadingLib(true);
    const { data } = await supabase.from("saved_searches").select("papers").order("created_at", { ascending: false }).limit(10);
    const papers = (data || []).flatMap((s: any) => s.papers || []);
    // dedupe by title
    const seen = new Set<string>();
    const unique = papers.filter((p: any) => {
      if (seen.has(p.title)) return false;
      seen.add(p.title);
      return true;
    });
    setLibraryPapers(unique.slice(0, 100));
    setLoadingLib(false);
  };

  const addStudy = () => setStudies([...studies, { ...EMPTY_STUDY }]);
  const removeStudy = (i: number) => setStudies(studies.filter((_, idx) => idx !== i));
  const updateStudy = (i: number, field: keyof StudyInput, val: string) => {
    const copy = [...studies];
    copy[i] = { ...copy[i], [field]: val };
    setStudies(copy);
  };

  const importFromLibrary = (paper: any) => {
    const authors = Array.isArray(paper.authors)
      ? paper.authors.map((a: any) => (typeof a === "string" ? a : a.name || "")).join(", ")
      : "";
    setStudies([...studies, {
      title: paper.title || "",
      authors,
      year: paper.year ? String(paper.year) : "",
      abstract: paper.abstract || "",
    }]);
    toast.success(pt ? "Paper adicionado" : "Paper added");
  };

  const runAssessment = async () => {
    const valid = studies.filter((s) => s.title.trim());
    if (!valid.length) { toast.error(pt ? "Adicione pelo menos um estudo" : "Add at least one study"); return; }

    setLoading(true);
    setAssessments([]);
    try {
      const { data, error } = await supabase.functions.invoke("risk-of-bias", {
        body: {
          action: "assess",
          framework,
          papers: valid.map((s) => ({
            title: s.title,
            authors: s.authors,
            year: s.year ? parseInt(s.year) : null,
            abstract: s.abstract,
          })),
        },
      });
      if (error) throw error;
      setAssessments(data.assessments || []);
      if (!data.assessments?.length) toast.error(pt ? "Nenhuma avaliação retornada" : "No assessment returned");
      else toast.success(pt ? "Avaliação concluída!" : "Assessment complete!");
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  // ── Judgment rendering ──
  const judgmentColor = (j: string) => {
    const low = j.toLowerCase();
    if (low.includes("low") || low === "star" || low === "⭐") return "bg-green-500/15 text-green-700 border-green-300";
    if (low.includes("some") || low.includes("moderate")) return "bg-yellow-500/15 text-yellow-700 border-yellow-300";
    if (low.includes("high") || low.includes("serious") || low.includes("critical") || low === "no star") return "bg-red-500/15 text-red-700 border-red-300";
    return "bg-muted text-muted-foreground";
  };

  const judgmentIcon = (j: string) => {
    const low = j.toLowerCase();
    if (low.includes("low") || low === "star" || low === "⭐") return <CheckCircle className="h-3.5 w-3.5" />;
    if (low.includes("some") || low.includes("moderate")) return <AlertTriangle className="h-3.5 w-3.5" />;
    if (low.includes("high") || low.includes("serious") || low.includes("critical")) return <XCircle className="h-3.5 w-3.5" />;
    return <HelpCircle className="h-3.5 w-3.5" />;
  };

  // ── Export ──
  const exportCSV = () => {
    if (!assessments.length) return;
    const allDomains = assessments[0]?.domains || [];
    const header = ["Study", ...allDomains.map((d) => d.domain_name), "Overall"].join(",");
    const rows = assessments.map((a) => {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return [
        esc(a.study_title),
        ...a.domains.map((d) => esc(d.judgment)),
        esc(a.overall_judgment),
      ].join(",");
    });
    downloadFile([header, ...rows].join("\n"), `risk_of_bias_${framework}.csv`, "text/csv");
    toast.success(pt ? "Tabela exportada" : "Table exported");
  };

  const exportHTML = () => {
    if (!assessments.length) return;
    const allDomains = assessments[0]?.domains || [];
    const colorCell = (j: string) => {
      const low = j.toLowerCase();
      if (low.includes("low") || low === "star") return "background:#d4edda;color:#155724";
      if (low.includes("some") || low.includes("moderate")) return "background:#fff3cd;color:#856404";
      if (low.includes("high") || low.includes("serious")) return "background:#f8d7da;color:#721c24";
      return "background:#e2e3e5;color:#383d41";
    };

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Risk of Bias - ${framework.toUpperCase()}</title>
<style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:center;font-size:13px}th{background:#f5f5f5;font-weight:600}.study{text-align:left;font-weight:500}h1{font-size:18px}h2{font-size:14px;color:#666;margin-bottom:16px}</style></head><body>`;
    html += `<h1>Risk of Bias Assessment — ${framework === "rob2" ? "RoB 2" : framework === "robins-i" ? "ROBINS-I" : "NOS"}</h1>`;
    html += `<h2>Generated by Arca Research</h2>`;
    html += `<table><thead><tr><th>Study</th>${allDomains.map((d) => `<th>${d.domain_id}<br><small>${d.domain_name}</small></th>`).join("")}<th>Overall</th></tr></thead><tbody>`;
    for (const a of assessments) {
      html += `<tr><td class="study">${a.study_title}</td>`;
      for (const d of a.domains) {
        html += `<td style="${colorCell(d.judgment)}" title="${d.rationale}">${d.judgment}</td>`;
      }
      html += `<td style="${colorCell(a.overall_judgment)}" title="${a.overall_rationale}">${a.overall_judgment}</td></tr>`;
    }
    html += `</tbody></table>`;

    // Rationale table
    html += `<h2 style="margin-top:24px">Rationales</h2><table><thead><tr><th>Study</th><th>Domain</th><th>Judgment</th><th style="text-align:left">Rationale</th></tr></thead><tbody>`;
    for (const a of assessments) {
      for (const d of a.domains) {
        html += `<tr><td class="study">${a.study_title}</td><td>${d.domain_name}</td><td style="${colorCell(d.judgment)}">${d.judgment}</td><td style="text-align:left">${d.rationale}</td></tr>`;
      }
    }
    html += `</tbody></table></body></html>`;
    downloadFile(html, `risk_of_bias_${framework}.html`, "text/html");
    toast.success(pt ? "Tabela HTML exportada" : "HTML table exported");
  };

  const frameworkLabel = framework === "rob2" ? "RoB 2 (Cochrane)" : framework === "robins-i" ? "ROBINS-I" : "Newcastle-Ottawa (NOS)";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/40 bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">{pt ? "Análise de Qualidade Metodológica" : "Risk of Bias Assessment"}</h1>
              <p className="text-sm text-muted-foreground">{frameworkLabel}</p>
            </div>
          </div>
          <Select value={framework} onValueChange={setFramework}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rob2">RoB 2 — {pt ? "Ensaios clínicos" : "Clinical trials"}</SelectItem>
              <SelectItem value="robins-i">ROBINS-I — {pt ? "Estudos observacionais" : "Observational"}</SelectItem>
              <SelectItem value="nos">NOS — {pt ? "Coortes" : "Cohort studies"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="input" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="input">{pt ? "Estudos" : "Studies"}</TabsTrigger>
            <TabsTrigger value="results" disabled={!assessments.length}>
              {pt ? "Resultados" : "Results"}
              {assessments.length > 0 && ` (${assessments.length})`}
            </TabsTrigger>
            <TabsTrigger value="table" disabled={!assessments.length}>
              {pt ? "Tabela" : "Summary Table"}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Input Tab ── */}
        <TabsContent value="input" className="flex-1 overflow-hidden flex gap-4 px-6 pb-6">
          {/* Left: study inputs */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">{studies.length} {pt ? "estudo(s)" : "study(ies)"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addStudy}>
                  <Plus className="h-4 w-4 mr-1" />{pt ? "Adicionar" : "Add"}
                </Button>
                <Button size="sm" onClick={runAssessment} disabled={loading || !studies.some((s) => s.title.trim())}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                  {pt ? "Avaliar" : "Assess"}
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-2">
                {studies.map((s, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{pt ? "Estudo" : "Study"} {i + 1}</span>
                        {studies.length > 1 && (
                          <Button size="sm" variant="ghost" onClick={() => removeStudy(i)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <Input placeholder={pt ? "Título do estudo *" : "Study title *"} value={s.title} onChange={(e) => updateStudy(i, "title", e.target.value)} />
                      <div className="flex gap-2">
                        <Input placeholder={pt ? "Autores" : "Authors"} value={s.authors} onChange={(e) => updateStudy(i, "authors", e.target.value)} className="flex-1" />
                        <Input placeholder={pt ? "Ano" : "Year"} value={s.year} onChange={(e) => updateStudy(i, "year", e.target.value)} className="w-24" />
                      </div>
                      <Textarea placeholder={pt ? "Abstract (recomendado para melhor avaliação)" : "Abstract (recommended for better assessment)"} value={s.abstract} onChange={(e) => updateStudy(i, "abstract", e.target.value)} rows={3} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right: import from library */}
          <div className="w-72 border-l border-border/40 pl-4 flex flex-col overflow-hidden">
            <h3 className="text-sm font-semibold mb-2">{pt ? "Importar da Biblioteca" : "Import from Library"}</h3>
            {loadingLib ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8 text-muted-foreground" />
            ) : libraryPapers.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-4">{pt ? "Nenhum paper na biblioteca" : "No papers in library"}</p>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-1 pr-2">
                  {libraryPapers.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => importFromLibrary(p)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-xs font-medium leading-tight line-clamp-2">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground">{p.year || ""}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        {/* ── Results Tab ── */}
        <TabsContent value="results" className="flex-1 overflow-auto px-6 pb-6">
          <div className="space-y-4">
            {assessments.map((a, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{a.study_title}</CardTitle>
                    <Badge className={judgmentColor(a.overall_judgment)}>
                      {judgmentIcon(a.overall_judgment)}
                      <span className="ml-1">{a.overall_judgment}</span>
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.overall_rationale}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {a.domains.map((d) => (
                      <div key={d.domain_id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                        <Badge variant="outline" className="shrink-0 text-xs">{d.domain_id}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{d.domain_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{d.rationale}</p>
                        </div>
                        <Badge className={`shrink-0 ${judgmentColor(d.judgment)}`}>
                          {judgmentIcon(d.judgment)}
                          <span className="ml-1 text-xs">{d.judgment}</span>
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Summary Table Tab ── */}
        <TabsContent value="table" className="flex-1 overflow-auto px-6 pb-6">
          <div className="flex justify-end gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportHTML}>
              <Download className="h-4 w-4 mr-1" />HTML
            </Button>
          </div>

          {assessments.length > 0 && (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">{pt ? "Estudo" : "Study"}</TableHead>
                    {assessments[0].domains.map((d) => (
                      <TableHead key={d.domain_id} className="text-center min-w-[100px]">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-semibold">{d.domain_id}</span>
                              <span className="text-[10px] font-normal leading-tight">{d.domain_name}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{d.domain_name}</TooltipContent>
                        </Tooltip>
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[100px]">Overall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{a.study_title}</TableCell>
                      {a.domains.map((d) => (
                        <TableCell key={d.domain_id} className="text-center p-1">
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${judgmentColor(d.judgment)}`}>
                                {judgmentIcon(d.judgment)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold">{d.judgment}</p>
                              <p className="text-xs mt-1">{d.rationale}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      ))}
                      <TableCell className="text-center p-1">
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${judgmentColor(a.overall_judgment)}`}>
                              {judgmentIcon(a.overall_judgment)}
                              <span>{a.overall_judgment}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{a.overall_rationale}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-600" /> Low risk</div>
            <div className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-yellow-600" /> Some concerns</div>
            <div className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-600" /> High risk</div>
            <div className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /> No information</div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RiskOfBias;
