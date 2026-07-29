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
  eggerP?: number;
  imputedPoints?: { effect: number; se: number }[];
}

interface SubgroupForestPlotProps {
  groups: {
    subgroup: string;
    n: number;
    random: { pooled: number; ci_lower: number; ci_upper: number };
  }[];
  effectType: string;
}

interface MetaRegressionScatterProps {
  studies: { name: string; effect: number; moderator?: number }[];
  slope: number;
  intercept: number;
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

export const FunnelPlot = ({ studies, pooledEffect, eggerP, imputedPoints }: FunnelPlotProps) => {
  const data = useMemo(() =>
    studies.map((s, i) => ({
      name: s.name || `Study ${i + 1}`,
      effect: s.effect,
      se: s.se,
      precision: 1 / (s.se || 0.001),
    })),
    [studies]
  );

  const imputedData = useMemo(() =>
    (imputedPoints || []).map((p, i) => ({ name: `Imputed ${i + 1}`, effect: p.effect, se: p.se })),
    [imputedPoints]
  );

  const maxSE = Math.max(...data.map(d => d.se), ...imputedData.map(d => d.se)) * 1.2;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Funnel Plot</h3>
        {eggerP !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${eggerP < 0.05 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
            Egger's p = {eggerP.toFixed(4)}
          </span>
        )}
      </div>
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
          {imputedData.length > 0 && (
            <Scatter data={imputedData} fill="transparent" stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" r={5} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      {imputedData.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {imputedData.length} {imputedData.length === 1 ? "imputed study" : "imputed studies"} (trim-and-fill, dashed circles)
        </p>
      )}
    </div>
  );
};

export const SubgroupForestPlot = ({ groups, effectType }: SubgroupForestPlotProps) => {
  const data = useMemo(() => groups.map((g, i) => ({
    name: g.subgroup,
    effect: g.random.pooled,
    ci_lower: g.random.ci_lower,
    ci_upper: g.random.ci_upper,
    display: g.random.pooled.toFixed(2),
    ciDisplay: `${g.random.ci_lower.toFixed(2)} – ${g.random.ci_upper.toFixed(2)}`,
    n: g.n,
    y: i,
  })), [groups]);

  const height = Math.max(220, data.length * 44 + 80);

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        {effectType === "cohens_d" ? "Subgroup Forest Plot" : "Subgroup Forest Plot (log scale)"}
      </h3>
      <div className="flex">
        <div className="flex flex-col justify-center pr-2" style={{ paddingTop: 20, paddingBottom: 40 }}>
          {data.map((d, i) => (
            <div key={i} className="text-xs truncate h-[36px] flex items-center text-foreground" style={{ maxWidth: 160, minWidth: 100 }} title={d.name}>
              {d.name} (n={d.n})
            </div>
          ))}
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" dataKey="effect" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => v.toFixed(1)} />
              <YAxis type="number" dataKey="y" hide domain={[-0.5, data.length - 0.5]} reversed />
              <ReferenceLine x={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
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
              <Scatter data={data} fill="hsl(var(--primary))" r={7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export const MetaRegressionScatter = ({ studies, slope, intercept }: MetaRegressionScatterProps) => {
  const data = useMemo(() =>
    studies.filter(s => typeof s.moderator === "number").map(s => ({ name: s.name, moderator: s.moderator, effect: s.effect })),
    [studies]
  );

  const line = useMemo(() => {
    if (data.length === 0) return [];
    const xs = data.map(d => d.moderator as number);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    return [
      { moderator: minX, effect: intercept + slope * minX },
      { moderator: maxX, effect: intercept + slope * maxX },
    ];
  }, [data, slope, intercept]);

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-2">Meta-regression</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" dataKey="moderator" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}>
            <Label value="Moderator" position="bottom" offset={20} style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          </XAxis>
          <YAxis type="number" dataKey="effect" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}>
            <Label value="Effect Size" angle={-90} position="left" offset={10} style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          </YAxis>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
                  <p className="font-semibold">{d.name}</p>
                  <p>Moderator: {d.moderator}</p>
                  <p>Effect: {d.effect?.toFixed?.(3)}</p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="hsl(var(--foreground))" r={5} />
          <Scatter data={line} fill="hsl(var(--primary))" line={{ stroke: "hsl(var(--primary))", strokeWidth: 2 }} shape={() => <></>} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
