import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Search, Loader2, FileText, Plus, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  source?: string;
  doi?: string;
  url?: string;
}

interface StepCollectionProps {
  question: string;
  papers: Paper[];
  onPapersChange: (papers: Paper[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

const StepCollection = ({ question, papers, onPapersChange, onNext, onPrev }: StepCollectionProps) => {
  const { locale } = useLanguage();
  const [searching, setSearching] = useState(false);
  const [searchCount, setSearchCount] = useState(200);

  const handleSearch = async () => {
    if (!question.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-papers", {
        body: { query: question, limit: searchCount },
      });
      if (error) throw error;
      const results: Paper[] = (data?.papers || data?.results || []).map((p: any) => ({
        id: p.paperId || p.id || crypto.randomUUID(),
        title: p.title,
        authors: p.authors?.map((a: any) => a.name || a) || [],
        year: p.year,
        abstract: p.abstract,
        source: p.source || "semantic_scholar",
        doi: p.doi,
        url: p.url,
      }));

      // Merge without duplicates
      const existingIds = new Set(papers.map((p) => p.id));
      const newPapers = results.filter((p) => !existingIds.has(p.id));
      onPapersChange([...papers, ...newPapers]);
      toast.success(
        locale === "pt"
          ? `${newPapers.length} artigos adicionados (${results.length} encontrados)`
          : `${newPapers.length} papers added (${results.length} found)`
      );
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const removePaper = (id: string) => {
    onPapersChange(papers.filter((p) => p.id !== id));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <FileText className="h-4 w-4" />
          {locale === "pt" ? "Etapa 2: Coleta de Artigos" : "Step 2: Article Collection"}
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Colete artigos via busca semântica. Quanto mais artigos, melhor a cobertura."
            : "Collect articles via semantic search. More articles means better coverage."}
        </p>
      </div>

      {/* Search controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex-1 text-sm text-muted-foreground truncate">
          <span className="font-medium text-foreground">{locale === "pt" ? "Pergunta:" : "Question:"}</span> {question}
        </div>
        <select
          value={searchCount}
          onChange={(e) => setSearchCount(Number(e.target.value))}
          className="rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value={100}>100 {locale === "pt" ? "artigos" : "papers"}</option>
          <option value={200}>200 {locale === "pt" ? "artigos" : "papers"}</option>
          <option value={500}>500 {locale === "pt" ? "artigos" : "papers"}</option>
        </select>
        <Button onClick={handleSearch} disabled={searching} className="gap-2">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {locale === "pt" ? "Buscar" : "Search"}
        </Button>
      </div>

      {/* Papers list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            {locale === "pt" ? `${papers.length} artigos coletados` : `${papers.length} papers collected`}
          </h3>
        </div>

        {papers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {locale === "pt" ? "Clique em 'Buscar' para coletar artigos" : "Click 'Search' to collect papers"}
            </p>
          </div>
        ) : (
          <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="flex items-start gap-3 rounded-lg p-2 text-sm hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{paper.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {paper.authors?.slice(0, 3).join(", ")}
                    {(paper.authors?.length || 0) > 3 && " et al."} {paper.year && `(${paper.year})`}
                  </p>
                </div>
                <button
                  onClick={() => removePaper(paper.id)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {locale === "pt" ? "Anterior" : "Previous"}
        </Button>
        <Button onClick={onNext} disabled={papers.length === 0} className="gap-2">
          {locale === "pt" ? "Próximo: Triagem" : "Next: Screening"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepCollection;
