import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";

interface CitationStats {
  supporting: number;
  contrasting: number;
  mentioning: number;
}

interface CitationBadgeProps {
  paperId: string;
  doi?: string;
  compact?: boolean;
}

const CitationBadge = ({ paperId, doi, compact = false }: CitationBadgeProps) => {
  const { locale } = useLanguage();
  const [stats, setStats] = useState<CitationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Try to get cached counters from papers table first (O(1))
      if (doi) {
        const { data: paperData } = await supabase
          .from("papers")
          .select("total_supporting, total_contrasting, total_mentioning")
          .eq("doi", doi.toLowerCase())
          .maybeSingle();

        if (paperData) {
          const total = (paperData.total_supporting || 0) + (paperData.total_contrasting || 0) + (paperData.total_mentioning || 0);
          if (total > 0) {
            setStats({
              supporting: paperData.total_supporting || 0,
              contrasting: paperData.total_contrasting || 0,
              mentioning: paperData.total_mentioning || 0,
            });
            setLoading(false);
            return;
          }
        }
      }

      // Fallback: count from citation_classifications
      const { data, error } = await supabase
        .from("citation_classifications")
        .select("classification")
        .eq("paper_id", paperId);

      if (error || !data) {
        setLoading(false);
        return;
      }

      const counts: CitationStats = { supporting: 0, contrasting: 0, mentioning: 0 };
      data.forEach((row: any) => {
        if (row.classification in counts) {
          counts[row.classification as keyof CitationStats]++;
        }
      });

      const total = counts.supporting + counts.contrasting + counts.mentioning;
      if (total > 0) {
        setStats(counts);
      }
      setLoading(false);
    };

    fetchStats();
  }, [paperId, doi]);

  if (loading || !stats) return null;

  const total = stats.supporting + stats.contrasting + stats.mentioning;
  if (total === 0) return null;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium cursor-help">
            {stats.supporting > 0 && (
              <span className="text-success">{stats.supporting}</span>
            )}
            {stats.supporting > 0 && (stats.contrasting > 0 || stats.mentioning > 0) && (
              <span className="text-muted-foreground">/</span>
            )}
            {stats.contrasting > 0 && (
              <span className="text-destructive">{stats.contrasting}</span>
            )}
            {stats.contrasting > 0 && stats.mentioning > 0 && (
              <span className="text-muted-foreground">/</span>
            )}
            {stats.mentioning > 0 && (
              <span className="text-muted-foreground">{stats.mentioning}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {stats.supporting} {locale === "pt" ? "apoio" : "supporting"} ·{" "}
            {stats.contrasting} {locale === "pt" ? "contraste" : "contrasting"} ·{" "}
            {stats.mentioning} {locale === "pt" ? "menção" : "mentioning"}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border p-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-success/10 text-success">
            {stats.supporting}
            <span className="hidden sm:inline">
              {locale === "pt" ? " Ap" : " Sup"}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {locale === "pt" ? "Citações de apoio" : "Supporting citations"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive">
            {stats.contrasting}
            <span className="hidden sm:inline">
              {locale === "pt" ? " Cont" : " Con"}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {locale === "pt" ? "Citações contrastantes" : "Contrasting citations"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
            {stats.mentioning}
            <span className="hidden sm:inline">
              {locale === "pt" ? " Menç" : " Men"}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {locale === "pt" ? "Menções" : "Mentions"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default CitationBadge;
