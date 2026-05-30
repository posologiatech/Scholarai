import { useState, useCallback, useEffect } from "react";
import { UpgradeGate } from "@/components/app/UpgradeGate";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ForestPlot, FunnelPlot } from "@/components/meta-analysis/MetaAnalysisCharts";
import {
  Calculator, Plus, Trash2, Loader2, BarChart3, TrendingUp, FileText, Sparkles,
  Download, AlertTriangle, CheckCircle2, Info,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Study {
  id: string;
  name: string;
  // For Cohen's d
  mean1: number; sd1: number; n1: number;
  mean2: number; sd2: number; n2: number;
  // For OR/RR
  events1: number; events2: number;
  // Computed
  effect?: number; se?: number; ci_lower?: number; ci_upper?: number;
  or?: number; rr?: number;
}

const emptyStudy = (): Study => ({
  id: crypto.randomUUID(),
  name: "",
  mean1: 0, sd1: 0, n1: 0,
  mean2: 0, sd2: 0, n2: 0,
  events1: 0, events2: 0,
});

const MetaAnalysis = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt";

  const [effectType, setEffectType] = useState<string>("cohens_d");
  const [studies, setStudies] = useState<Study[]>([emptyStudy(), emptyStudy()]);
  const [results, setResults] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [interpretation, setInterpretation] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [activeTab, setActiveTab] = useState("input");

  const addStudy = () => setStudies(prev => [...prev, emptyStudy()]);
  const removeStudy = (id: string) => setStudies(prev => prev.filter(s => s.id !== id));

  const updateStudy = (id: string, field: string, value: number | string) => {
    setStudies(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: typeof value === "string" && field !== "name" ? parseFloat(value) || 0 : value } : s
    ));
  };

  const calculate = useCallback(async () => {
    const valid = studies.filter(s => s.name.trim() && (effectType === "cohens_d" ? s.n1 > 0 && s.n2 > 0 : s.n1 > 0 && s.n2 > 0));
    if (valid.length < 2) {
      toast.error(pt ? "Mínimo de 2 estudos válidos necessários" : "Minimum 2 valid studies required");
      return;
    }

    setCalculating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tk}`,
          },
          body: JSON.stringify({ action: "calculate", studies: valid, effectType }),
        }
      );
      if (!resp.ok) throw new Error("Calculation failed");
      const data = await resp.json();
      setResults(data);
      setActiveTab("results");
      toast.success(pt ? "Meta-análise calculada!" : "Meta-analysis calculated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCalculating(false);
    }
  }, [studies, effectType, pt]);

  const interpret = useCallback(async () => {
    if (!results) return;
    setInterpreting(true);
    setInterpretation("");
    try {
      const { data: sess2 } = await supabase.auth.getSession();
      const tk2 = sess2?.session?.access_token;
      if (!tk2) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tk2}`,
          },
          body: JSON.stringify({
            action: "interpret",
            studies: {
              pooledDisplay: results.meta.pooledDisplay,
              pooledCILower: results.meta.pooledCILower,
              pooledCIUpper: results.meta.pooledCIUpper,
              I2: results.meta.heterogeneity.I2,
              Q: results.meta.heterogeneity.Q,
              pQ: results.meta.heterogeneity.pQ,
              tau2: results.meta.heterogeneity.tau2,
            },
            effectType: results.effectType,
            language: locale,
          }),
        }
      );
      if (!resp.ok || !resp.body) throw new Error("Interpretation failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) { text += c; setInterpretation(text); }
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInterpreting(false);
    }
  }, [results, locale]);

  const exportPDF = useCallback(() => {
    if (!results) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const isRatio = effectType === "odds_ratio" || effectType === "risk_ratio";
    const effectLabel = effectType === "cohens_d" ? "Cohen's d" : effectType === "odds_ratio" ? "OR" : "RR";

    doc.setFontSize(16);
    doc.text(pt ? "Relatório de Meta-análise" : "Meta-Analysis Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Effect type: ${effectLabel} | Studies: ${results.studies.length}`, 14, 28);

    // Results table
    const headers = ["Study", effectLabel, "95% CI Lower", "95% CI Upper", "SE"];
    const rows = results.studies.map((s: any) => [
      s.name,
      isRatio ? (s.or || s.rr || Math.exp(s.effect)).toFixed(3) : s.effect.toFixed(3),
      isRatio ? s.ci_lower.toFixed(3) : s.ci_lower.toFixed(3),
      isRatio ? s.ci_upper.toFixed(3) : s.ci_upper.toFixed(3),
      s.se.toFixed(3),
    ]);
    rows.push([
      "Pooled (Random)",
      results.meta.pooledDisplay.toFixed(3),
      results.meta.pooledCILower.toFixed(3),
      results.meta.pooledCIUpper.toFixed(3),
      results.meta.random.se.toFixed(3),
    ]);

    autoTable(doc, {
      startY: 34,
      head: [headers],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;

    // Heterogeneity
    doc.setFontSize(12);
    doc.text(pt ? "Heterogeneidade" : "Heterogeneity", 14, finalY + 12);
    doc.setFontSize(10);
    const het = results.meta.heterogeneity;
    doc.text(`I² = ${het.I2.toFixed(1)}% | Q = ${het.Q.toFixed(2)} (p = ${het.pQ.toFixed(4)}) | τ² = ${het.tau2.toFixed(4)}`, 14, finalY + 20);

    if (interpretation) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text(pt ? "Interpretação" : "Interpretation", 14, 20);
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(interpretation, 260);
      doc.text(lines, 14, 28);
    }

    doc.save("meta-analysis-report.pdf");
    toast.success(pt ? "PDF exportado!" : "PDF exported!");
  }, [results, interpretation, effectType, pt]);

  const isContinuous = effectType === "cohens_d";

  return (
    <UpgradeGate feature="meta_analysis">
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/40 bg-background px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {pt ? "Meta-análise" : "Meta-Analysis"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {pt ? "Calcule effect sizes, forest plots e análise de heterogeneidade" : "Calculate effect sizes, forest plots, and heterogeneity analysis"}
              </p>
            </div>
            <div className="flex gap-2">
              {results && (
                <>
                  <Button size="sm" variant="outline" onClick={interpret} disabled={interpreting} className="gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {interpreting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (pt ? "Interpretar com IA" : "AI Interpretation")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportPDF} className="gap-1">
                    <Download className="h-3.5 w-3.5" />
                    {pt ? "Exportar PDF" : "Export PDF"}
                  </Button>
                  <RegisterOutputButton
                    defaultTitle={pt ? `Meta-análise (${effectType})` : `Meta-analysis (${effectType})`}
                    outputType="analysis"
                    description={pt ? "Resultado de meta-análise gerado na plataforma." : "Meta-analysis result generated on the platform."}
                    linkType="meta_analysis"
                    metrics={results}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border/40 px-6">
            <TabsList className="h-10">
              <TabsTrigger value="input" className="text-xs gap-1">
                <Calculator className="h-3.5 w-3.5" />
                {pt ? "Dados" : "Data Input"}
              </TabsTrigger>
              <TabsTrigger value="results" className="text-xs gap-1" disabled={!results}>
                <TrendingUp className="h-3.5 w-3.5" />
                {pt ? "Resultados" : "Results"}
              </TabsTrigger>
              <TabsTrigger value="plots" className="text-xs gap-1" disabled={!results}>
                <BarChart3 className="h-3.5 w-3.5" />
                {pt ? "Gráficos" : "Plots"}
              </TabsTrigger>
              <TabsTrigger value="report" className="text-xs gap-1" disabled={!interpretation}>
                <FileText className="h-3.5 w-3.5" />
                {pt ? "Relatório" : "Report"}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* DATA INPUT TAB */}
          <TabsContent value="input" className="flex-1 overflow-auto px-6 py-4">
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Effect type selector */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{pt ? "Tipo de Effect Size" : "Effect Size Type"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={effectType} onValueChange={setEffectType}>
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cohens_d">Cohen's d ({pt ? "dados contínuos" : "continuous data"})</SelectItem>
                      <SelectItem value="odds_ratio">Odds Ratio ({pt ? "dados dicotômicos" : "dichotomous data"})</SelectItem>
                      <SelectItem value="risk_ratio">Risk Ratio ({pt ? "dados dicotômicos" : "dichotomous data"})</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Studies table */}
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">{pt ? "Estudos" : "Studies"} ({studies.length})</CardTitle>
                  <Button size="sm" variant="outline" onClick={addStudy} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    {pt ? "Adicionar" : "Add Study"}
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[50vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-40">{pt ? "Estudo" : "Study"}</TableHead>
                          {isContinuous ? (
                            <>
                              <TableHead className="text-center text-xs" colSpan={3}>
                                {pt ? "Grupo Experimental" : "Experimental Group"}
                              </TableHead>
                              <TableHead className="text-center text-xs" colSpan={3}>
                                {pt ? "Grupo Controle" : "Control Group"}
                              </TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="text-center text-xs" colSpan={2}>
                                {pt ? "Experimental" : "Experimental"}
                              </TableHead>
                              <TableHead className="text-center text-xs" colSpan={2}>
                                {pt ? "Controle" : "Control"}
                              </TableHead>
                            </>
                          )}
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                        <TableRow>
                          <TableHead></TableHead>
                          {isContinuous ? (
                            <>
                              <TableHead className="text-xs">Mean</TableHead>
                              <TableHead className="text-xs">SD</TableHead>
                              <TableHead className="text-xs">N</TableHead>
                              <TableHead className="text-xs">Mean</TableHead>
                              <TableHead className="text-xs">SD</TableHead>
                              <TableHead className="text-xs">N</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="text-xs">{pt ? "Eventos" : "Events"}</TableHead>
                              <TableHead className="text-xs">N</TableHead>
                              <TableHead className="text-xs">{pt ? "Eventos" : "Events"}</TableHead>
                              <TableHead className="text-xs">N</TableHead>
                            </>
                          )}
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studies.map((study) => (
                          <TableRow key={study.id}>
                            <TableCell>
                              <Input
                                value={study.name}
                                onChange={e => updateStudy(study.id, "name", e.target.value)}
                                placeholder={pt ? "Nome do estudo" : "Study name"}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            {isContinuous ? (
                              <>
                                <TableCell><Input type="number" value={study.mean1 || ""} onChange={e => updateStudy(study.id, "mean1", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.sd1 || ""} onChange={e => updateStudy(study.id, "sd1", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.n1 || ""} onChange={e => updateStudy(study.id, "n1", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.mean2 || ""} onChange={e => updateStudy(study.id, "mean2", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.sd2 || ""} onChange={e => updateStudy(study.id, "sd2", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.n2 || ""} onChange={e => updateStudy(study.id, "n2", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell><Input type="number" value={study.events1 || ""} onChange={e => updateStudy(study.id, "events1", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.n1 || ""} onChange={e => updateStudy(study.id, "n1", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.events2 || ""} onChange={e => updateStudy(study.id, "events2", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                                <TableCell><Input type="number" value={study.n2 || ""} onChange={e => updateStudy(study.id, "n2", e.target.value)} className="h-8 text-xs w-20" placeholder="0" /></TableCell>
                              </>
                            )}
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => removeStudy(study.id)} className="h-7 w-7" disabled={studies.length <= 2}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  <div className="mt-4 flex justify-end">
                    <Button onClick={calculate} disabled={calculating} className="gap-2">
                      {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                      {pt ? "Calcular Meta-análise" : "Calculate Meta-Analysis"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="flex-1 overflow-auto px-6 py-4">
            {results && (
              <div className="max-w-5xl mx-auto space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">{pt ? "Efeito Combinado" : "Pooled Effect"}</p>
                      <p className="text-2xl font-bold text-primary">{results.meta.pooledDisplay.toFixed(3)}</p>
                      <p className="text-xs text-muted-foreground">
                        95% CI: [{results.meta.pooledCILower.toFixed(3)}, {results.meta.pooledCIUpper.toFixed(3)}]
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">I²</p>
                      <p className="text-2xl font-bold">
                        <span className={results.meta.heterogeneity.I2 > 75 ? "text-destructive" : results.meta.heterogeneity.I2 > 50 ? "text-yellow-600" : "text-green-600"}>
                          {results.meta.heterogeneity.I2.toFixed(1)}%
                        </span>
                      </p>
                      <Badge variant={results.meta.heterogeneity.I2 > 75 ? "destructive" : results.meta.heterogeneity.I2 > 50 ? "secondary" : "default"} className="text-xs mt-1">
                        {results.meta.heterogeneity.I2 > 75 ? (pt ? "Alta" : "High") : results.meta.heterogeneity.I2 > 50 ? (pt ? "Moderada" : "Moderate") : (pt ? "Baixa" : "Low")}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Q-test</p>
                      <p className="text-lg font-bold text-foreground">Q = {results.meta.heterogeneity.Q.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">p = {results.meta.heterogeneity.pQ.toFixed(4)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">τ² (tau²)</p>
                      <p className="text-lg font-bold text-foreground">{results.meta.heterogeneity.tau2.toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">{pt ? "Variância entre estudos" : "Between-study variance"}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Individual study results */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{pt ? "Resultados por Estudo" : "Individual Study Results"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{pt ? "Estudo" : "Study"}</TableHead>
                          <TableHead className="text-right">
                            {effectType === "cohens_d" ? "Cohen's d" : effectType === "odds_ratio" ? "OR" : "RR"}
                          </TableHead>
                          <TableHead className="text-right">SE</TableHead>
                          <TableHead className="text-right">95% CI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.studies.map((s: any, i: number) => {
                          const isRatio = effectType !== "cohens_d";
                          const display = isRatio ? (s.or || s.rr || Math.exp(s.effect)).toFixed(3) : s.effect.toFixed(3);
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{s.name}</TableCell>
                              <TableCell className="text-right text-sm">{display}</TableCell>
                              <TableCell className="text-right text-sm">{s.se.toFixed(3)}</TableCell>
                              <TableCell className="text-right text-sm">
                                [{s.ci_lower.toFixed(3)}, {s.ci_upper.toFixed(3)}]
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-primary/5 font-bold">
                          <TableCell className="text-primary">Pooled (Random Effects)</TableCell>
                          <TableCell className="text-right text-primary">{results.meta.pooledDisplay.toFixed(3)}</TableCell>
                          <TableCell className="text-right text-primary">{results.meta.random.se.toFixed(3)}</TableCell>
                          <TableCell className="text-right text-primary">
                            [{results.meta.pooledCILower.toFixed(3)}, {results.meta.pooledCIUpper.toFixed(3)}]
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* PLOTS TAB */}
          <TabsContent value="plots" className="flex-1 overflow-auto px-6 py-4">
            {results && (
              <div className="max-w-5xl mx-auto space-y-6">
                <Card>
                  <CardContent className="pt-6">
                    <ForestPlot
                      studies={results.studies}
                      pooled={results.meta.random}
                      effectType={results.effectType}
                      pooledDisplay={results.meta.pooledDisplay}
                      pooledCILower={results.meta.pooledCILower}
                      pooledCIUpper={results.meta.pooledCIUpper}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <FunnelPlot
                      studies={results.studies}
                      pooledEffect={results.meta.random.pooled}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* REPORT TAB */}
          <TabsContent value="report" className="flex-1 overflow-auto px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {pt ? "Interpretação da IA" : "AI Interpretation"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {interpretation ? (
                    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                      {interpretation}
                    </div>
                  ) : interpreting ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {pt ? "Gerando interpretação..." : "Generating interpretation..."}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {pt ? "Clique em 'Interpretar com IA' para gerar uma análise detalhada." : "Click 'AI Interpretation' to generate a detailed analysis."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </UpgradeGate>
  );
};

export default MetaAnalysis;
