import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { CAPES_AGREEMENTS, CAPES_GENERAL_LINKS, CAPES_REQUIREMENTS, type CAPESAgreement } from "@/lib/capes-agreements";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  GraduationCap, Loader2, ExternalLink, ArrowLeft, ArrowRight,
  CheckCircle2, AlertCircle, BookOpen, FileText, Link2, Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Suggestion {
  publisherId: string;
  publisherName: string;
  matchScore: "high" | "medium" | "low";
  reasoning: string;
  suggestedJournals?: string[];
  considerations?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorContent: string;
  onFormatArticle: (publisher: string) => void;
}

const CAPESAdvisorPanel = ({ open, onOpenChange, editorContent, onFormatArticle }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [articleSummary, setArticleSummary] = useState("");
  const [selectedPublisher, setSelectedPublisher] = useState<CAPESAgreement | null>(null);
  const [guidelines, setGuidelines] = useState("");
  const [streamingGuidelines, setStreamingGuidelines] = useState(false);

  const analyzeSuggestions = useCallback(async () => {
    if (!editorContent.trim()) {
      toast.error(pt ? "Escreva algo no editor primeiro" : "Write something in the editor first");
      return;
    }

    setLoading(true);
    setSuggestions([]);
    setArticleSummary("");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capes-apc-advisor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({
            action: "suggest_journals",
            articleContent: editorContent,
            articleTopic: editorContent.slice(0, 500),
            language: locale,
          }),
        }
      );

      if (!resp.ok) throw new Error("Analysis failed");
      const data = await resp.json();
      setSuggestions(data.suggestions || []);
      setArticleSummary(data.articleSummary || "");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [editorContent, locale, pt]);

  const loadGuidelines = useCallback(async (publisher: CAPESAgreement) => {
    setSelectedPublisher(publisher);
    setStep(2);
    setGuidelines("");
    setStreamingGuidelines(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capes-apc-advisor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({
            action: "get_submission_guidelines",
            publisher: publisher.publisher,
            articleContent: editorContent,
            language: locale,
          }),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("Failed to get guidelines");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";

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
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              result += content;
              setGuidelines(result);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error");
    } finally {
      setStreamingGuidelines(false);
    }
  }, [editorContent, locale]);

  const handleReset = () => {
    setStep(1);
    setSuggestions([]);
    setArticleSummary("");
    setSelectedPublisher(null);
    setGuidelines("");
  };

  const scoreColor = (score: string) => {
    if (score === "high") return "bg-green-500/10 text-green-700 border-green-500/30";
    if (score === "medium") return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    return "bg-muted text-muted-foreground";
  };

  const scoreLabel = (score: string) => {
    if (pt) {
      if (score === "high") return "Alta compatibilidade";
      if (score === "medium") return "Média compatibilidade";
      return "Baixa compatibilidade";
    }
    if (score === "high") return "High match";
    if (score === "medium") return "Medium match";
    return "Low match";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {pt ? "Consultor CAPES APC" : "CAPES APC Advisor"}
          </DialogTitle>
          <DialogDescription>
            {pt
              ? "Encontre periódicos com APC paga pela CAPES e obtenha orientações de submissão"
              : "Find journals with CAPES-paid APC and get submission guidelines"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Step 1: Analyze & Suggest */}
          {step === 1 && (
            <div className="space-y-4">
              {/* CAPES info banner */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm space-y-2">
                      <p className="font-medium text-foreground">
                        {pt ? "Requisitos obrigatórios da CAPES" : "CAPES mandatory requirements"}
                      </p>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        {CAPES_REQUIREMENTS.map((req, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            {req}
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <a href={CAPES_GENERAL_LINKS.orcidCadastro} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10 gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            {pt ? "Cadastrar ORCID" : "Register ORCID"}
                          </Badge>
                        </a>
                        <a href={CAPES_GENERAL_LINKS.portaria120} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10 gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            Portaria 120/2024
                          </Badge>
                        </a>
                        <a href={CAPES_GENERAL_LINKS.powerBiDashboard} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10 gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            {pt ? "Dashboard APCs pagos" : "Paid APCs Dashboard"}
                          </Badge>
                        </a>
                        <a href={CAPES_GENERAL_LINKS.faq} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10 gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            FAQ
                          </Badge>
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Analyze button */}
              {suggestions.length === 0 && (
                <div className="text-center py-6">
                  <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    {pt
                      ? "A IA analisará seu artigo e sugerirá as melhores editoras com acordo CAPES para submissão."
                      : "AI will analyze your article and suggest the best CAPES-agreement publishers for submission."}
                  </p>
                  <Button onClick={analyzeSuggestions} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {loading
                      ? (pt ? "Analisando artigo..." : "Analyzing article...")
                      : (pt ? "Analisar e Sugerir Periódicos" : "Analyze & Suggest Journals")}
                  </Button>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-3">
                  {articleSummary && (
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {pt ? "Resumo do artigo" : "Article summary"}
                        </p>
                        <p className="text-sm text-foreground">{articleSummary}</p>
                      </CardContent>
                    </Card>
                  )}

                  <p className="text-sm font-medium text-foreground">
                    {pt ? `${suggestions.length} editora(s) compatível(is) encontrada(s):` : `${suggestions.length} matching publisher(s) found:`}
                  </p>

                  {suggestions.map((s, i) => {
                    const agreement = CAPES_AGREEMENTS.find(a => a.id === s.publisherId);
                    return (
                      <Card key={i} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => agreement && loadGuidelines(agreement)}>
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm">{s.publisherName}</CardTitle>
                            <Badge className={`text-[10px] shrink-0 ${scoreColor(s.matchScore)}`}>
                              {scoreLabel(s.matchScore)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-2">
                          <p className="text-xs text-muted-foreground">{s.reasoning}</p>
                          {s.suggestedJournals && s.suggestedJournals.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-foreground mb-1">
                                {pt ? "Periódicos sugeridos:" : "Suggested journals:"}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {s.suggestedJournals.map((j, ji) => (
                                  <Badge key={ji} variant="secondary" className="text-[10px]">{j}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {s.considerations && (
                            <p className="text-[10px] text-muted-foreground italic">{s.considerations}</p>
                          )}
                          {agreement && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <BookOpen className="h-3 w-3" />
                              {agreement.journalCount} · {agreement.eligibleInstitutions} {pt ? "instituições" : "institutions"}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <ArrowRight className="h-3 w-3" />
                            {pt ? "Clique para ver diretrizes de submissão" : "Click for submission guidelines"}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  <Button variant="outline" size="sm" onClick={analyzeSuggestions} disabled={loading} className="w-full gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    {pt ? "Reanalisar" : "Re-analyze"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Submission Guidelines */}
          {step === 2 && selectedPublisher && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1 text-xs -ml-2">
                <ArrowLeft className="h-3 w-3" />
                {pt ? "Voltar às sugestões" : "Back to suggestions"}
              </Button>

              <Card className="border-primary/20">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{selectedPublisher.publisher}</CardTitle>
                  <p className="text-xs text-muted-foreground">{selectedPublisher.description}</p>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {selectedPublisher.scopeAreas.map((area, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{area}</Badge>
                    ))}
                  </div>

                  <Separator />

                  {/* Publisher links */}
                  <div>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      {pt ? "Links importantes" : "Important links"}
                    </p>
                    <div className="grid gap-1.5">
                      {selectedPublisher.links.map((link, i) => (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {link.label}
                        </a>
                      ))}
                      <Separator className="my-1" />
                      <a href={CAPES_GENERAL_LINKS.portaria120} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <FileText className="h-3 w-3 shrink-0" />
                        Portaria nº 120/2024 (CAPES)
                      </a>
                      <a href={CAPES_GENERAL_LINKS.orcidCadastro} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {pt ? "Cadastro ORCID - meusdados.capes.gov.br" : "ORCID Registration - meusdados.capes.gov.br"}
                      </a>
                      <a href={CAPES_GENERAL_LINKS.portalPeriodicos} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {pt ? "Portal de Periódicos CAPES" : "CAPES Journals Portal"}
                      </a>
                    </div>
                  </div>

                  <Separator />

                  {/* Highlights */}
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPublisher.highlights.map((h, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                        {h}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI-generated guidelines */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {pt ? "Diretrizes de Submissão (IA)" : "Submission Guidelines (AI)"}
                    {streamingGuidelines && <Loader2 className="h-3 w-3 animate-spin" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {guidelines ? (
                    <div className="prose prose-sm max-w-none text-foreground">
                      <ReactMarkdown>{guidelines}</ReactMarkdown>
                    </div>
                  ) : streamingGuidelines ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {pt ? "Carregando diretrizes..." : "Loading guidelines..."}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Format article button */}
              {!streamingGuidelines && guidelines && (
                <Button
                  onClick={() => {
                    onFormatArticle(selectedPublisher.publisher);
                    onOpenChange(false);
                  }}
                  className="w-full gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {pt
                    ? `Formatar artigo para ${selectedPublisher.publisher}`
                    : `Format article for ${selectedPublisher.publisher}`}
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CAPESAdvisorPanel;
