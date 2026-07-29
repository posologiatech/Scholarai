import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Edit2,
  Trash2,
  Plus,
  Bot,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ProtocolPanel from "./ProtocolPanel";
import ReviewersPanel from "./ReviewersPanel";
import DualScreeningPanel from "./DualScreeningPanel";
import ConflictsPanel from "./ConflictsPanel";
import type { Pico } from "@/lib/systematicReview/protocol";
import type { ReviewerAssignment } from "@/lib/systematicReview/dualScreening";

interface ScreeningCriterion {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface PaperScreeningResult {
  paperId: string;
  criteria: Record<string, { answer: "yes" | "no" | "maybe"; explanation: string }>;
  inclusionScore: number;
  recommendation: "include" | "exclude" | "maybe";
  overridden?: boolean;
  overriddenTo?: "include" | "exclude";
  aiPriority?: number;
  aiPrediction?: string;
  aiReasoning?: string;
}

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
}

interface StepScreeningProps {
  question: string;
  papers: Paper[];
  criteria: ScreeningCriterion[];
  onCriteriaChange: (c: ScreeningCriterion[]) => void;
  screeningResults: Record<string, PaperScreeningResult>;
  onScreeningResultsChange: (r: Record<string, PaperScreeningResult>) => void;
  includedPaperIds: string[];
  onIncludedPaperIdsChange: (ids: string[]) => void;
  autoSuggestions: boolean;
  onNext: () => void;
  onPrev: () => void;
  pico: Pico;
  searchStrategy?: string;
  prosperoId: string;
  onProsperoIdChange: (id: string) => void;
  protocolLockedAt: string | null;
  protocolDocument: string | null;
  onRegisterProtocol: () => Promise<void>;
  reviewId: string | null;
  researchProjectId: string | null;
  isOwner: boolean;
  reviewOwnerId: string | null;
}

