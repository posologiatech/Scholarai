import { useState, useCallback, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { CAPES_AGREEMENTS, CAPES_GENERAL_LINKS, CAPES_REQUIREMENTS, type CAPESAgreement } from "@/lib/capes-agreements";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  GraduationCap, Loader2, ExternalLink, ArrowLeft, ArrowRight,
  CheckCircle2, AlertCircle, BookOpen, FileText, Link2, Sparkles,
  BarChart3, Eye, Check, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

/* ─── Types ─── */
interface Suggestion {
  publisherId: string;
  publisherName: string;
  matchScore: "high" | "medium" | "low";
  reasoning: string;
  suggestedJournals?: string[];
  considerations?: string;
}

interface ChecklistItem {
  id: string;
  label: { pt: string; en: string };
  checked: boolean;
}

interface Props {
  editorContent: string;
  onFormatArticle: (publisher: string) => void;
  onClose: () => void;
  /** When the panel formats the article, it can show a preview first */
  onInsertFormatted?: (text: string) => void;
}

/* ─── Session storage helpers ─── */
const STORAGE_KEY = "capes-advisor-state";

interface PersistedState {
  step: 1 | 2 | 3;
  suggestions: Suggestion[];
  articleSummary: string;
  selectedPublisherId: string | null;
  guidelines: string;
  checklist: ChecklistItem[];
  compareIds: string[];
}

const loadPersisted = (): Partial<PersistedState> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const savePersisted = (state: Partial<PersistedState>) => {
  try {
    const prev = loadPersisted();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...state }));
  } catch {}
};

/* ─── Default checklist items ─── */
const defaultChecklist = (): ChecklistItem[] => [
  { id: "orcid", label: { pt: "ORCID cadastrado na CAPES", en: "ORCID registered with CAPES" }, checked: false },
  { id: "affiliation", label: { pt: "Afiliação institucional verificada", en: "Institutional affiliation verified" }, checked: false },
  { id: "cover_letter", label: { pt: "Carta de apresentação preparada", en: "Cover letter prepared" }, checked: false },
  { id: "formatted", label: { pt: "Artigo formatado para o periódico", en: "Article formatted for journal" }, checked: false },
  { id: "coauthors", label: { pt: "Co-autores notificados e com ORCID", en: "Co-authors notified and with ORCID" }, checked: false },
  { id: "data_availability", label: { pt: "Dados de pesquisa disponibilizados", en: "Research data made available" }, checked: false },
  { id: "supplementary", label: { pt: "Material suplementar anexado", en: "Supplementary material attached" }, checked: false },
];

