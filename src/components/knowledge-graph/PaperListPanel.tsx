import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface PaperListPanelProps {
  papers: Paper[];
  originIndex: number;
  priorWorkIndices: number[];
  derivativeWorkIndices: number[];
  selectedPaperIndex: number | null;
  onSelectPaper: (index: number) => void;
  locale: string;
}

const PaperListPanel = ({
  papers,
  originIndex,
  priorWorkIndices,
  derivativeWorkIndices,
  selectedPaperIndex,
  onSelectPaper,
  locale,
}: PaperListPanelProps) => {
  const [filter, setFilter] = useState("");
  const isPt = locale === "pt";

  const filterPapers = (indices: number[]) => {
    return indices
      .filter(i => papers[i])
      .filter(i => {
        if (!filter) return true;
        const p = papers[i];
        const q = filter.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          (p.authors || []).join(" ").toLowerCase().includes(q)
        );
      });
  };

  const allIndices = papers.map((_, i) => i);
  const filteredAll = filterPapers(allIndices);
  const filteredPrior = filterPapers(priorWorkIndices);
  const filteredDerivative = filterPapers(derivativeWorkIndices);

  const PaperItem = ({ index }: { index: number }) => {
    const p = papers[index];
    if (!p) return null;
    const isOrigin = index === originIndex;
    const isSelected = selectedPaperIndex === index;

    return (
      <button
        onClick={() => onSelectPaper(index)}
        className={cn(
          "w-full text-left px-3 py-2 rounded-md transition-colors border border-transparent",
          isSelected
            ? "bg-accent/10 border-accent/30"
            : "hover:bg-muted/50",
          isOrigin && "border-l-2 border-l-accent"
        )}
      >
        <div className="flex items-start gap-2">
          {isOrigin && <Star className="h-3 w-3 text-accent shrink-0 mt-0.5" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
              {p.title}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {(p.authors || []).slice(0, 1).join(", ")}
              {(p.authors || []).length > 1 ? " et al." : ""}
              {p.year ? ` · ${p.year}` : ""}
            </p>
          </div>
          {p.citationCount ? (
            <Badge variant="secondary" className="text-[9px] h-4 shrink-0">
              {p.citationCount}
            </Badge>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/40">
      {/* Search */}
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={isPt ? "Filtrar papers..." : "Filter papers..."}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 h-8">
          <TabsTrigger value="all" className="text-[10px] px-2 h-6">
            {isPt ? "Todos" : "All"} ({filteredAll.length})
          </TabsTrigger>
          <TabsTrigger value="prior" className="text-[10px] px-2 h-6">
            Prior ({filteredPrior.length})
          </TabsTrigger>
          <TabsTrigger value="derivative" className="text-[10px] px-2 h-6">
            Derivative ({filteredDerivative.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {filteredAll.map(i => (
                <PaperItem key={i} index={i} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="prior" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {filteredPrior.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {isPt ? "Nenhum prior work identificado" : "No prior works identified"}
                </p>
              ) : (
                filteredPrior.map(i => <PaperItem key={i} index={i} />)
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="derivative" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {filteredDerivative.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {isPt ? "Nenhum derivative work identificado" : "No derivative works identified"}
                </p>
              ) : (
                filteredDerivative.map(i => <PaperItem key={i} index={i} />)
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaperListPanel;
