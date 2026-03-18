import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Lightbulb, Loader2, AlertCircle, ChevronDown, ChevronUp, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Gap {
  title: string;
  description: string;
  evidence: string;
  suggestions: string[];
  relevance: "high" | "medium";
}

interface ResearchGapsProps {
  query: string;
  papers: { title: string; authors: string[]; year: number | null; abstract: string }[];
  loading: boolean;
  onSuggestionClick?: (suggestion: string) => void;
}

const GAPS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-gaps`;

const ResearchGaps = ({ query, papers, loading: papersLoading, onSuggestionClick }: ResearchGapsProps) => {
  const { locale } = useLanguage();
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGap, setExpandedGap] = useState<number | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (papersLoading || papers.length === 0 || hasRun.current) return;
    hasRun.current = true;
    fetchGaps();
  }, [papersLoading, papers]);

  const fetchGaps = async () => {
    setGapsLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const resp = await fetch(GAPS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ query, papers: papers.slice(0, 15), locale }),
      });

      if (!resp.ok) throw new Error("Failed to analyze gaps");
      const data = await resp.json();
      setGaps(data.gaps || []);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setGapsLoading(false);
    }
  };

  if (papersLoading || papers.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        <Lightbulb className="h-4 w-4" />
        {locale === "pt" ? "Lacunas de Pesquisa Identificadas" : "Identified Research Gaps"}
      </div>

      {gapsLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {locale === "pt" ? "Analisando lacunas na literatura..." : "Analyzing literature gaps..."}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {gaps.length > 0 && (
        <div className="space-y-2">
          {gaps.map((gap, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/50 bg-background/50 overflow-hidden transition-all"
            >
              <button
                onClick={() => setExpandedGap(expandedGap === i ? null : i)}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  gap.relevance === "high"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{gap.title}</p>
                  {expandedGap !== i && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{gap.description}</p>
                  )}
                </div>
                {expandedGap === i ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
              </button>

              {expandedGap === i && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                  <p className="text-sm text-foreground/80 leading-relaxed">{gap.description}</p>
                  
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {locale === "pt" ? "Evidência:" : "Evidence:"}
                    </p>
                    <p className="text-xs text-foreground/70 italic">{gap.evidence}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      <Sparkles className="inline h-3 w-3 mr-1" />
                      {locale === "pt" ? "Sugestões para pesquisa:" : "Research suggestions:"}
                    </p>
                    <div className="space-y-1.5">
                      {gap.suggestions.map((suggestion, j) => (
                        <button
                          key={j}
                          onClick={() => onSuggestionClick?.(suggestion)}
                          className="w-full flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-foreground hover:bg-primary/10 hover:border-primary/40 transition-colors group"
                        >
                          <ArrowRight className="h-3 w-3 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResearchGaps;
