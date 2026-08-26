import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Users, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";

interface AuthorNode {
  id: string;
  label: string;
  paperCount: number;
  x?: number;
  y?: number;
}

interface CoauthorEdge {
  source: string;
  target: string;
  weight: number;
  sharedPapers: string[];
}

const CoauthorshipNetwork = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const { user } = useAuth();
  const fgRef = useRef<ForceGraphMethods | undefined>();

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorNode | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchPapers();
  }, [user]);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const fetchPapers = async () => {
    setLoading(true);
    // Get papers from saved_searches
    const { data: searches } = await supabase
      .from("saved_searches")
      .select("papers")
      .order("created_at", { ascending: false })
      .limit(50);

    const allPapers: any[] = [];
    if (searches) {
      for (const s of searches) {
        if (Array.isArray(s.papers)) allPapers.push(...s.papers);
      }
    }

    // Also get from papers table
    const { data: dbPapers } = await supabase
      .from("papers")
      .select("title, authors, year, doi")
      .limit(500);

    if (dbPapers) allPapers.push(...dbPapers);

    // Deduplicate by DOI or title
    const seen = new Set<string>();
    const unique = allPapers.filter((p) => {
      const key = p.doi || p.title?.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setPapers(unique);
    setLoading(false);
  };

  const normalizeAuthor = (a: any): string => {
    const name = typeof a === "string" ? a : a?.name || a?.lastName || "";
    return name.trim().replace(/\s+/g, " ");
  };

  const { nodes, edges, authorMap } = useMemo(() => {
    const authorPapers: Record<string, { count: number; papers: string[] }> = {};
    const edgeMap: Record<string, { weight: number; sharedPapers: string[] }> = {};

    for (const paper of papers) {
      const authors = Array.isArray(paper.authors)
        ? paper.authors.map(normalizeAuthor).filter(Boolean)
        : [];
      const pTitle = paper.title || "?";

      for (const a of authors) {
        if (!authorPapers[a]) authorPapers[a] = { count: 0, papers: [] };
        authorPapers[a].count++;
        authorPapers[a].papers.push(pTitle);
      }

      // Create edges between co-authors
      for (let i = 0; i < authors.length; i++) {
        for (let j = i + 1; j < authors.length; j++) {
          const key = [authors[i], authors[j]].sort().join("|||");
          if (!edgeMap[key]) edgeMap[key] = { weight: 0, sharedPapers: [] };
          edgeMap[key].weight++;
          edgeMap[key].sharedPapers.push(pTitle);
        }
      }
    }

    // Filter by search
    const filteredAuthors = searchFilter
      ? Object.keys(authorPapers).filter((a) => a.toLowerCase().includes(searchFilter.toLowerCase()))
      : Object.keys(authorPapers);

    // If filtering, include co-authors of matched authors
    const includedAuthors = new Set(filteredAuthors);
    if (searchFilter) {
      for (const key of Object.keys(edgeMap)) {
        const [a, b] = key.split("|||");
        if (includedAuthors.has(a)) includedAuthors.add(b);
        if (includedAuthors.has(b)) includedAuthors.add(a);
      }
    }

    // Limit to top authors by paper count if too many
    let finalAuthors = Array.from(includedAuthors);
    if (finalAuthors.length > 200) {
      finalAuthors.sort((a, b) => (authorPapers[b]?.count || 0) - (authorPapers[a]?.count || 0));
      finalAuthors = finalAuthors.slice(0, 200);
    }

    const authorSet = new Set(finalAuthors);

    const nodes: AuthorNode[] = finalAuthors.map((a) => ({
      id: a,
      label: a,
      paperCount: authorPapers[a]?.count || 0,
    }));

    const edges: CoauthorEdge[] = [];
    for (const [key, val] of Object.entries(edgeMap)) {
      const [a, b] = key.split("|||");
      if (authorSet.has(a) && authorSet.has(b)) {
        edges.push({ source: a, target: b, weight: val.weight, sharedPapers: val.sharedPapers });
      }
    }

    return { nodes, edges, authorMap: authorPapers };
  }, [papers, searchFilter]);

  const graphData = useMemo(() => ({ nodes: [...nodes], links: [...edges] }), [nodes, edges]);

  const nodeColor = useCallback((node: any) => {
    const n = node as AuthorNode;
    if (selectedAuthor?.id === n.id) return "#3b82f6";
    const count = n.paperCount || 1;
    if (count >= 10) return "#f59e0b";
    if (count >= 5) return "#10b981";
    if (count >= 3) return "#6366f1";
    return "#64748b";
  }, [selectedAuthor]);

  const nodeSize = useCallback((node: any) => {
    const n = node as AuthorNode;
    return Math.min(3 + Math.log2((n.paperCount || 1) + 1) * 3, 18);
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedAuthor(node as AuthorNode);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">
          {pt ? "Rede de Coautorias" : "Co-authorship Network"}
        </h1>
        <Badge variant="secondary" className="ml-auto">
          {nodes.length} {pt ? "autores" : "authors"} · {edges.length} {pt ? "conexões" : "connections"}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={pt ? "Filtrar por autor..." : "Filter by author..."}
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Graph */}
        <div ref={containerRef} className="flex-1 rounded-xl border border-border/40 bg-card/30 overflow-hidden">
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Info className="h-8 w-8" />
              <p className="text-sm">
                {pt
                  ? "Nenhum dado de coautoria encontrado. Faça buscas de artigos primeiro."
                  : "No co-authorship data found. Search for papers first."}
              </p>
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={containerSize.w}
              height={containerSize.h}
              nodeLabel={(n: any) => `${n.label} (${n.paperCount} ${pt ? "artigos" : "papers"})`}
              nodeColor={nodeColor}
              nodeVal={nodeSize}
              nodeCanvasObjectMode={() => "after"}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                if (globalScale < 1.5 && (node as AuthorNode).paperCount < 3) return;
                const label = (node as AuthorNode).label;
                const fontSize = Math.max(10 / globalScale, 1.5);
                ctx.font = `${fontSize}px sans-serif`;
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                const short = label.length > 20 ? label.slice(0, 18) + "…" : label;
                ctx.fillText(short, node.x!, node.y! + nodeSize(node) / globalScale + 2);
              }}
              linkColor={() => "rgba(100,116,139,0.25)"}
              linkWidth={(link: any) => Math.min(0.5 + (link as CoauthorEdge).weight * 0.5, 4)}
              onNodeClick={handleNodeClick}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedAuthor && (
          <Card className="w-72 shrink-0 p-4 overflow-y-auto max-h-full space-y-3">
            <h3 className="font-semibold text-foreground truncate">{selectedAuthor.label}</h3>
            <p className="text-sm text-muted-foreground">
              {selectedAuthor.paperCount} {pt ? "artigos indexados" : "indexed papers"}
            </p>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{pt ? "Coautores" : "Co-authors"}</p>
              <div className="flex flex-wrap gap-1">
                {edges
                  .filter((e) => {
                    const s = typeof e.source === "string" ? e.source : (e.source as any).id;
                    const t = typeof e.target === "string" ? e.target : (e.target as any).id;
                    return s === selectedAuthor.id || t === selectedAuthor.id;
                  })
                  .sort((a, b) => b.weight - a.weight)
                  .slice(0, 20)
                  .map((e, i) => {
                    const s = typeof e.source === "string" ? e.source : (e.source as any).id;
                    const t = typeof e.target === "string" ? e.target : (e.target as any).id;
                    const other = s === selectedAuthor.id ? t : s;
                    return (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px] cursor-pointer hover:bg-primary/20"
                        onClick={() => {
                          const n = nodes.find((nd) => nd.id === other);
                          if (n) setSelectedAuthor(n);
                        }}
                      >
                        {other.length > 25 ? other.slice(0, 23) + "…" : other} ({e.weight})
                      </Badge>
                    );
                  })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{pt ? "Artigos" : "Papers"}</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {(authorMap[selectedAuthor.id]?.papers || []).slice(0, 15).map((title, i) => (
                  <li key={i} className="text-xs text-foreground/80 leading-tight">
                    • {title.length > 80 ? title.slice(0, 78) + "…" : title}
                  </li>
                ))}
              </ul>
            </div>

            <LinkToProjectButton
              resourceType="coauthorship"
              resourceId={selectedAuthor.id}
              label={selectedAuthor.label}
              metadata={{ paperCount: selectedAuthor.paperCount }}
              variant="outline"
              size="sm"
            />

            <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedAuthor(null)}>
              {pt ? "Fechar" : "Close"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CoauthorshipNetwork;
