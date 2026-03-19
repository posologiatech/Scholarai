import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  stateAlertLevels: Record<string, string>;
  onStateClick?: (stateName: string) => void;
}

const ALERT_COLORS: Record<string, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#f59e0b",
  green: "#22c55e",
};

// Simplified Brazil UF SVG paths (approximate outlines)
const UF_PATHS: Record<string, { path: string; cx: number; cy: number; name: string }> = {
  AC: { path: "M45,215 L75,205 L85,220 L65,235 L40,230Z", cx: 62, cy: 220, name: "Acre" },
  AM: { path: "M75,145 L175,130 L185,180 L150,210 L85,220 L75,205Z", cx: 130, cy: 175, name: "Amazonas" },
  RR: { path: "M130,80 L165,75 L175,130 L140,135Z", cx: 152, cy: 105, name: "Roraima" },
  PA: { path: "M175,130 L310,120 L315,200 L240,210 L185,180Z", cx: 250, cy: 165, name: "Pará" },
  AP: { path: "M250,70 L290,65 L310,120 L270,115Z", cx: 280, cy: 92, name: "Amapá" },
  TO: { path: "M280,210 L315,200 L325,280 L290,290Z", cx: 302, cy: 245, name: "Tocantins" },
  MA: { path: "M310,120 L380,130 L370,200 L315,200Z", cx: 348, cy: 160, name: "Maranhão" },
  PI: { path: "M370,200 L380,130 L420,145 L400,230Z", cx: 393, cy: 180, name: "Piauí" },
  CE: { path: "M420,145 L460,140 L455,180 L425,190Z", cx: 440, cy: 163, name: "Ceará" },
  RN: { path: "M460,140 L490,148 L480,170 L455,165Z", cx: 472, cy: 155, name: "Rio Grande do Norte" },
  PB: { path: "M455,170 L490,172 L485,192 L450,188Z", cx: 470, cy: 180, name: "Paraíba" },
  PE: { path: "M420,190 L490,192 L485,212 L415,210Z", cx: 452, cy: 200, name: "Pernambuco" },
  AL: { path: "M460,212 L490,215 L488,230 L458,225Z", cx: 474, cy: 220, name: "Alagoas" },
  SE: { path: "M455,228 L478,232 L475,248 L452,242Z", cx: 465, cy: 237, name: "Sergipe" },
  BA: { path: "M325,280 L400,230 L460,235 L465,250 L440,340 L350,330Z", cx: 400, cy: 285, name: "Bahia" },
  MG: { path: "M340,330 L440,340 L445,400 L370,420 L325,390Z", cx: 390, cy: 370, name: "Minas Gerais" },
  ES: { path: "M445,370 L475,365 L470,400 L445,400Z", cx: 458, cy: 383, name: "Espírito Santo" },
  RJ: { path: "M420,400 L465,405 L455,430 L415,420Z", cx: 440, cy: 415, name: "Rio de Janeiro" },
  SP: { path: "M325,390 L420,400 L415,445 L340,455 L310,430Z", cx: 370, cy: 425, name: "São Paulo" },
  PR: { path: "M310,430 L380,450 L365,490 L290,475Z", cx: 335, cy: 460, name: "Paraná" },
  SC: { path: "M330,490 L375,490 L368,520 L325,515Z", cx: 348, cy: 505, name: "Santa Catarina" },
  RS: { path: "M290,510 L350,520 L340,580 L275,560Z", cx: 315, cy: 545, name: "Rio Grande do Sul" },
  MS: { path: "M240,340 L325,330 L310,430 L240,400Z", cx: 278, cy: 375, name: "Mato Grosso do Sul" },
  MT: { path: "M150,210 L280,210 L290,290 L325,330 L240,340 L175,280Z", cx: 235, cy: 270, name: "Mato Grosso" },
  GO: { path: "M290,290 L340,330 L370,420 L325,390 L310,430 L265,390 L240,340Z", cx: 305, cy: 360, name: "Goiás" },
  DF: { path: "M320,350 L340,345 L342,360 L322,365Z", cx: 331, cy: 355, name: "Distrito Federal" },
  RO: { path: "M85,220 L150,210 L175,280 L140,290 L95,265Z", cx: 130, cy: 250, name: "Rondônia" },
};

export default function BrazilSVGMap({ stateAlertLevels, onStateClick }: Props) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  const getColor = (name: string) => {
    const level = stateAlertLevels[name];
    if (level && ALERT_COLORS[level]) return ALERT_COLORS[level];
    return "hsl(var(--muted))";
  };

  return (
    <svg viewBox="20 50 500 560" className="w-full max-w-md mx-auto" style={{ aspectRatio: "500/560" }}>
      {Object.entries(UF_PATHS).map(([code, { path, cx, cy, name }]) => {
        const isHovered = hoveredState === code;
        const color = getColor(name);
        const level = stateAlertLevels[name];
        return (
          <Tooltip key={code}>
            <TooltipTrigger asChild>
              <g
                onMouseEnter={() => setHoveredState(code)}
                onMouseLeave={() => setHoveredState(null)}
                onClick={() => onStateClick?.(name)}
                className="cursor-pointer"
              >
                <path
                  d={path}
                  fill={color}
                  fillOpacity={isHovered ? 0.9 : 0.6}
                  stroke="hsl(var(--border))"
                  strokeWidth={isHovered ? 2 : 0.8}
                  className="transition-all duration-200"
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[8px] font-bold fill-foreground pointer-events-none select-none"
                  style={{ fontSize: "9px" }}
                >
                  {code}
                </text>
              </g>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-medium">{name}</p>
              {level && <p className="text-muted-foreground capitalize">Nível: {level}</p>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </svg>
  );
}