const StepScreening = ({
  question,
  papers,
  criteria,
  onCriteriaChange,
  screeningResults,
  onScreeningResultsChange,
  includedPaperIds,
  onIncludedPaperIdsChange,
  autoSuggestions,
  onNext,
  onPrev,
  pico,
  searchStrategy,
  prosperoId,
  onProsperoIdChange,
  protocolLockedAt,
  protocolDocument,
  onRegisterProtocol,
  reviewId,
  researchProjectId,
  isOwner,
  reviewOwnerId,
}: StepScreeningProps) => {
  const locked = !!protocolLockedAt;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const { data: reviewers = [] } = useQuery({
    queryKey: ["review-reviewers", reviewId],
    enabled: !!reviewId,
    queryFn: async () => {
      const { data, error } = await supabase.from("systematic_review_reviewers").select("*").eq("review_id", reviewId!);
      if (error) throw error;
      return (data ?? []) as ReviewerAssignment[];
    },
  });
  const dualMode = reviewers.filter((r) => r.role === "reviewer").length >= 2;
  const isAdjudicator = reviewers.some((r) => r.role === "adjudicator" && r.user_id === currentUserId);
  const canSeeConflicts = isOwner || isAdjudicator;
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [generatingCriteria, setGeneratingCriteria] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screeningAll, setScreeningAll] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);
  const [newCriterionName, setNewCriterionName] = useState("");
  const [newCriterionDesc, setNewCriterionDesc] = useState("");
  const [activeLearning, setActiveLearning] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "conflicts" | "ai_priority">("all");

  useEffect(() => {
    if (autoSuggestions && criteria.length === 0 && !generatingCriteria) {
      generateCriteria();
    }
  }, []);

  const generateCriteria = async () => {
    setGeneratingCriteria(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-screening-criteria", {
        body: { question },
      });
      if (error) throw error;
      const generated: ScreeningCriterion[] = (data?.criteria || []).map((c: any, i: number) => ({
        id: c.id || `criterion-${i}`,
        name: c.name,
        description: c.description,
        enabled: true,
      }));
      onCriteriaChange(generated);
      toast.success(pt ? "Critérios gerados com sucesso!" : "Criteria generated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate criteria");
    } finally {
      setGeneratingCriteria(false);
    }
  };

  const screenSample = async () => {
    const enabledCriteria = criteria.filter((c) => c.enabled);
    if (enabledCriteria.length === 0) {
      toast.error(pt ? "Ative pelo menos um critério" : "Enable at least one criterion");
      return;
    }
    setScreening(true);
    try {
      const unscreened = papers.filter((p) => !screeningResults[p.id]).slice(0, 20);
      if (unscreened.length === 0) {
        toast.info(pt ? "Todos os artigos já foram triados" : "All papers already screened");
        setScreening(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("screen-papers", {
        body: {
          question,
          papers: unscreened.map((p) => ({ id: p.id, title: p.title, abstract: p.abstract })),
          criteria: enabledCriteria.map((c) => ({ id: c.id, name: c.name, description: c.description })),
        },
      });
      if (error) throw error;
      const newResults = { ...screeningResults };
      for (const result of data?.results || []) {
        if (result.paperId) newResults[result.paperId] = result;
      }
      onScreeningResultsChange(newResults);
      updateIncluded(newResults);
      const screenedNow = (data?.results || []).filter((r: any) => r.paperId).length;
      toast.success(pt ? `${screenedNow} artigos triados` : `${screenedNow} papers screened`);
    } catch (err: any) {
      console.error("Screening error:", err);
      toast.error(err.message || "Screening failed");
    } finally {
      setScreening(false);
    }
  };

  const screenAllRemaining = async () => {
    setScreeningAll(true);
    const enabledCriteria = criteria.filter((c) => c.enabled);
    try {
      const unscreened = papers.filter((p) => !screeningResults[p.id]);
      if (unscreened.length === 0) {
        toast.info(pt ? "Todos triados" : "All screened");
        setScreeningAll(false);
        return;
      }
      const newResults = { ...screeningResults };
      for (let i = 0; i < unscreened.length; i += 20) {
        const batch = unscreened.slice(i, i + 20);
        const { data, error } = await supabase.functions.invoke("screen-papers", {
          body: {
            question,
            papers: batch.map((p) => ({ id: p.id, title: p.title, abstract: p.abstract })),
            criteria: enabledCriteria.map((c) => ({ id: c.id, name: c.name, description: c.description })),
          },
        });
        if (error) throw error;
        for (const result of data?.results || []) {
          newResults[result.paperId] = result;
        }
        onScreeningResultsChange({ ...newResults });
      }
      updateIncluded(newResults);
      toast.success(pt ? "Triagem completa!" : "Screening complete!");
    } catch (err: any) {
      toast.error(err.message || "Screening failed");
    } finally {
      setScreeningAll(false);
    }
  };

  // Active Learning: re-rank remaining papers
  const runActiveLearning = async () => {
    setActiveLearning(true);
    try {
      const manualDecisions = Object.entries(screeningResults)
        .filter(([_, r]) => r.overridden)
        .map(([id, r]) => {
          const paper = papers.find((p) => p.id === id);
          return {
            id,
            title: paper?.title || "",
            abstract: paper?.abstract || "",
            decision: r.overriddenTo || r.recommendation,
          };
        });

      // Also include non-overridden decisions
      const allDecisions = Object.entries(screeningResults).map(([id, r]) => {
        const paper = papers.find((p) => p.id === id);
        return {
          id,
          title: paper?.title || "",
          abstract: paper?.abstract || "",
          decision: r.overridden ? r.overriddenTo : r.recommendation,
        };
      });

      const remaining = papers
        .filter((p) => !screeningResults[p.id])
        .map((p) => ({ id: p.id, title: p.title, abstract: p.abstract || "" }));

      if (remaining.length === 0) {
        toast.info(pt ? "Nenhum artigo restante para priorizar" : "No remaining papers to prioritize");
        setActiveLearning(false);
        return;
      }

      if (allDecisions.length < 10) {
        toast.error(pt
          ? `Trie pelo menos 10 artigos antes de usar Active Learning (${allDecisions.length}/10)`
          : `Screen at least 10 papers before using Active Learning (${allDecisions.length}/10)`);
        setActiveLearning(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("active-learning-screen", {
        body: {
          question,
          criteria: criteria.filter((c) => c.enabled),
          manualDecisions: allDecisions,
          remainingPapers: remaining,
        },
      });
      if (error) throw error;

      // Update remaining papers with AI priority
      const newResults = { ...screeningResults };
      for (const result of data?.results || []) {
        if (result.paperId) {
          newResults[result.paperId] = {
            paperId: result.paperId,
            criteria: {},
            inclusionScore: result.priorityScore || 0.5,
            recommendation: result.prediction || "maybe",
            aiPriority: result.priorityScore,
            aiPrediction: result.prediction,
            aiReasoning: result.reasoning,
          };
        }
      }
      onScreeningResultsChange(newResults);
      updateIncluded(newResults);

      setViewMode("ai_priority");
      toast.success(pt
        ? `${data?.results?.length || 0} artigos re-ranqueados por prioridade AI`
        : `${data?.results?.length || 0} papers re-ranked by AI priority`);
    } catch (err: any) {
      console.error("Active learning error:", err);
      toast.error(err.message || "Active learning failed");
    } finally {
      setActiveLearning(false);
    }
  };

  const updateIncluded = (results: Record<string, PaperScreeningResult>) => {
    const included = Object.entries(results)
      .filter(([_, r]) => (r.overridden ? r.overriddenTo === "include" : r.recommendation === "include" || r.recommendation === "maybe"))
      .map(([id]) => id);
    onIncludedPaperIdsChange(included);
  };

  const toggleOverride = (paperId: string) => {
    const result = screeningResults[paperId];
    if (!result) return;
    const newResults = { ...screeningResults };
    if (result.overridden) {
      newResults[paperId] = { ...result, overridden: false, overriddenTo: undefined };
    } else {
      const currentRecommendation = result.recommendation;
      newResults[paperId] = {
        ...result,
        overridden: true,
        overriddenTo: currentRecommendation === "include" ? "exclude" : "include",
      };
    }
    onScreeningResultsChange(newResults);
    updateIncluded(newResults);
  };

  const addCriterion = () => {
    if (locked || !newCriterionName.trim()) return;
    const newC: ScreeningCriterion = {
      id: `custom-${Date.now()}`,
      name: newCriterionName,
      description: newCriterionDesc,
      enabled: true,
    };
    onCriteriaChange([...criteria, newC]);
    setNewCriterionName("");
    setNewCriterionDesc("");
  };

  const screenedCount = Object.keys(screeningResults).length;
  const includedCount = includedPaperIds.length;
  const manualCount = Object.values(screeningResults).filter((r) => r.overridden).length;
  const aiPriorityCount = Object.values(screeningResults).filter((r) => r.aiPriority !== undefined).length;

  // Sort papers based on view mode
  const sortedPapers = [...papers].sort((a, b) => {
    const resultA = screeningResults[a.id];
    const resultB = screeningResults[b.id];
    if (viewMode === "ai_priority") {
      const priorityA = resultA?.aiPriority ?? -1;
      const priorityB = resultB?.aiPriority ?? -1;
      return priorityB - priorityA;
    }
    const scoreA = resultA?.inclusionScore ?? -1;
    const scoreB = resultB?.inclusionScore ?? -1;
    return scoreB - scoreA;
  });

  const getRecommendationIcon = (result: PaperScreeningResult) => {
    const effective = result.overridden ? result.overriddenTo : result.recommendation;
    if (effective === "include") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (effective === "exclude") return <XCircle className="h-4 w-4 text-destructive" />;
    return <HelpCircle className="h-4 w-4 text-yellow-500" />;
  };

  // Cohen's Kappa between the AI recommendation and this reviewer's manual overrides.
  // This is NOT inter-rater reliability between two independent human reviewers — the
  // standard use of kappa in systematic reviews (Rayyan/Covidence-style dual blind
  // screening) — because there is only one human decision-maker in this pipeline. Label
  // and icon below must keep saying "AI vs. reviewer", never just "agreement", so nobody
  // mistakes this for inter-rater reliability it isn't measuring.
  const calculateKappa = () => {
    const both = Object.entries(screeningResults).filter(([_, r]) => r.overridden && r.recommendation);
    if (both.length < 5) return null;
    let agree = 0;
    let aiInclude = 0, aiExclude = 0, manInclude = 0, manExclude = 0;
    for (const [_, r] of both) {
      const aiDec = r.recommendation === "include" || r.recommendation === "maybe" ? "include" : "exclude";
      const manDec = r.overriddenTo || "include";
      if (aiDec === manDec) agree++;
      if (aiDec === "include") aiInclude++; else aiExclude++;
      if (manDec === "include") manInclude++; else manExclude++;
    }
    const n = both.length;
    const po = agree / n;
    const pe = ((aiInclude * manInclude) + (aiExclude * manExclude)) / (n * n);
    if (pe === 1) return 1;
    return (po - pe) / (1 - pe);
  };

  const kappa = calculateKappa();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Filter className="h-4 w-4" />
          {pt ? "Etapa 3: Triagem" : "Step 3: Screening"}
        </div>
        <p className="text-sm text-muted-foreground">
          {pt
            ? "Defina critérios de inclusão/exclusão, aplique triagem AI, e use Active Learning para priorizar."
            : "Define inclusion/exclusion criteria, apply AI screening, and use Active Learning to prioritize."}
        </p>
      </div>

      {!isOwner && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {pt
            ? "Você foi atribuído como revisor(a) desta revisão. Registre suas decisões de triagem abaixo — elas ficam ocultas dos demais revisores até a reconciliação."
            : "You've been assigned as a reviewer on this review. Record your screening decisions below — they stay hidden from other reviewers until reconciliation."}
        </div>
      )}

      {isOwner && (
        <>
      {/* Protocol registration */}
      <ProtocolPanel
        question={question}
        pico={pico}
        criteria={criteria}
        searchStrategy={searchStrategy}
        prosperoId={prosperoId}
        onProsperoIdChange={onProsperoIdChange}
        locked={locked}
        lockedAt={protocolLockedAt}
        protocolDocument={protocolDocument}
        onRegisterProtocol={onRegisterProtocol}
      />

      {reviewId && <ReviewersPanel reviewId={reviewId} researchProjectId={researchProjectId} />}

      {/* Criteria section */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {pt ? "Critérios de Triagem" : "Screening Criteria"}
          </h3>
          <Button variant="outline" size="sm" onClick={generateCriteria} disabled={generatingCriteria || locked} className="gap-2">
            {generatingCriteria ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {pt ? "Gerar com IA" : "Generate with AI"}
          </Button>
        </div>
        {criteria.map((c) => (
          <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Switch checked={c.enabled} disabled={locked} onCheckedChange={(checked) => {
              if (locked) return;
              onCriteriaChange(criteria.map((cr) => (cr.id === c.id ? { ...cr, enabled: checked } : cr)));
            }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
            {!locked && (
              <button onClick={() => onCriteriaChange(criteria.filter((cr) => cr.id !== c.id))} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <div className="flex gap-2">
            <input value={newCriterionName} onChange={(e) => setNewCriterionName(e.target.value)} placeholder={pt ? "Nome do critério" : "Criterion name"} className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm" />
            <input value={newCriterionDesc} onChange={(e) => setNewCriterionDesc(e.target.value)} placeholder={pt ? "Descrição" : "Description"} className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm" />
            <Button size="sm" variant="outline" onClick={addCriterion} disabled={!newCriterionName.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Screening actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={screenSample} disabled={screening || screeningAll || activeLearning || criteria.filter((c) => c.enabled).length === 0} className="gap-2">
          {screening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          {pt ? "Triar amostra (20)" : "Screen sample (20)"}
        </Button>
        <Button variant="outline" onClick={screenAllRemaining} disabled={screening || screeningAll || activeLearning || criteria.filter((c) => c.enabled).length === 0} className="gap-2">
          {screeningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          {pt ? "Avaliar todos" : "Screen all"}
        </Button>
        <Button
          variant="secondary"
          onClick={runActiveLearning}
          disabled={screening || screeningAll || activeLearning || screenedCount < 10}
          className="gap-2"
          title={screenedCount < 10 ? (pt ? "Trie pelo menos 10 artigos primeiro" : "Screen at least 10 papers first") : ""}
        >
          {activeLearning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          {pt ? "Active Learning" : "Active Learning"}
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{screenedCount}/{papers.length} {pt ? "triados" : "screened"}</span>
        <span>· {includedCount} {pt ? "incluídos" : "included"}</span>
        {manualCount > 0 && <span>· {manualCount} {pt ? "decisões manuais" : "manual decisions"}</span>}
        {aiPriorityCount > 0 && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Brain className="h-3 w-3" /> {aiPriorityCount} AI Priority
          </Badge>
        )}
        {kappa !== null && (
          <Badge
            variant="outline"
            className="gap-1 text-xs ml-auto"
            title={pt
              ? "Concordância entre a recomendação da IA e suas decisões manuais — não é confiabilidade entre dois revisores humanos independentes."
              : "Agreement between the AI's recommendation and your manual decisions — not inter-rater reliability between two independent human reviewers."}
          >
            <Bot className="h-3 w-3" />
            {pt ? "κ IA×revisor" : "κ AI×reviewer"} = {kappa.toFixed(2)}
            {kappa >= 0.8 ? " ✅" : kappa >= 0.6 ? " ⚠️" : " ❌"}
          </Badge>
        )}
      </div>

      {/* View mode tabs */}
      {screenedCount > 0 && (
        <div className="flex gap-2">
          <Button size="sm" variant={viewMode === "all" ? "default" : "ghost"} onClick={() => setViewMode("all")} className="text-xs h-7">
            {pt ? "Todos" : "All"}
          </Button>
          {aiPriorityCount > 0 && (
            <Button size="sm" variant={viewMode === "ai_priority" ? "default" : "ghost"} onClick={() => setViewMode("ai_priority")} className="text-xs h-7 gap-1">
              <Brain className="h-3 w-3" /> {pt ? "Prioridade AI" : "AI Priority"}
            </Button>
          )}
        </div>
      )}

      {/* Results table */}
      {screenedCount > 0 && (
        <div className="max-h-[500px] overflow-y-auto rounded-xl border border-border bg-card">
          {sortedPapers.map((paper) => {
            const result = screeningResults[paper.id];
            if (!result) return null;
            const isExpanded = expandedPaper === paper.id;
            const effective = result.overridden ? result.overriddenTo : result.recommendation;

            return (
              <div key={paper.id} className="border-b border-border last:border-0">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedPaper(isExpanded ? null : paper.id)}
                >
                  {getRecommendationIcon(result)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{paper.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {paper.year && `(${paper.year})`} · Score: {Math.round(result.inclusionScore * 100)}%
                      {result.aiPriority !== undefined && (
                        <span className="ml-2 text-primary">
                          🧠 AI: {Math.round(result.aiPriority * 100)}%
                        </span>
                      )}
                    </p>
                  </div>
                  {result.aiPriority !== undefined && (
                    <Badge variant="outline" className="text-[10px] gap-0.5 border-primary/30 text-primary">
                      <Brain className="h-2.5 w-2.5" />
                      AI
                    </Badge>
                  )}
                  <Badge variant={effective === "include" ? "default" : effective === "exclude" ? "destructive" : "secondary"} className="text-xs">
                    {result.overridden && "⚡ "}
                    {effective === "include"
                      ? pt ? "Incluir" : "Include"
                      : effective === "exclude"
                        ? pt ? "Excluir" : "Exclude"
                        : pt ? "Talvez" : "Maybe"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOverride(paper.id);
                    }}
                    className="text-xs"
                  >
                    {pt ? "Alterar" : "Override"}
                  </Button>
                </div>
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                    {paper.abstract && (
                      <p className="text-xs text-muted-foreground line-clamp-3">{paper.abstract}</p>
                    )}
                    {result.aiReasoning && (
                      <div className="flex items-start gap-2 text-xs rounded-lg bg-primary/5 p-2">
                        <Brain className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground">{result.aiReasoning}</span>
                      </div>
                    )}
                    {criteria.filter((c) => c.enabled).map((c) => {
                      const cr = result.criteria[c.id];
                      if (!cr) return null;
                      return (
                        <div key={c.id} className="flex items-start gap-2 text-xs">
                          <Badge variant="outline" className={
                            cr.answer === "yes" ? "border-green-500/30 text-green-600" :
                            cr.answer === "no" ? "border-destructive/30 text-destructive" :
                            "border-yellow-500/30 text-yellow-600"
                          }>
                            {cr.answer.toUpperCase()}
                          </Badge>
                          <div>
                            <span className="font-medium text-foreground">{c.name}: </span>
                            <span className="text-muted-foreground">{cr.explanation}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Dual blind screening: visible to any assigned reviewer, including the owner if self-assigned */}
      {dualMode && reviewId && currentUserId && reviewers.some((r) => r.user_id === currentUserId) && (
        <DualScreeningPanel reviewId={reviewId} papers={papers} currentUserId={currentUserId} />
      )}

      {dualMode && reviewId && canSeeConflicts && currentUserId && (
        <ConflictsPanel
          reviewId={reviewId}
          papers={papers}
          reviewers={reviewers}
          currentUserId={currentUserId}
          ownerUserId={reviewOwnerId || currentUserId}
          onIncludedIdsComputed={onIncludedPaperIdsChange}
        />
      )}

      {/* Navigation */}
      {isOwner && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={onPrev} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {pt ? "Anterior" : "Previous"}
          </Button>
          <Button onClick={onNext} disabled={includedCount === 0} className="gap-2">
            {pt ? "Próximo: Extração" : "Next: Extraction"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default StepScreening;
