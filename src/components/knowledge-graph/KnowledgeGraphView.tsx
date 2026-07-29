import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export interface GraphNode {
  id: string;
  label: string;
  year?: number;
  citationCount?: number;
  paperIndex?: number;
  similarity?: number | null;
  tldr?: string;
  isOrigin?: boolean;
  hasRealCitationData?: boolean;
  // Force-graph internal
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  weight?: number;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  highlightPath?: Set<string>;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  width?: number;
  height?: number;
  yearRange?: [number, number];
}

// Color gradient: light beige (old) → dark green (recent) — Connected Papers style
function yearToColor(year: number | undefined, minYear: number, maxYear: number): string {
  if (!year || minYear === maxYear) return "#8fbc8f";
  const t = (year - minYear) / (maxYear - minYear);
  // beige → olive → dark green
  const r = Math.round(210 - t * 170);
  const g = Math.round(190 - t * 60);
  const b = Math.round(140 - t * 110);
  return `rgb(${r},${g},${b})`;
}

function citationToSize(count: number | undefined): number {
  if (!count || count <= 0) return 5;
  return Math.min(4 + Math.log2(count + 1) * 2.5, 20);
}

const KnowledgeGraphView = ({
  nodes,
  edges,
  selectedNodeId,
  highlightPath,
  onNodeClick,
  onNodeHover,
  width = 800,
  height = 600,
  yearRange,
}: Props) => {
  const fgRef = useRef<ForceGraphMethods | undefined>();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [minYear, maxYear] = useMemo(() => {
    if (yearRange) return yearRange;
    const years = nodes.map(n => n.year).filter(Boolean) as number[];
    if (years.length === 0) return [2000, 2025];
    return [Math.min(...years), Math.max(...years)];
  }, [nodes, yearRange]);

  const graphData = useMemo(
    () => ({ nodes: [...nodes], links: [...edges] }),
    [nodes, edges]
  );

  // Zoom
  const handleZoomIn = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300);
  const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300);
  const handleFitView = () => fgRef.current?.zoomToFit(400, 40);

  useEffect(() => {
    const timer = setTimeout(() => fgRef.current?.zoomToFit(400, 60), 600);
    return () => clearTimeout(timer);
  }, [nodes]);

  // Center on selected node
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node?.x !== undefined && node?.y !== undefined) {
        fgRef.current?.centerAt(node.x, node.y, 400);
      }
    }
  }, [selectedNodeId, nodes]);

  const handleClick = useCallback((node: any) => {
    onNodeClick?.(node as GraphNode);
  }, [onNodeClick]);

  const handleHover = useCallback((node: any) => {
    setHoveredId(node ? (node as GraphNode).id : null);
    onNodeHover?.(node as GraphNode | null);
  }, [onNodeHover]);

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const size = citationToSize(n.citationCount);
      const color = yearToColor(n.year, minYear, maxYear);
      const isHovered = hoveredId === n.id;
      const isSelected = selectedNodeId === n.id;
      const isOrigin = n.isOrigin;
      const isInPath = highlightPath?.has(n.id);
      const radius = size * (isHovered || isSelected ? 1.3 : 1);

      // Glow for path highlight
      if (isInPath) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
        ctx.fill();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered || isSelected || isInPath ? 1 : 0.85;
      ctx.fill();

      // Origin border (purple)
      if (isOrigin) {
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isInPath) {
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Label on zoom or hover
      if (globalScale > 1.5 || isHovered || isSelected) {
        const label = n.label.length > 35 ? n.label.slice(0, 33) + "…" : n.label;
        const fontSize = Math.max(10 / globalScale, 2.5);
        ctx.font = `${isHovered || isSelected ? "bold " : ""}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const textWidth = ctx.measureText(label).width;
        const bgPad = 2 / globalScale;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
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
    [hoveredId, selectedNodeId, highlightPath, minYear, maxYear]
  );

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source?.id;
      const targetId = typeof link.target === "string" ? link.target : link.target?.id;
      const inPath = highlightPath?.has(sourceId) && highlightPath?.has(targetId);

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.strokeStyle = inPath ? "rgba(168, 85, 247, 0.6)" : "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = inPath ? 2 : Math.max(0.5, (link.weight || 30) / 60);
      ctx.stroke();
    },
    [highlightPath]
  );

  // Timeline bar
  const timelineYears = useMemo(() => {
    const years: Record<number, number> = {};
    nodes.forEach(n => {
      if (n.year) years[n.year] = (years[n.year] || 0) + 1;
    });
    return Object.entries(years)
      .map(([y, c]) => ({ year: Number(y), count: c }))
      .sort((a, b) => a.year - b.year);
  }, [nodes]);

  const maxCount = Math.max(1, ...timelineYears.map(t => t.count));

  return (
    <div className="relative w-full h-full bg-card overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <Button size="icon" variant="secondary" className="h-7 w-7 bg-card/90 backdrop-blur-sm shadow-md" onClick={handleZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="secondary" className="h-7 w-7 bg-card/90 backdrop-blur-sm shadow-md" onClick={handleZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="secondary" className="h-7 w-7 bg-card/90 backdrop-blur-sm shadow-md" onClick={handleFitView}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Year color legend */}
      <div className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg shadow-md px-3 py-2">
        <p className="text-[10px] font-medium text-muted-foreground mb-1">Ano de publicação</p>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{minYear}</span>
          <div
            className="h-2.5 w-20 rounded-full"
            style={{
              background: `linear-gradient(to right, ${yearToColor(minYear, minYear, maxYear)}, ${yearToColor(maxYear, minYear, maxYear)})`,
            }}
          />
          <span className="text-[10px] text-muted-foreground">{maxYear}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-purple-500 bg-transparent" />
          <span className="text-[10px] text-muted-foreground">Origin paper</span>
        </div>
      </div>

      {/* Graph */}
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={width}
        height={height - (timelineYears.length > 1 ? 40 : 0)}
        backgroundColor="transparent"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          const size = citationToSize((node as GraphNode).citationCount);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size * 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkCanvasObject={paintLink}
        onNodeClick={handleClick}
        onNodeHover={handleHover}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}
      />

      {/* Timeline bar */}
      {timelineYears.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-card/90 backdrop-blur-sm border-t border-border/40 flex items-end px-4 gap-px">
          {timelineYears.map(({ year, count }) => (
            <div key={year} className="flex flex-col items-center flex-1 min-w-0">
              <div
                className="w-full max-w-3 rounded-t-sm"
                style={{
                  height: `${Math.max(4, (count / maxCount) * 24)}px`,
                  backgroundColor: yearToColor(year, minYear, maxYear),
                  opacity: 0.8,
                }}
              />
              <span className="text-[8px] text-muted-foreground truncate leading-none mt-0.5">
                {year.toString().slice(-2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphView;
