import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export interface ChartSeries {
  key: string;
  label: string;
}

export interface ChartPayload {
  kind: string;
  title?: string;
  xKey: string;
  series: ChartSeries[];
  data: Record<string, unknown>[];
}

// Same fixed categorical order used in ReportsDashboard.tsx, for a consistent palette app-wide.
export const CHART_COLORS = [
  "hsl(234, 89%, 60%)", "hsl(262, 83%, 58%)", "hsl(152, 69%, 41%)",
  "hsl(30, 90%, 55%)", "hsl(350, 80%, 55%)", "hsl(190, 80%, 45%)",
  "hsl(45, 90%, 50%)", "hsl(280, 60%, 50%)",
];

interface Props {
  chart: ChartPayload;
  height?: number | string;
}

// Pure chart body (no toolbar/chrome) shared by the DataMind chat output and pinned dashboard tiles.
const ChartRenderer = ({ chart, height = 280 }: Props) => {
  const isPie = chart.kind === "pie";
  const singleSeries = chart.series.length === 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart.kind === "line" ? (
        <LineChart data={chart.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          {!singleSeries && <Legend />}
          {chart.series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      ) : chart.kind === "area" ? (
        <AreaChart data={chart.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          {!singleSeries && <Legend />}
          {chart.series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.2} />
          ))}
        </AreaChart>
      ) : chart.kind === "scatter" ? (
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} name={chart.xKey} />
          <YAxis dataKey={chart.series[0]?.key} tick={{ fontSize: 12 }} name={chart.series[0]?.label} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={chart.data} fill={CHART_COLORS[0]} />
        </ScatterChart>
      ) : isPie ? (
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie
            data={chart.data}
            dataKey={chart.series[0]?.key}
            nameKey={chart.xKey}
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={(entry) => String(entry[chart.xKey])}
          >
            {chart.data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      ) : (
        <BarChart data={chart.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
          {!singleSeries && <Legend />}
          {chart.series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
};

export default ChartRenderer;
