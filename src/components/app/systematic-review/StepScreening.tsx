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
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}: StepScreeningProps) => {
  const { locale } = useLanguage();
  const [generatingCriteria, setGeneratingCriteria] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screeningAll, setScreeningAll] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);
  const [editingCriterion, setEditingCriterion] = useState<string | null>(null);
  const [newCriterionName, setNewCriterionName] = useState("");
  const [newCriterionDesc, setNewCriterionDesc] = useState("");

  // Auto-generate criteria on first load if autoSuggestions is on and no criteria exist
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
      toast.success(locale === "pt" ? "Critérios gerados com sucesso!" : "Criteria generated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate criteria");
    } finally {
      setGeneratingCriteria(false);
    }
  };

  const screenSample = async () => {
    const enabledCriteria = criteria.filter((c) => c.enabled);
    if (enabledCriteria.length === 0) {
      toast.error(locale === "pt" ? "Ative pelo menos um critério" : "Enable at least one criterion");
      return;
    }
    setScreening(true);
    try {
      // Screen a sample of papers (first 50 unscreened)
      const unscreened = papers.filter((p) => !screeningResults[p.id]).slice(0, 50);
      if (unscreened.length === 0) {
        toast.info(locale === "pt" ? "Todos os artigos já foram triados" : "All papers already screened");
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
        newResults[result.paperId] = result;
      }
      onScreeningResultsChange(newResults);

      // Auto-update included papers
      const included = Object.entries(newResults)
        .filter(([_, r]) => (r.overridden ? r.overriddenTo === "include" : r.recommendation === "include"))
        .map(([id]) => id);
      onIncludedPaperIdsChange(included);

      toast.success(
        locale === "pt"
          ? `${unscreened.length} artigos triados`
          : `${unscreened.length} papers screened`
      );
    } catch (err: any) {
      toast.error(err.message || "Screening failed");
    } finally {
      setScreening(false);
    }
  };

  const screenAllRemaining = async () => {
    setScreeningAll(true);
    // Same as screenSample but all remaining
    const enabledCriteria = criteria.filter((c) => c.enabled);
    try {
      const unscreened = papers.filter((p) => !screeningResults[p.id]);
      if (unscreened.length === 0) {
        toast.info(locale === "pt" ? "Todos triados" : "All screened");
        setScreeningAll(false);
        return;
      }
      // Process in batches of 20
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
      const included = Object.entries(newResults)
        .filter(([_, r]) => (r.overridden ? r.overriddenTo === "include" : r.recommendation === "include"))
        .map(([id]) => id);
      onIncludedPaperIdsChange(included);
      toast.success(locale === "pt" ? "Triagem completa!" : "Screening complete!");
    } catch (err: any) {
      toast.error(err.message || "Screening failed");
    } finally {
      setScreeningAll(false);
    }
  };

  const toggleOverride = (paperId: string) => {
    const result = screeningResults[paperId];
    if (!result) return;
    const newResults = { ...screeningResults };
    if (result.overridden) {
      // Remove override
      newResults[paperId] = { ...result, overridden: false, overriddenTo: undefined };
    } else {
      // Override to opposite
      const currentRecommendation = result.recommendation;
      newResults[paperId] = {
        ...result,
        overridden: true,
        overriddenTo: currentRecommendation === "include" ? "exclude" : "include",
      };
    }
    onScreeningResultsChange(newResults);
    const included = Object.entries(newResults)
      .filter(([_, r]) => (r.overridden ? r.overriddenTo === "include" : r.recommendation === "include"))
      .map(([id]) => id);
    onIncludedPaperIdsChange(included);
  };

  const addCriterion = () => {
    if (!newCriterionName.trim()) return;
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

  // Sort papers by inclusion score (highest first)
  const sortedPapers = [...papers].sort((a, b) => {
    const scoreA = screeningResults[a.id]?.inclusionScore ?? -1;
    const scoreB = screeningResults[b.id]?.inclusionScore ?? -1;
    return scoreB - scoreA;
  });

  const getRecommendationIcon = (result: PaperScreeningResult) => {
    const effective = result.overridden ? result.overriddenTo : result.recommendation;
    if (effective === "include") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (effective === "exclude") return <XCircle className="h-4 w-4 text-destructive" />;
    return <HelpCircle className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Filter className="h-4 w-4" />
          {locale === "pt" ? "Etapa 3: Critérios de Triagem" : "Step 3: Screening Criteria"}
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Defina critérios de inclusão/exclusão e aplique aos artigos coletados."
            : "Define inclusion/exclusion criteria and apply to collected articles."}
        </p>
      </div>

      {/* Criteria section */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {locale === "pt" ? "Critérios de Triagem" : "Screening Criteria"}
          </h3>
          <Button variant="outline" size="sm" onClick={generateCriteria} disabled={generatingCriteria} className="gap-2">
            {generatingCriteria ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {locale === "pt" ? "Gerar com IA" : "Generate with AI"}
          </Button>
        </div>

        {criteria.map((c) => (
          <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Switch checked={c.enabled} onCheckedChange={(checked) => {
              onCriteriaChange(criteria.map((cr) => (cr.id === c.id ? { ...cr, enabled: checked } : cr)));
            }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
            <button onClick={() => onCriteriaChange(criteria.filter((cr) => cr.id !== c.id))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Add custom criterion */}
        <div className="flex gap-2">
          <input
            value={newCriterionName}
            onChange={(e) => setNewCriterionName(e.target.value)}
            placeholder={locale === "pt" ? "Nome do critério" : "Criterion name"}
            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            value={newCriterionDesc}
            onChange={(e) => setNewCriterionDesc(e.target.value)}
            placeholder={locale === "pt" ? "Descrição" : "Description"}
            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addCriterion} disabled={!newCriterionName.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Screening actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={screenSample} disabled={screening || screeningAll || criteria.filter((c) => c.enabled).length === 0} className="gap-2">
          {screening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          {locale === "pt" ? "Triar amostra (50)" : "Screen sample (50)"}
        </Button>
        <Button variant="outline" onClick={screenAllRemaining} disabled={screening || screeningAll || criteria.filter((c) => c.enabled).length === 0} className="gap-2">
          {screeningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          {locale === "pt" ? "Avaliar todos" : "Screen all"}
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {locale === "pt"
            ? `${screenedCount}/${papers.length} triados · ${includedCount} incluídos`
            : `${screenedCount}/${papers.length} screened · ${includedCount} included`}
        </div>
      </div>

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
                    </p>
                  </div>
                  <Badge variant={effective === "include" ? "default" : effective === "exclude" ? "destructive" : "secondary"} className="text-xs">
                    {result.overridden && "⚡ "}
                    {effective === "include"
                      ? locale === "pt" ? "Incluir" : "Include"
                      : effective === "exclude"
                        ? locale === "pt" ? "Excluir" : "Exclude"
                        : locale === "pt" ? "Talvez" : "Maybe"}
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
                    {locale === "pt" ? "Alterar" : "Override"}
                  </Button>
                </div>
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                    {paper.abstract && (
                      <p className="text-xs text-muted-foreground line-clamp-3">{paper.abstract}</p>
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

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {locale === "pt" ? "Anterior" : "Previous"}
        </Button>
        <Button onClick={onNext} disabled={includedCount === 0} className="gap-2">
          {locale === "pt" ? "Próximo: Extração" : "Next: Extraction"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepScreening;
