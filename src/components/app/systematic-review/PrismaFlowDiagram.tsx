import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useRef } from "react";

interface PrismaFlowDiagramProps {
  identified: number;
  duplicatesRemoved: number;
  screened: number;
  excludedScreening: number;
  includedFullText: number;
  excludedFullText: number;
  finalIncluded: number;
  excludedReasons?: Record<string, number>;
}

const PrismaFlowDiagram = ({
  identified,
  duplicatesRemoved,
  screened,
  excludedScreening,
  includedFullText,
  excludedFullText,
  finalIncluded,
  excludedReasons,
}: PrismaFlowDiagramProps) => {
  const { locale } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);

  const pt = locale === "pt";

  // A "full-text assessed" stage is only real if this review actually ran a distinct
  // eligibility pass after screening — otherwise it's just the same count as "included"
  // wearing a different label, which misrepresents the pipeline as having a stage it
  // doesn't. When there's no distinct stage, screening flows straight into inclusion,
  // matching what PRISMA 2020 calls for when title/abstract screening is the only pass.
  const hasDistinctFullTextStage = excludedFullText > 0 || includedFullText !== finalIncluded;

  const exportAsPNG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = 700 * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.download = "prisma-flow-diagram.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const exportAsSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.download = "prisma-flow-diagram.svg";
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Layout constants — rows are laid out dynamically so a skipped stage collapses the
  // gap instead of leaving a redundant box or a blank space where it used to be.
  const W = 700;
  const boxW = 180;
  const boxH = 50;
  const sideBoxW = 160;
  const sideBoxH = 44;
  const centerX = W / 2;
  const rowGap = 90;

  const rowCount = hasDistinctFullTextStage ? 5 : 4; // identified, dedup, screened, [fulltext], included
  const row1Y = 30;
  const row2Y = row1Y + rowGap;
  const row3Y = row2Y + rowGap;
  const row4Y = row3Y + rowGap; // full-text stage, when present
  const row5Y = (hasDistinctFullTextStage ? row4Y : row3Y) + rowGap; // final included
  const H = row1Y + rowCount * rowGap + 60;

  const Box = ({
    x,
    y,
    w,
    h,
    label,
    value,
    color = "#f0f4f8",
    borderColor = "#94a3b8",
    labelColor = "#64748b",
    valueColor = "#1e293b",
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    value: string;
    color?: string;
    borderColor?: string;
    labelColor?: string;
    valueColor?: string;
  }) => (
    <g>
      <rect
        x={x - w / 2}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={color}
        stroke={borderColor}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 18}
        textAnchor="middle"
        fontSize={11}
        fill={labelColor}
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 36}
        textAnchor="middle"
        fontSize={16}
        fontWeight="bold"
        fill={valueColor}
        fontFamily="system-ui, sans-serif"
      >
        {value}
      </text>
    </g>
  );

  const Arrow = ({
    x1,
    y1,
    x2,
    y2,
  }: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#94a3b8"
      strokeWidth={1.5}
      markerEnd="url(#arrowhead)"
    />
  );

  const SideArrow = ({
    fromX,
    fromY,
    toX,
    toY,
  }: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }) => (
    <polyline
      points={`${fromX},${fromY} ${(fromX + toX) / 2},${fromY} ${(fromX + toX) / 2},${toY} ${toX},${toY}`}
      fill="none"
      stroke="#94a3b8"
      strokeWidth={1.5}
      markerEnd="url(#arrowhead)"
    />
  );

  // Phase labels
  const phaseX = 55;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {pt ? "Diagrama PRISMA 2020" : "PRISMA 2020 Flow Diagram"}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportAsSVG} className="gap-1.5 text-xs">
            <Download className="h-3 w-3" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={exportAsPNG} className="gap-1.5 text-xs">
            <Download className="h-3 w-3" />
            PNG
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="auto"
          xmlns="http://www.w3.org/2000/svg"
          style={{ maxWidth: 700 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Phase labels */}
          <text x={phaseX} y={row1Y + 25} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#3b82f6" fontFamily="system-ui">
            {pt ? "IDENTIFICAÇÃO" : "IDENTIFICATION"}
          </text>
          <text x={phaseX} y={row3Y + 25} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#8b5cf6" fontFamily="system-ui">
            {pt ? "TRIAGEM" : "SCREENING"}
          </text>
          <text x={phaseX} y={row5Y + 25} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#10b981" fontFamily="system-ui">
            {pt ? "INCLUSÃO" : "INCLUDED"}
          </text>

          {/* Row 1: Identified */}
          <Box
            x={centerX}
            y={row1Y}
            w={boxW}
            h={boxH}
            label={pt ? "Artigos identificados" : "Records identified"}
            value={`n = ${identified}`}
            color="#eff6ff"
            borderColor="#93c5fd"
          />

          <Arrow x1={centerX} y1={row1Y + boxH} x2={centerX} y2={row2Y} />

          {/* Row 2: After dedup */}
          <Box
            x={centerX}
            y={row2Y}
            w={boxW}
            h={boxH}
            label={pt ? "Após remoção de duplicatas" : "After deduplication"}
            value={`n = ${identified - duplicatesRemoved}`}
          />

          {/* Side: duplicates removed */}
          {duplicatesRemoved > 0 && (
            <>
              <SideArrow
                fromX={centerX + boxW / 2}
                fromY={row2Y + boxH / 2}
                toX={centerX + boxW / 2 + 40 + sideBoxW / 2}
                toY={row2Y + boxH / 2}
              />
              <Box
                x={centerX + boxW / 2 + 40 + sideBoxW / 2}
                y={row2Y + (boxH - sideBoxH) / 2}
                w={sideBoxW}
                h={sideBoxH}
                label={pt ? "Duplicatas removidas" : "Duplicates removed"}
                value={`n = ${duplicatesRemoved}`}
                color="#fef3c7"
                borderColor="#fbbf24"
              />
            </>
          )}

          <Arrow x1={centerX} y1={row2Y + boxH} x2={centerX} y2={row3Y} />

          {/* Row 3: Screened */}
          <Box
            x={centerX}
            y={row3Y}
            w={boxW}
            h={boxH}
            label={pt ? "Artigos triados" : "Records screened"}
            value={`n = ${screened}`}
            color="#f5f3ff"
            borderColor="#a78bfa"
          />

          {/* Side: excluded at screening */}
          {excludedScreening > 0 && (
            <>
              <SideArrow
                fromX={centerX + boxW / 2}
                fromY={row3Y + boxH / 2}
                toX={centerX + boxW / 2 + 40 + sideBoxW / 2}
                toY={row3Y + boxH / 2}
              />
              <Box
                x={centerX + boxW / 2 + 40 + sideBoxW / 2}
                y={row3Y + (boxH - sideBoxH) / 2}
                w={sideBoxW}
                h={sideBoxH}
                label={pt ? "Excluídos na triagem" : "Excluded at screening"}
                value={`n = ${excludedScreening}`}
                color="#fef2f2"
                borderColor="#fca5a5"
              />
            </>
          )}

          {hasDistinctFullTextStage ? (
            <>
              <Arrow x1={centerX} y1={row3Y + boxH} x2={centerX} y2={row4Y} />

              {/* Row 4: Full text assessed — only rendered when this review actually ran
                  a distinct eligibility pass; otherwise it would just repeat the next
                  box's number under a different label. */}
              <Box
                x={centerX}
                y={row4Y}
                w={boxW}
                h={boxH}
                label={pt ? "Texto completo avaliado" : "Full-text assessed"}
                value={`n = ${includedFullText}`}
                color="#f0fdf4"
                borderColor="#86efac"
              />

              {/* Side: excluded at full-text */}
              {excludedFullText > 0 && (
                <>
                  <SideArrow
                    fromX={centerX + boxW / 2}
                    fromY={row4Y + boxH / 2}
                    toX={centerX + boxW / 2 + 40 + sideBoxW / 2}
                    toY={row4Y + boxH / 2}
                  />
                  <Box
                    x={centerX + boxW / 2 + 40 + sideBoxW / 2}
                    y={row4Y + (boxH - sideBoxH) / 2}
                    w={sideBoxW}
                    h={sideBoxH}
                    label={pt ? "Excluídos texto completo" : "Excluded at full-text"}
                    value={`n = ${excludedFullText}`}
                    color="#fef2f2"
                    borderColor="#fca5a5"
                  />
                </>
              )}

              <Arrow x1={centerX} y1={row4Y + boxH} x2={centerX} y2={row5Y} />
            </>
          ) : (
            // No distinct full-text stage in this pipeline — screening flows straight
            // into inclusion rather than through a phantom duplicate-count box.
            <Arrow x1={centerX} y1={row3Y + boxH} x2={centerX} y2={row5Y} />
          )}

          {/* Row 5: Final included */}
          <Box
            x={centerX}
            y={row5Y}
            w={boxW}
            h={boxH}
            label={pt ? "Estudos incluídos" : "Studies included"}
            value={`n = ${finalIncluded}`}
            color="#dcfce7"
            borderColor="#4ade80"
            valueColor="#166534"
          />

          {/* Exclusion reasons detail */}
          {excludedReasons && Object.keys(excludedReasons).length > 0 && (
            <g>
              {Object.entries(excludedReasons)
                .slice(0, 5)
                .map(([reason, count], i) => (
                  <text
                    key={reason}
                    x={centerX + boxW / 2 + 40 + sideBoxW / 2}
                    y={row3Y + (boxH - sideBoxH) / 2 + sideBoxH + 16 + i * 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#64748b"
                    fontFamily="system-ui"
                  >
                    {reason}: {count}
                  </text>
                ))}
            </g>
          )}

          {/* Caption */}
          <text
            x={centerX}
            y={row5Y + boxH + 30}
            textAnchor="middle"
            fontSize={10}
            fontStyle="italic"
            fill="#94a3b8"
            fontFamily="system-ui"
          >
            {pt
              ? "Figura 1. Diagrama de fluxo PRISMA 2020 da seleção dos estudos."
              : "Figure 1. PRISMA 2020 flow diagram of study selection."}
          </text>
        </svg>
      </div>
    </div>
  );
};

export default PrismaFlowDiagram;
