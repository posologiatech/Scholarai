import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Loader2, Network, AlertCircle, Sparkles, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import KnowledgeGraphView, {
  type GraphNode,
  type GraphEdge,
  type GraphCluster,
} from "@/components/knowledge-graph/KnowledgeGraphView";

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

const KnowledgeGraph = () => {
  const { locale } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(query);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [graphClusters, setGraphClusters] = useState<GraphCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(400, rect.width),
          height: Math.max(400, window.innerHeight - rect.top - 24),
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Auto-search on mount if query exists
  useEffect(() => {
    if (query) handleSearch(query);
  }, []);

  const handleSearch = async (q?: string) => {
    const searchTerm = q || searchQuery;
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    setGraphNodes([]);
    setGraphEdges([]);
    setGraphClusters([]);

    try {
      // Step 1: Search papers
      const searchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-papers`;
      const resp = await fetch(searchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query: searchTerm, limit: 20 }),
      });

      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      const fetchedPapers: Paper[] = data.papers || [];
      setPapers(fetchedPapers);

      if (fetchedPapers.length === 0) {
        setError(locale === "pt" ? "Nenhum paper encontrado para esta busca." : "No papers found for this search.");
        setLoading(false);
        return;
      }

      // Step 2: Generate knowledge graph
      setLoading(false);
      setGraphLoading(true);

      const graphUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-knowledge-graph`;
      const graphResp = await fetch(graphUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ papers: fetchedPapers, query: searchTerm, locale }),
      });

      if (!graphResp.ok) throw new Error("Graph generation failed");
      const graphData = await graphResp.json();

      if (graphData.error) throw new Error(graphData.error);

      setGraphNodes(graphData.nodes || []);
      setGraphEdges(graphData.edges || []);
      setGraphClusters(graphData.clusters || []);

      // Update URL
      if (!q) {
        navigate(`/knowledge-graph?q=${encodeURIComponent(searchTerm)}`, { replace: true });
      }
    } catch (err: any) {
      console.error("Knowledge graph error:", err);
      setError(err.message || "Failed to generate knowledge graph");
      toast.error(locale === "pt" ? "Erro ao gerar o mapa de conhecimento" : "Failed to generate knowledge graph");
    } finally {
      setLoading(false);
      setGraphLoading(false);
    }
  };

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.type === "paper" && node.paperIndex !== undefined && papers[node.paperIndex]) {
        const paper = papers[node.paperIndex];
        if (paper.doi) {
          window.open(`https://doi.org/${paper.doi}`, "_blank");
        }
      }
    },
    [papers]
  );

  const isLoading = loading || graphLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Network className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-display font-bold text-foreground">
            {locale === "pt" ? "Mapa de Conhecimento" : "Knowledge Map"}
          </h1>
          {papers.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {papers.length} papers
            </Badge>
          )}
        </div>

        {/* Search bar */}
        <div className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                locale === "pt"
                  ? "Busque um tema para gerar o mapa de conhecimento..."
                  : "Search a topic to generate the knowledge map..."
              }
              className="pl-9"
              disabled={isLoading}
            />
          </div>
          <Button onClick={() => handleSearch()} disabled={isLoading || !searchQuery.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2">{locale === "pt" ? "Gerar Mapa" : "Generate Map"}</span>
          </Button>
        </div>

        {query && (
          <p className="text-xs text-muted-foreground mt-2">
            {locale === "pt"
              ? "Clique nos nós para explorar. Use o scroll para zoom. Arraste para mover."
              : "Click nodes to explore. Scroll to zoom. Drag to pan."}
          </p>
        )}
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex-1 relative">
        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {loading
                ? locale === "pt"
                  ? "Buscando papers..."
                  : "Searching papers..."
                : locale === "pt"
                ? "Gerando mapa de conhecimento com IA..."
                : "Generating knowledge map with AI..."}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => handleSearch()}>
              {locale === "pt" ? "Tentar novamente" : "Try again"}
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && graphNodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Network className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center max-w-md">
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {locale === "pt" ? "Mapa de Conhecimento Interativo" : "Interactive Knowledge Map"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {locale === "pt"
                  ? "Busque um tema de pesquisa para visualizar automaticamente as conexões entre papers, autores, conceitos e metodologias."
                  : "Search a research topic to automatically visualize connections between papers, authors, concepts, and methodologies."}
              </p>
            </div>
          </div>
        )}

        {/* Graph */}
        {graphNodes.length > 0 && !isLoading && (
          <KnowledgeGraphView
            nodes={graphNodes}
            edges={graphEdges}
            clusters={graphClusters}
            onNodeClick={handleNodeClick}
            width={dimensions.width}
            height={dimensions.height}
          />
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph;