/* ─── Component ─── */
const CAPESAdvisorPanel = ({ editorContent, onFormatArticle, onClose, onInsertFormatted }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  // Restore from session storage
  const persisted = loadPersisted();

  const [step, setStep] = useState<1 | 2 | 3>((persisted.step as 1 | 2 | 3) || 1);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(persisted.suggestions || []);
  const [articleSummary, setArticleSummary] = useState(persisted.articleSummary || "");
  const [selectedPublisher, setSelectedPublisher] = useState<CAPESAgreement | null>(
    persisted.selectedPublisherId ? CAPES_AGREEMENTS.find(a => a.id === persisted.selectedPublisherId) || null : null
  );
  const [guidelines, setGuidelines] = useState(persisted.guidelines || "");
  const [streamingGuidelines, setStreamingGuidelines] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(persisted.checklist || defaultChecklist());

  // Comparison mode
  const [compareIds, setCompareIds] = useState<string[]>(persisted.compareIds || []);
  const [compareMode, setCompareMode] = useState(false);

  // Format preview
  const [formattedPreview, setFormattedPreview] = useState("");
  const [loadingFormat, setLoadingFormat] = useState(false);

  // Persist state changes
  useEffect(() => {
    savePersisted({
      step, suggestions, articleSummary,
      selectedPublisherId: selectedPublisher?.id || null,
      guidelines, checklist, compareIds,
    });
  }, [step, suggestions, articleSummary, selectedPublisher, guidelines, checklist, compareIds]);

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

  const handleChecklistToggle = (id: string) => {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  };

  const handleFormatPreview = useCallback(async () => {
    if (!selectedPublisher) return;
    setLoadingFormat(true);
    setFormattedPreview("");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/writing-assist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({
            action: "format_for_journal",
            content: `Format this article according to ${selectedPublisher.publisher} submission guidelines. Publisher: ${selectedPublisher.publisher}`,
            papers: [],
            section: "full",
            citationStyle: "APA",
            datamindAnalyses: [],
            uploadedPDFs: [],
            language: locale,
          }),
        }
      );
      if (!resp.ok || !resp.body) throw new Error("Format failed");

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
              setFormattedPreview(result);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error");
    } finally {
      setLoadingFormat(false);
    }
  }, [selectedPublisher, locale]);

  const toggleCompare = (publisherId: string) => {
    setCompareIds(prev =>
      prev.includes(publisherId)
        ? prev.filter(id => id !== publisherId)
        : prev.length >= 3 ? prev : [...prev, publisherId]
    );
  };

  const handleReset = () => {
    setStep(1);
    setSuggestions([]);
    setArticleSummary("");
    setSelectedPublisher(null);
    setGuidelines("");
    setChecklist(defaultChecklist());
    setCompareMode(false);
    setCompareIds([]);
    setFormattedPreview("");
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const scoreColor = (score: string) => {
    if (score === "high") return "bg-green-500/10 text-green-700 border-green-500/30";
    if (score === "medium") return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    return "bg-muted text-muted-foreground";
  };

  const scoreLabel = (score: string) => {
    if (pt) {
      if (score === "high") return "Alta";
      if (score === "medium") return "Média";
      return "Baixa";
    }
    if (score === "high") return "High";
    if (score === "medium") return "Medium";
    return "Low";
  };

  const completedChecks = checklist.filter(c => c.checked).length;
  const wordCount = editorContent.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border/40 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">CAPES APC Advisor</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={handleReset}>
            {pt ? "Limpar" : "Reset"}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-4 py-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: pt ? "Análise" : "Analysis" },
            { n: 2, label: pt ? "Diretrizes" : "Guidelines" },
            { n: 3, label: pt ? "Checklist" : "Checklist" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5">
              {i > 0 && <div className={`w-6 h-px ${step >= s.n ? "bg-primary" : "bg-border"}`} />}
              <button
                onClick={() => {
                  if (s.n === 1) setStep(1);
                  else if (s.n === 2 && selectedPublisher) setStep(2);
                  else if (s.n === 3 && selectedPublisher && guidelines) setStep(3);
                }}
                className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                  step === s.n
                    ? "text-primary"
                    : step > s.n
                      ? "text-primary/60"
                      : "text-muted-foreground"
                }`}
              >
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                  step === s.n
                    ? "bg-primary text-primary-foreground border-primary"
                    : step > s.n
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-muted text-muted-foreground border-border"
                }`}>
                  {step > s.n ? <Check className="h-3 w-3" /> : s.n}
                </span>
                {s.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">

          {/* ─── Step 1: Analysis & Suggestions ─── */}
          {step === 1 && (
            <>
              {/* CAPES info banner */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="text-[11px] space-y-1.5">
                      <p className="font-medium text-foreground">
                        {pt ? "Requisitos CAPES" : "CAPES Requirements"}
                      </p>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {CAPES_REQUIREMENTS.slice(0, 3).map((req, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5 text-primary mt-0.5 shrink-0" />
                            {req}
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <a href={CAPES_GENERAL_LINKS.portaria120} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-primary/10 gap-0.5">
                            <ExternalLink className="h-2 w-2" /> Portaria 120/2024
                          </Badge>
                        </a>
                        <a href={CAPES_GENERAL_LINKS.orcidCadastro} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-primary/10 gap-0.5">
                            <ExternalLink className="h-2 w-2" /> ORCID
                          </Badge>
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Word count hint */}
              {wordCount > 0 && wordCount < 200 && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {pt
                    ? `${wordCount} palavras — recomendamos pelo menos 200 para melhor análise`
                    : `${wordCount} words — we recommend at least 200 for better analysis`}
                </p>
              )}

              {/* Analyze button */}
              {suggestions.length === 0 && (
                <div className="text-center py-4">
                  <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground mb-3">
                    {pt
                      ? "Analise seu artigo para receber sugestões de editoras com acordo CAPES."
                      : "Analyze your article to get publisher suggestions with CAPES agreements."}
                  </p>
                  <Button onClick={analyzeSuggestions} disabled={loading} className="gap-2" size="sm">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {loading
                      ? (pt ? "Analisando..." : "Analyzing...")
                      : (pt ? "Analisar Artigo" : "Analyze Article")}
                  </Button>
                </div>
              )}

              {/* Suggestions list */}
              {suggestions.length > 0 && (
                <>
                  {articleSummary && (
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                          {pt ? "Resumo" : "Summary"}
                        </p>
                        <p className="text-xs text-foreground">{articleSummary}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Compare toggle */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">
                      {suggestions.length} {pt ? "editora(s)" : "publisher(s)"}
                    </p>
                    <Button
                      variant={compareMode ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => { setCompareMode(!compareMode); if (compareMode) setCompareIds([]); }}
                    >
                      <BarChart3 className="h-3 w-3" />
                      {pt ? "Comparar" : "Compare"}
                    </Button>
                  </div>

                  {/* Comparison view */}
                  {compareMode && compareIds.length >= 2 && (
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-max">
                        {compareIds.map(id => {
                          const agreement = CAPES_AGREEMENTS.find(a => a.id === id);
                          const suggestion = suggestions.find(s => s.publisherId === id);
                          if (!agreement || !suggestion) return null;
                          return (
                            <Card key={id} className="w-48 shrink-0">
                              <CardContent className="p-3 space-y-2">
                                <p className="text-xs font-semibold text-foreground">{agreement.publisher}</p>
                                <Badge className={`text-[9px] ${scoreColor(suggestion.matchScore)}`}>
                                  {scoreLabel(suggestion.matchScore)}
                                </Badge>
                                <div className="text-[10px] text-muted-foreground space-y-1">
                                  <p><BookOpen className="h-2.5 w-2.5 inline mr-0.5" />{agreement.journalCount}</p>
                                  <p>{agreement.eligibleInstitutions} {pt ? "instituições" : "institutions"}</p>
                                  <div className="flex flex-wrap gap-0.5">
                                    {agreement.scopeAreas.slice(0, 3).map((a, i) => (
                                      <Badge key={i} variant="outline" className="text-[8px] px-1">{a}</Badge>
                                    ))}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full h-6 text-[10px]"
                                  onClick={() => { setCompareMode(false); loadGuidelines(agreement); }}
                                >
                                  {pt ? "Selecionar" : "Select"}
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggestion cards */}
                  {suggestions.map((s, i) => {
                    const agreement = CAPES_AGREEMENTS.find(a => a.id === s.publisherId);
                    return (
                      <Card
                        key={i}
                        className={`transition-colors cursor-pointer ${
                          compareMode && compareIds.includes(s.publisherId)
                            ? "border-primary/50 bg-primary/5"
                            : "hover:border-primary/30"
                        }`}
                        onClick={() => {
                          if (compareMode) {
                            toggleCompare(s.publisherId);
                          } else if (agreement) {
                            loadGuidelines(agreement);
                          }
                        }}
                      >
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground">{s.publisherName}</p>
                            <Badge className={`text-[9px] shrink-0 ${scoreColor(s.matchScore)}`}>
                              {scoreLabel(s.matchScore)}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{s.reasoning}</p>
                          {s.suggestedJournals && s.suggestedJournals.length > 0 && (
                            <div className="flex flex-wrap gap-0.5">
                              {s.suggestedJournals.slice(0, 4).map((j, ji) => (
                                <Badge key={ji} variant="secondary" className="text-[9px]">{j}</Badge>
                              ))}
                            </div>
                          )}
                          {agreement && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <BookOpen className="h-2.5 w-2.5" />
                              {agreement.journalCount} · {agreement.eligibleInstitutions} {pt ? "inst." : "inst."}
                            </div>
                          )}
                          {!compareMode && (
                            <p className="text-[10px] text-primary flex items-center gap-0.5">
                              <ArrowRight className="h-2.5 w-2.5" />
                              {pt ? "Ver diretrizes" : "View guidelines"}
                            </p>
                          )}
                          {compareMode && (
                            <p className="text-[10px] text-primary flex items-center gap-0.5">
                              {compareIds.includes(s.publisherId) ? <Check className="h-2.5 w-2.5" /> : <BarChart3 className="h-2.5 w-2.5" />}
                              {compareIds.includes(s.publisherId)
                                ? (pt ? "Selecionada" : "Selected")
                                : (pt ? "Adicionar à comparação" : "Add to compare")}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  <Button variant="outline" size="sm" onClick={analyzeSuggestions} disabled={loading} className="w-full gap-1 text-[10px]">
                    <Sparkles className="h-3 w-3" />
                    {pt ? "Reanalisar" : "Re-analyze"}
                  </Button>
                </>
              )}
            </>
          )}

          {/* ─── Step 2: Submission Guidelines ─── */}
          {step === 2 && selectedPublisher && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1 text-[10px] -ml-2 h-6">
                <ArrowLeft className="h-3 w-3" />
                {pt ? "Voltar" : "Back"}
              </Button>

              <Card className="border-primary/20">
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{selectedPublisher.publisher}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPublisher.description}</p>
                  <div className="flex flex-wrap gap-0.5">
                    {selectedPublisher.scopeAreas.map((area, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">{area}</Badge>
                    ))}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-[10px] font-medium mb-1 flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      {pt ? "Links" : "Links"}
                    </p>
                    <div className="space-y-0.5">
                      {selectedPublisher.links.map((link, i) => (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[10px] text-primary hover:underline">
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {selectedPublisher.highlights.map((h, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] gap-0.5">
                        <CheckCircle2 className="h-2 w-2" />{h}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI guidelines */}
              <Card>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {pt ? "Diretrizes (IA)" : "Guidelines (AI)"}
                    {streamingGuidelines && <Loader2 className="h-3 w-3 animate-spin" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {guidelines ? (
                    <div className="prose prose-sm max-w-none text-foreground text-xs">
                      <ReactMarkdown>{guidelines}</ReactMarkdown>
                    </div>
                  ) : streamingGuidelines ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {pt ? "Carregando..." : "Loading..."}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Actions */}
              {!streamingGuidelines && guidelines && (
                <div className="space-y-2">
                  <Button
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => setStep(3)}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {pt ? "Ir para Checklist de Submissão" : "Go to Submission Checklist"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-xs"
                    onClick={handleFormatPreview}
                    disabled={loadingFormat}
                  >
                    {loadingFormat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                    {pt ? "Pré-visualizar formatação" : "Preview formatting"}
                  </Button>
                </div>
              )}

              {/* Format Preview */}
              {formattedPreview && (
                <Card className="border-primary/20">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      {pt ? "Preview da Formatação" : "Format Preview"}
                      {loadingFormat && <Loader2 className="h-3 w-3 animate-spin" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    <div className="bg-muted/30 rounded p-3 text-xs leading-relaxed whitespace-pre-wrap font-serif max-h-60 overflow-y-auto">
                      {formattedPreview}
                    </div>
                    {!loadingFormat && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1 text-xs"
                          onClick={() => {
                            if (onInsertFormatted) {
                              onInsertFormatted(formattedPreview);
                            } else {
                              onFormatArticle(selectedPublisher.publisher);
                            }
                            toast.success(pt ? "Formatação aplicada" : "Formatting applied");
                          }}
                        >
                          <Check className="h-3 w-3" />
                          {pt ? "Aprovar e Inserir" : "Approve & Insert"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => setFormattedPreview("")}
                        >
                          <X className="h-3 w-3" />
                          {pt ? "Descartar" : "Discard"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ─── Step 3: Submission Checklist ─── */}
          {step === 3 && selectedPublisher && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-1 text-[10px] -ml-2 h-6">
                <ArrowLeft className="h-3 w-3" />
                {pt ? "Voltar às diretrizes" : "Back to guidelines"}
              </Button>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      {pt ? "Checklist de Submissão" : "Submission Checklist"}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      {completedChecks}/{checklist.length}
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                    <div
                      className="bg-primary rounded-full h-1.5 transition-all"
                      style={{ width: `${(completedChecks / checklist.length) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {checklist.map(item => (
                      <label
                        key={item.id}
                        className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                          item.checked ? "bg-primary/10" : "hover:bg-muted"
                        }`}
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => handleChecklistToggle(item.id)}
                          className="mt-0.5"
                        />
                        <span className={`text-xs ${item.checked ? "text-primary line-through" : "text-foreground"}`}>
                          {item.label[pt ? "pt" : "en"]}
                        </span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Publisher summary */}
              <Card>
                <CardContent className="p-3">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    {pt ? "Editora selecionada" : "Selected publisher"}
                  </p>
                  <p className="text-xs font-semibold text-foreground">{selectedPublisher.publisher}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedPublisher.links.slice(0, 2).map((link, i) => (
                      <a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-primary/10 gap-0.5">
                          <ExternalLink className="h-2 w-2" />{link.label}
                        </Badge>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Format article action */}
              <Button
                className="w-full gap-1.5 text-xs"
                size="sm"
                onClick={() => {
                  onFormatArticle(selectedPublisher.publisher);
                  toast.success(pt ? "Formatando artigo..." : "Formatting article...");
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                {pt ? `Formatar para ${selectedPublisher.publisher}` : `Format for ${selectedPublisher.publisher}`}
              </Button>

              {completedChecks === checklist.length && (
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-3 text-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                    <p className="text-xs font-medium text-green-700">
                      {pt ? "Checklist completo! Pronto para submissão." : "Checklist complete! Ready for submission."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CAPESAdvisorPanel;
