import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ZoomIn, ZoomOut, Maximize2, Filter, Eye, EyeOff, Info, X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface GraphNode {
  id: string;
  type: "paper" | "author" | "concept" | "method";
  label: string;
  year?: number;
  citationCount?: number;
  cluster?: string;
  paperIndex?: number;
  paperCount?: number;
  // Force-graph internal
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "cites" | "authored" | "discusses" | "uses_method" | "related";
}

export interface GraphCluster {
  id: string;
  label: string;
  conceptCount?: number;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  onNodeClick?: (node: GraphNode) => void;
  width?: number;
  height?: number;
}

const CLUSTER_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  orange: "#f97316",
  red: "#ef4444",
  cyan: "#06b6d4",
  pink: "#ec4899",
  yellow: "#eab308",
};

const TYPE_SHAPES: Record<string, string> = {
  paper: "circle",
  author: "diamond",
  concept: "hexagon",
  method: "square",
};

const TYPE_COLORS: Record<string, string> = {
  paper: "#3b82f6",
  author: "#8b5cf6",
  concept: "#f59e0b",
  method: "#10b981",
};

const TYPE_SIZES: Record<string, number> = {
  paper: 6,
  author: 7,
  concept: 10,
  method: 8,
};

const EDGE_COLORS: Record<string, string> = {
  cites: "#94a3b8",
  authored: "#c084fc",
  discusses: "#fbbf24",
  uses_method: "#34d399",
  related: "#fb923c",
};

