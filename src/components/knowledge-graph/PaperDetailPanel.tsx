import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink, BookOpen, Calendar, Users, Quote, FileText, AlertTriangle,
} from "lucide-react";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  doi?: string;
  journal?: string;
  citationCount?: number;
}

interface PaperDetailPanelProps {
  paper: Paper | null;
  tldr?: string;
  isOrigin?: boolean;
  hasRealCitationData?: boolean;
  locale: string;
}

const PaperDetailPanel = ({ paper, tldr, isOrigin, hasRealCitationData, locale }: PaperDetailPanelProps) => {
  const isPt = locale === "pt";

  if (!paper) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-card border-l border-border/40 px-4">
        <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-xs text-muted-foreground text-center">
          {isPt
            ? "Selecione um paper no grafo ou na lista para ver detalhes"
            : "Select a paper from the graph or list to see details"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border/40">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Origin badge */}
          {isOrigin && (
            <Badge className="bg-accent text-accent-foreground text-[10px]">
              Origin Paper
            </Badge>
          )}

          {/* Title */}
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {paper.title}
          </h3>

          {/* Authors */}
          {paper.authors?.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {paper.authors.join(", ")}
              </p>
            </div>
          )}

          {/* Year & Journal */}
          <div className="flex flex-wrap gap-2">
            {paper.year && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{paper.year}</span>
              </div>
            )}
            {paper.journal && (
              <div className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {paper.journal}
                </span>
              </div>
            )}
          </div>

          {/* Citations */}
          {paper.citationCount !== undefined && paper.citationCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Quote className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {paper.citationCount} {isPt ? "citações" : "citations"}
              </span>
            </div>
          )}

          {hasRealCitationData === false && !isOrigin && (
            <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                {isPt
                  ? "Sem dados de citação do Semantic Scholar para este paper (sem DOI ou não encontrado) — suas conexões no grafo podem estar incompletas."
                  : "No Semantic Scholar citation data for this paper (missing DOI or not found) — its connections in the graph may be incomplete."}
              </p>
            </div>
          )}

          <Separator />

          {/* TL;DR */}
          {tldr && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                TL;DR
              </p>
              <p className="text-xs text-foreground leading-relaxed">{tldr}</p>
            </div>
          )}

          {/* Abstract */}
          {paper.abstract && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Abstract
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {paper.abstract}
              </p>
            </div>
          )}

          {/* DOI link */}
          {paper.doi && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => window.open(`https://doi.org/${paper.doi}`, "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              {isPt ? "Abrir no DOI" : "Open DOI"}
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PaperDetailPanel;
