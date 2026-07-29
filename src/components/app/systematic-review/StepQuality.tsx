import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Bot,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  journal?: string;
  doi?: string;
}

interface QualityResult {
  paperId: string;
  checklist: string;
  domains: Record<string, { rating: string; justification: string }>;
  overallScore: number | string;
  overallJudgment: "high_quality" | "moderate_quality" | "low_quality";
  summary: string;
  // Every assessment starts AI-generated from title/abstract alone. It only becomes
  // human-reviewed once a reviewer has actually looked at and touched at least one
  // domain rating — until then it must not be presented as a finished judgment.
  humanReviewed?: boolean;
}

interface StepQualityProps {
  question: string;
  papers: Paper[];
  includedPaperIds: string[];
  qualityResults: Record<string, QualityResult>;
  onQualityResultsChange: (r: Record<string, QualityResult>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const CHECKLIST_OPTIONS = [
  { id: "casp_rct", label: "CASP (RCT)", desc: "Ensaios clínicos randomizados" },
  { id: "newcastle_ottawa", label: "Newcastle-Ottawa", desc: "Estudos observacionais (coorte/caso-controle)" },
  { id: "jadad", label: "Jadad Scale", desc: "Qualidade de ensaios clínicos (0-5)" },
  { id: "robins_i", label: "ROBINS-I", desc: "Estudos não-randomizados de intervenção" },
];

const StepQuality = ({
  question,
  papers,
  includedPaperIds,
  qualityResults,
  onQualityResultsChange,
  onNext,
  onPrev,
}: StepQualityProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [selectedChecklist, setSelectedChecklist] = useState("casp_rct");
  const [assessing, setAssessing] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);

  const includedPapers = papers.filter((p) => includedPaperIds.includes(p.id));
  const assessedCount = Object.keys(qualityResults).length;

  const runAssessment = async () => {
    if (includedPapers.length === 0) return;
    setAssessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("quality-assessment", {
        body: {
          papers: includedPapers.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors || [],
            year: p.year,
            abstract: p.abstract || "",
            journal: p.journal || "",
            doi: p.doi || "",
          })),
          checklist: selectedChecklist,
          question,
          locale,
        },
      });
      if (error) throw error;

      const newResults = { ...qualityResults };
      for (const result of data?.results || []) {
        if (result.paperId) {
          newResults[result.paperId] = result;
        }
      }
      onQualityResultsChange(newResults);
      toast.success(pt ? "Avaliação de qualidade concluída!" : "Quality assessment complete!");
    } catch (err: any) {
      console.error("Quality assessment error:", err);
      toast.error(err.message || "Assessment failed");
    } finally {
      setAssessing(false);
    }
  };

  const getJudgmentIcon = (judgment: string) => {
    switch (judgment) {
      case "high_quality":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "moderate_quality":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "low_quality":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getJudgmentLabel = (judgment: string) => {
    if (pt) {
      switch (judgment) {
        case "high_quality": return "Alta qualidade";
        case "moderate_quality": return "Qualidade moderada";
        case "low_quality": return "Baixa qualidade";
        default: return "Não avaliado";
      }
    }
    switch (judgment) {
      case "high_quality": return "High quality";
      case "moderate_quality": return "Moderate quality";
      case "low_quality": return "Low quality";
      default: return "Not assessed";
    }
  };

  const getJudgmentVariant = (judgment: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (judgment) {
      case "high_quality": return "default";
      case "moderate_quality": return "secondary";
      case "low_quality": return "destructive";
      default: return "outline";
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "yes":
      case "low":
        return "text-green-600 bg-green-50 dark:bg-green-950/30";
      case "no":
      case "critical":
      case "serious":
        return "text-red-600 bg-red-50 dark:bg-red-950/30";
      case "unclear":
      case "moderate":
      case "no_information":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  // Override a domain rating manually — the only signal we have that a human actually
  // looked at this assessment, so this is also what flips it out of "pending review".
  const overrideDomain = (paperId: string, domainId: string, newRating: string) => {
    const result = qualityResults[paperId];
    if (!result) return;
    const updated = {
      ...result,
      domains: {
        ...result.domains,
        [domainId]: { ...result.domains[domainId], rating: newRating },
      },
      humanReviewed: true,
    };
    onQualityResultsChange({ ...qualityResults, [paperId]: updated });
  };

  // Summary counts
  const highCount = Object.values(qualityResults).filter((r) => r.overallJudgment === "high_quality").length;
  const modCount = Object.values(qualityResults).filter((r) => r.overallJudgment === "moderate_quality").length;
  const lowCount = Object.values(qualityResults).filter((r) => r.overallJudgment === "low_quality").length;
  const pendingReviewCount = Object.values(qualityResults).filter((r) => !r.humanReviewed).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <ShieldCheck className="h-4 w-4" />
          {pt ? "Etapa 5: Avaliação de Qualidade" : "Step 5: Quality Assessment"}
        </div>
        <p className="text-sm text-muted-foreground">
          {pt
            ? `Avalie a qualidade metodológica dos ${includedPapers.length} artigos incluídos usando checklists padronizados.`
            : `Assess methodological quality of ${includedPapers.length} included papers using standardized checklists.`}
        </p>
      </div>

      {/* Checklist selector */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {pt ? "Selecionar Checklist" : "Select Checklist"}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHECKLIST_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedChecklist(opt.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                selectedChecklist === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{opt.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{pt ? opt.desc : opt.desc}</p>
            </button>
          ))}
        </div>

        <Button onClick={runAssessment} disabled={assessing || includedPapers.length === 0} className="gap-2">
          {assessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {pt ? "Avaliar com IA" : "Assess with AI"}
        </Button>
      </div>

      {/* Summary */}
      {assessedCount > 0 && (
        <div className="flex flex-wrap gap-3">
          <Badge variant="default" className="gap-1.5">
            <CheckCircle2 className="h-3 w-3" /> {pt ? "Alta" : "High"}: {highCount}
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <AlertTriangle className="h-3 w-3" /> {pt ? "Moderada" : "Moderate"}: {modCount}
          </Badge>
          <Badge variant="destructive" className="gap-1.5">
            <XCircle className="h-3 w-3" /> {pt ? "Baixa" : "Low"}: {lowCount}
          </Badge>
          {pendingReviewCount > 0 && (
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400"
              title={pt
                ? "Avaliadas pela IA a partir de título/resumo, ainda sem confirmação de um revisor humano"
                : "Assessed by AI from title/abstract, not yet confirmed by a human reviewer"}
            >
              <Bot className="h-3 w-3" /> {pt ? "Pendentes de revisão" : "Pending review"}: {pendingReviewCount}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            {assessedCount}/{includedPapers.length} {pt ? "avaliados" : "assessed"}
          </span>
        </div>
      )}

      {/* Results */}
      {assessedCount > 0 && (
        <div className="max-h-[500px] overflow-y-auto rounded-xl border border-border bg-card">
          {includedPapers.map((paper) => {
            const result = qualityResults[paper.id];
            if (!result) return null;
            const isExpanded = expandedPaper === paper.id;

            return (
              <div key={paper.id} className="border-b border-border last:border-0">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedPaper(isExpanded ? null : paper.id)}
                >
                  {getJudgmentIcon(result.overallJudgment)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{paper.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {paper.year && `(${paper.year})`} · {pt ? "Score" : "Score"}: {result.overallScore}
                    </p>
                  </div>
                  {!result.humanReviewed && (
                    <Badge
                      variant="outline"
                      className="gap-1 text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400"
                      title={pt
                        ? "Gerado por IA a partir de título/resumo — ainda não confirmado por um revisor humano"
                        : "AI-generated from title/abstract — not yet confirmed by a human reviewer"}
                    >
                      <Bot className="h-3 w-3" /> {pt ? "Pendente" : "Pending"}
                    </Badge>
                  )}
                  <Badge variant={getJudgmentVariant(result.overallJudgment)} className="text-xs">
                    {getJudgmentLabel(result.overallJudgment)}
                  </Badge>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">{result.summary}</p>
                    {!result.humanReviewed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQualityResultsChange({ ...qualityResults, [paper.id]: { ...result, humanReviewed: true } });
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {pt ? "Confirmar como revisado" : "Confirm as reviewed"}
                      </Button>
                    )}
                    <div className="space-y-1.5">
                      {Object.entries(result.domains || {}).map(([domainId, domain]) => (
                        <div key={domainId} className="flex items-start gap-2 text-xs">
                          <select
                            value={domain.rating}
                            onChange={(e) => overrideDomain(paper.id, domainId, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium border-0 cursor-pointer ${getRatingColor(domain.rating)}`}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                            <option value="unclear">Unclear</option>
                            <option value="not_applicable">N/A</option>
                            <option value="low">Low risk</option>
                            <option value="moderate">Moderate</option>
                            <option value="serious">Serious</option>
                            <option value="critical">Critical</option>
                          </select>
                          <div>
                            <span className="font-medium text-foreground">{domainId}: </span>
                            <span className="text-muted-foreground">{domain.justification}</span>
                          </div>
                        </div>
                      ))}
                    </div>
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
          {pt ? "Anterior" : "Previous"}
        </Button>
        <Button onClick={onNext} className="gap-2">
          {pt ? "Próximo: Relatório" : "Next: Report"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepQuality;
