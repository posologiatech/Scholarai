import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { UpgradeGate } from "@/components/app/UpgradeGate";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/knowledge-graph/KnowledgeGraphView";
import PaperListPanel from "@/components/knowledge-graph/PaperListPanel";
import PaperDetailPanel from "@/components/knowledge-graph/PaperDetailPanel";

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

interface AINode {
  id: string;
  label: string;
  year?: number;
  citationCount?: number;
  paperIndex?: number;
  similarity?: number;
  tldr?: string;
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
  const [priorWorks, setPriorWorks] = useState<number[]>([]);
  const [derivativeWorks, setDerivativeWorks] = useState<number[]>([]);
  const [tldrs, setTldrs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaperIndex, setSelectedPaperIndex] = useState<number | null>(null);

  const centerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });

  // Measure center panel
  useEffect(() => {
    const measure = () => {
      if (centerRef.current) {
        const rect = centerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(300, rect.width), height: Math.max(300, rect.height) });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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
    setPriorWorks([]);
    setDerivativeWorks([]);
    setTldrs({});
    setSelectedPaperIndex(null);

    try {
      const searchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-papers`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(searchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: searchTerm, limit: 20 }),
      });

      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      const fetchedPapers: Paper[] = data.papers || [];
      setPapers(fetchedPapers);

      if (fetchedPapers.length === 0) {
        setError(locale === "pt" ? "Nenhum paper encontrado." : "No papers found.");
        setLoading(false);
        return;
      }

      setLoading(false);
      setGraphLoading(true);

      const graphUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-knowledge-graph`;
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) throw new Error("Not authenticated");

      const graphResp = await fetch(graphUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tk}`,
        },
        body: JSON.stringify({ papers: fetchedPapers, query: searchTerm, locale }),
      });

      if (!graphResp.ok) throw new Error("Graph generation failed");
      const graphData = await graphResp.json();
      if (graphData.error) throw new Error(graphData.error);

      // Map AI nodes to GraphNodes
      const aiNodes: AINode[] = graphData.nodes || [];
      const tldrMap: Record<number, string> = {};
      const gNodes: GraphNode[] = aiNodes.map((n) => {
        if (n.tldr && n.paperIndex !== undefined) tldrMap[n.paperIndex] = n.tldr;
        return {
          id: n.id,
          label: n.label,
          year: n.year,
          citationCount: n.citationCount,
          paperIndex: n.paperIndex,
          similarity: n.similarity,
          isOrigin: n.paperIndex === 0,
        };
      });

      setGraphNodes(gNodes);
      setGraphEdges(graphData.edges || []);
      setPriorWorks(graphData.priorWorks || []);
      setDerivativeWorks(graphData.derivativeWorks || []);
      setTldrs(tldrMap);

      if (!q) {
        navigate(`/knowledge-graph?q=${encodeURIComponent(searchTerm)}`, { replace: true });
      }
    } catch (err: any) {
      console.error("Knowledge graph error:", err);
      setError(err.message || "Failed");
      toast.error(locale === "pt" ? "Erro ao gerar o mapa" : "Failed to generate map");
    } finally {
      setLoading(false);
      setGraphLoading(false);
    }
  };

  // Path highlighting: BFS from selected node to origin
  const highlightPath = useMemo(() => {
    if (selectedPaperIndex === null || selectedPaperIndex === 0) return new Set<string>();
    const selectedId = `p${selectedPaperIndex}`;
    const originId = "p0";
    if (!graphNodes.find(n => n.id === selectedId)) return new Set<string>();

    // Build adjacency
    const adj: Record<string, string[]> = {};
    graphEdges.forEach(e => {
      const s = typeof e.source === "string" ? e.source : e.source.id;
      const t = typeof e.target === "string" ? e.target : e.target.id;
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push(t);
      adj[t].push(s);
    });

    // BFS
    const visited: Record<string, string | null> = { [selectedId]: null };
    const queue = [selectedId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === originId) break;
      for (const nb of adj[cur] || []) {
        if (!(nb in visited)) {
          visited[nb] = cur;
          queue.push(nb);
        }
      }
    }

    if (!(originId in visited)) return new Set<string>();

    const path = new Set<string>();
    let cur: string | null = originId;
    while (cur !== null) {
      path.add(cur);
      cur = visited[cur];
    }
    return path;
  }, [selectedPaperIndex, graphNodes, graphEdges]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedPaperIndex(node.paperIndex ?? null);
  }, []);

  const handleSelectPaper = useCallback((index: number) => {
    setSelectedPaperIndex(index);
  }, []);

  const selectedPaper = selectedPaperIndex !== null ? papers[selectedPaperIndex] : null;
  const selectedTldr = selectedPaperIndex !== null ? tldrs[selectedPaperIndex] : undefined;
  const isLoading = loading || graphLoading;
  const hasGraph = graphNodes.length > 0 && !isLoading;

  return (
    <UpgradeGate feature="knowledge_graph">
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur-sm px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Network className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-display font-bold text-foreground">
            {locale === "pt" ? "Connected Papers" : "Connected Papers"}
          </h1>
          {papers.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {papers.length} papers
            </Badge>
          )}
        </div>
        <div className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={locale === "pt" ? "Busque por título ou DOI..." : "Search by title or DOI..."}
              className="pl-8 h-8 text-xs"
              disabled={isLoading}
            />
          </div>
          <Button size="sm" onClick={() => handleSearch()} disabled={isLoading || !searchQuery.trim()} className="h-8 text-xs">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{locale === "pt" ? "Gerar" : "Generate"}</span>
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel - paper list */}
        {hasGraph && (
          <div className="w-60 shrink-0 min-h-0">
            <PaperListPanel
              papers={papers}
              originIndex={0}
              priorWorkIndices={priorWorks}
              derivativeWorkIndices={derivativeWorks}
              selectedPaperIndex={selectedPaperIndex}
              onSelectPaper={handleSelectPaper}
              locale={locale}
            />
          </div>
        )}

        {/* Center panel - graph */}
        <div ref={centerRef} className="flex-1 relative min-h-0">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-background/80 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                {loading
                  ? locale === "pt" ? "Buscando papers..." : "Searching papers..."
                  : locale === "pt" ? "Gerando grafo com IA..." : "Generating graph with AI..."}
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => handleSearch()}>
                {locale === "pt" ? "Tentar novamente" : "Try again"}
              </Button>
            </div>
          )}

          {!isLoading && !error && !hasGraph && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Network className="h-16 w-16 text-muted-foreground/30" />
              <div className="text-center max-w-md">
                <h2 className="text-base font-semibold text-foreground mb-1">
                  {locale === "pt" ? "Connected Papers" : "Connected Papers"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {locale === "pt"
                    ? "Busque um paper por título ou DOI para visualizar as conexões de similaridade entre papers relacionados."
                    : "Search a paper by title or DOI to visualize similarity connections between related papers."}
                </p>
              </div>
            </div>
          )}

          {hasGraph && (
            <KnowledgeGraphView
              nodes={graphNodes}
              edges={graphEdges}
              selectedNodeId={selectedPaperIndex !== null ? `p${selectedPaperIndex}` : null}
              highlightPath={highlightPath}
              onNodeClick={handleNodeClick}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>

        {/* Right panel - paper details */}
        {hasGraph && (
          <div className="w-72 shrink-0 min-h-0">
            <PaperDetailPanel
              paper={selectedPaper}
              tldr={selectedTldr}
              isOrigin={selectedPaperIndex === 0}
              locale={locale}
            />
          </div>
        )}
      </div>
    </div>
    </UpgradeGate>
  );
};

export default KnowledgeGraph;
