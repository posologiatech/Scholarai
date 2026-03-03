import { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Label, Cell,
  BarChart, Bar, ErrorBar, LabelList,
} from "recharts";

interface Study {
  name: string;
  effect: number;
  se: number;
  ci_lower: number;
  ci_upper: number;
  weight?: number;
  or?: number;
  rr?: number;
}

interface ForestPlotProps {
  studies: Study[];
  pooled: { pooled: number; ci_lower: number; ci_upper: number };
  effectType: string;
  pooledDisplay?: number;
  pooledCILower?: number;
  pooledCIUpper?: number;
}

interface FunnelPlotProps {
  studies: Study[];
  pooledEffect: number;
}

const effectLabel = (type: string) => {
  if (type === "cohens_d") return "Cohen's d";
  if (type === "odds_ratio") return "ln(OR)";
  if (type === "risk_ratio") return "ln(RR)";
  return "Effect";
};

export const ForestPlot = ({ studies, pooled, effectType, pooledDisplay, pooledCILower, pooledCIUpper }: ForestPlotProps) => {
  const isRatio = effectType === "odds_ratio" || effectType === "risk_ratio";
  const nullValue = isRatio ? 0 : 0; // ln(1)=0 for ratios

  const data = useMemo(() => {
    const items = studies.map((s, i) => ({
      name: s.name || `Study ${i + 1}`,
      effect: s.effect,
      ci_lower: s.ci_lower,
      ci_upper: s.ci_upper,
      errorLow: s.effect - (isRatio ? Math.log(s.ci_lower || 0.001) : s.ci_lower),
      errorHigh: (isRatio ? Math.log(s.ci_upper || 0.001) : s.ci_upper) - s.effect,
      display: isRatio ? (s.or || s.rr || Math.exp(s.effect)).toFixed(2) : s.effect.toFixed(2),
      ciDisplay: isRatio
        ? `${(s.ci_lower).toFixed(2)} – ${(s.ci_upper).toFixed(2)}`
        : `${s.ci_lower.toFixed(2)} – ${s.ci_upper.toFixed(2)}`,
      y: i,
    }));

    // Add pooled
    items.push({
      name: "Pooled (Random)",
      effect: pooled.pooled,
      ci_lower: pooled.ci_lower,
      ci_upper: pooled.ci_upper,
      errorLow: pooled.pooled - pooled.ci_lower,
      errorHigh: pooled.ci_upper - pooled.pooled,
      display: isRatio ? (pooledDisplay ?? Math.exp(pooled.pooled)).toFixed(2) : pooled.pooled.toFixed(2),
      ciDisplay: isRatio
        ? `${(pooledCILower ?? Math.exp(pooled.ci_lower)).toFixed(2)} – ${(pooledCIUpper ?? Math.exp(pooled.ci_upper)).toFixed(2)}`
        : `${pooled.ci_lower.toFixed(2)} – ${pooled.ci_upper.toFixed(2)}`,
      y: items.length,
    });

    return items;
  }, [studies, pooled, isRatio, pooledDisplay, pooledCILower, pooledCIUpper]);

  const height = Math.max(300, data.length * 40 + 80);

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-2">Forest Plot</h3>
      <div className="flex">
        {/* Study labels */}
        <div className="flex flex-col justify-center pr-2" style={{ paddingTop: 20, paddingBottom: 40 }}>
          {data.map((d, i) => (
            <div
              key={i}
              className={`text-xs truncate h-[32px] flex items-center ${
                i === data.length - 1 ? "font-bold text-primary" : "text-foreground"
              }`}
              style={{ maxWidth: 180, minWidth: 120 }}
              title={d.name}
            >
              {d.name}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ top: 20, right: 80, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                dataKey="effect"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={v => v.toFixed(1)}
              >
                <Label value={effectLabel(effectType)} position="bottom" offset={20} style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              </XAxis>
              <YAxis type="number" dataKey="y" hide domain={[-0.5, data.length - 0.5]} reversed />
              <ReferenceLine x={nullValue} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
                      <p className="font-semibold">{d.name}</p>
                      <p>Effect: {d.display}</p>
                      <p>95% CI: {d.ciDisplay}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={data}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={i === data.length - 1 ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                    r={i === data.length - 1 ? 8 : 5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Effect + CI labels */}
        <div className="flex flex-col justify-center pl-2" style={{ paddingTop: 20, paddingBottom: 40 }}>
          {data.map((d, i) => (
            <div
              key={i}
              className={`text-xs h-[32px] flex items-center whitespace-nowrap ${
                i === data.length - 1 ? "font-bold text-primary" : "text-muted-foreground"
              }`}
            >
              {d.display} [{d.ciDisplay}]
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const FunnelPlot = ({ studies, pooledEffect }: FunnelPlotProps) => {
  const data = useMemo(() =>
    studies.map((s, i) => ({
      name: s.name || `Study ${i + 1}`,
      effect: s.effect,
      se: s.se,
      precision: 1 / (s.se || 0.001),
    })),
    [studies]
  );

  const maxSE = Math.max(...data.map(d => d.se)) * 1.2;

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-2">Funnel Plot</h3>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            dataKey="effect"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={v => v.toFixed(2)}
          >
            <Label value="Effect Size" position="bottom" offset={20} style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          </XAxis>
          <YAxis
            type="number"
            dataKey="se"
            reversed
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            domain={[0, maxSE]}
            tickFormatter={v => v.toFixed(2)}
          >
            <Label value="Standard Error" angle={-90} position="left" offset={10} style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          </YAxis>
          <ReferenceLine x={pooledEffect} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
                  <p className="font-semibold">{d.name}</p>
                  <p>Effect: {d.effect.toFixed(3)}</p>
                  <p>SE: {d.se.toFixed(3)}</p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="hsl(var(--foreground))" r={5} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