const KnowledgeGraphView = ({
  nodes,
  edges,
  clusters,
  onNodeClick,
  width = 800,
  height = 600,
}: Props) => {
  const fgRef = useRef<ForceGraphMethods | undefined>();
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(["paper", "author", "concept", "method"])
  );
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<string>>(
    new Set(["cites", "authored", "discusses", "uses_method", "related"])
  );

  // Filter nodes and edges
  const filteredNodes = useMemo(
    () => nodes.filter((n) => visibleTypes.has(n.type)),
    [nodes, visibleTypes]
  );
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );
  const filteredEdges = useMemo(
    () =>
      edges.filter((e) => {
        const sid = typeof e.source === "string" ? e.source : e.source.id;
        const tid = typeof e.target === "string" ? e.target : e.target.id;
        return (
          visibleEdgeTypes.has(e.type) &&
          filteredNodeIds.has(sid) &&
          filteredNodeIds.has(tid)
        );
      }),
    [edges, visibleEdgeTypes, filteredNodeIds]
  );

  const graphData = useMemo(
    () => ({ nodes: filteredNodes, links: filteredEdges }),
    [filteredNodes, filteredEdges]
  );

  // Zoom controls
  const handleZoomIn = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300);
  const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300);
  const handleFitView = () => fgRef.current?.zoomToFit(400, 40);

  useEffect(() => {
    // Fit view after initial render
    const timer = setTimeout(() => fgRef.current?.zoomToFit(400, 60), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNode(node as GraphNode);
      onNodeClick?.(node as GraphNode);
      // Center on node
      fgRef.current?.centerAt(node.x, node.y, 300);
      fgRef.current?.zoom(3, 300);
    },
    [onNodeClick]
  );

  // Custom node rendering
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const size = TYPE_SIZES[n.type] || 6;
      const color = n.cluster
        ? CLUSTER_COLORS[n.cluster] || TYPE_COLORS[n.type]
        : TYPE_COLORS[n.type];
      const isHovered = hoveredNode?.id === n.id;
      const isSelected = selectedNode?.id === n.id;
      const radius = size * (isHovered || isSelected ? 1.4 : 1);

      ctx.beginPath();

      if (n.type === "concept") {
        // Hexagon
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const x = node.x + radius * Math.cos(angle);
          const y = node.y + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else if (n.type === "method") {
        // Square
        ctx.rect(node.x - radius, node.y - radius, radius * 2, radius * 2);
      } else if (n.type === "author") {
        // Diamond
        ctx.moveTo(node.x, node.y - radius * 1.2);
        ctx.lineTo(node.x + radius, node.y);
        ctx.lineTo(node.x, node.y + radius * 1.2);
        ctx.lineTo(node.x - radius, node.y);
        ctx.closePath();
      } else {
        // Circle for papers
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered || isSelected ? 1 : 0.85;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Label
      if (globalScale > 1.2 || isHovered || isSelected) {
        const label = n.label.length > 30 ? n.label.slice(0, 28) + "…" : n.label;
        const fontSize = Math.max(10 / globalScale, 2.5);
        ctx.font = `${isHovered || isSelected ? "bold " : ""}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.9)";

        // Background for text
        const textWidth = ctx.measureText(label).width;
        const bgPad = 2 / globalScale;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(
          node.x - textWidth / 2 - bgPad,
          node.y + radius + 2 / globalScale,
          textWidth + bgPad * 2,
          fontSize + bgPad * 2
        );

        ctx.fillStyle = "#fff";
        ctx.fillText(label, node.x, node.y + radius + 2 / globalScale + bgPad);
      }
    },
    [hoveredNode, selectedNode]
  );

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleEdgeType = (type: string) => {
    setVisibleEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="relative w-full rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <Button size="icon" variant="secondary" className="h-8 w-8 bg-card/90 backdrop-blur-sm shadow-md" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-8 w-8 bg-card/90 backdrop-blur-sm shadow-md" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-8 w-8 bg-card/90 backdrop-blur-sm shadow-md" onClick={handleFitView}>
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={showFilters ? "default" : "secondary"}
          className="h-8 w-8 bg-card/90 backdrop-blur-sm shadow-md"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute top-3 left-14 z-10 w-56 bg-card/95 backdrop-blur-sm border border-border/60 rounded-lg shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Filtros</span>
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setShowFilters(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tipos de nó</p>
            {(["paper", "author", "concept", "method"] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={visibleTypes.has(type)}
                  onCheckedChange={() => toggleType(type)}
                  className="h-3.5 w-3.5"
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                <span className="capitalize">{type === "paper" ? "Papers" : type === "author" ? "Autores" : type === "concept" ? "Conceitos" : "Métodos"}</span>
              </label>
            ))}

            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-3">Tipos de conexão</p>
            {(["cites", "authored", "discusses", "uses_method", "related"] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={visibleEdgeTypes.has(type)}
                  onCheckedChange={() => toggleEdgeType(type)}
                  className="h-3.5 w-3.5"
                />
                <span
                  className="inline-block h-2 w-4 rounded-sm"
                  style={{ backgroundColor: EDGE_COLORS[type] }}
                />
                <span className="capitalize">{type.replace("_", " ")}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Cluster legend */}
      {clusters.length > 0 && (
        <div className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg shadow-md p-2.5 max-w-48">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Clusters</p>
          <div className="space-y-1">
            {clusters.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CLUSTER_COLORS[c.id] || "#888" }}
                />
                <span className="text-[11px] text-foreground truncate">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Node detail panel */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border/60 rounded-lg shadow-lg p-3 w-64">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Badge
                variant="secondary"
                className="text-[10px] mb-1"
                style={{
                  backgroundColor: TYPE_COLORS[selectedNode.type] + "20",
                  color: TYPE_COLORS[selectedNode.type],
                }}
              >
                {selectedNode.type}
              </Badge>
              <p className="text-sm font-medium text-foreground leading-tight truncate">
                {selectedNode.label}
              </p>
              {selectedNode.year && (
                <p className="text-xs text-muted-foreground mt-0.5">{selectedNode.year}</p>
              )}
              {selectedNode.citationCount !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {selectedNode.citationCount} citações
                </p>
              )}
              {selectedNode.paperCount !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {selectedNode.paperCount} papers
                </p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0"
              onClick={() => setSelectedNode(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="absolute bottom-3 left-3 z-10 flex gap-1.5">
        <Badge variant="secondary" className="text-[10px] bg-card/90 backdrop-blur-sm shadow-sm">
          {filteredNodes.length} nós
        </Badge>
        <Badge variant="secondary" className="text-[10px] bg-card/90 backdrop-blur-sm shadow-sm">
          {filteredEdges.length} conexões
        </Badge>
      </div>

      {/* Graph */}
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="transparent"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          const size = TYPE_SIZES[(node as GraphNode).type] || 6;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size * 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) => setHoveredNode(node as GraphNode | null)}
        linkColor={(link: any) => EDGE_COLORS[link.type] || "#555"}
        linkWidth={(link: any) => (link.type === "related" ? 1.5 : 1)}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.15}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}
      />
    </div>
  );
};

export default KnowledgeGraphView;
