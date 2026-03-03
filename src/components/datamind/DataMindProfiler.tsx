import { useState, useEffect } from "react";
import { SpreadsheetData } from "@/pages/DataMind";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, BarChart3, AlertTriangle, CheckCircle2, TrendingUp, Hash, Type, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface ColumnProfile {
  name: string;
  type: "numeric" | "categorical" | "datetime" | "text" | "boolean";
  missing: number;
  missingPct: number;
  unique: number;
  uniquePct: number;
  // numeric stats
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  skewness?: number;
  outliers?: number;
  // categorical stats
  topValues?: { value: string; count: number }[];
  // quality
  qualityScore: number;
}

interface DatasetProfile {
  totalRows: number;
  totalCols: number;
  overallQuality: number;
  duplicateRows: number;
  memoryEstimate: string;
  columns: ColumnProfile[];
  correlations: { col1: string; col2: string; value: number }[];
  warnings: string[];
}

interface Props {
  data: SpreadsheetData;
  fileName: string;
  onClose: () => void;
  onSendToChat?: (msg: string) => void;
}

function detectType(values: string[]): "numeric" | "categorical" | "datetime" | "text" | "boolean" {
  const nonEmpty = values.filter(v => v && v.trim() !== "" && v !== "NA" && v !== "null");
  if (nonEmpty.length === 0) return "text";
  
  const boolVals = new Set(["true", "false", "yes", "no", "sim", "não", "0", "1"]);
  if (nonEmpty.every(v => boolVals.has(v.toLowerCase()))) return "boolean";
  
  const numericCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  if (numericCount / nonEmpty.length > 0.8) return "numeric";
  
  const datePatterns = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{4}/;
  const dateCount = nonEmpty.filter(v => datePatterns.test(v)).length;
  if (dateCount / nonEmpty.length > 0.5) return "datetime";
  
  const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
  if (uniqueRatio < 0.3 && nonEmpty.length > 10) return "categorical";
  
  return "text";
}

function calcNumericStats(values: number[]) {
  if (values.length === 0) return {};
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  
  // Skewness
  const skewness = n > 2 ? values.reduce((s, v) => s + ((v - mean) / (std || 1)) ** 3, 0) / n : 0;
  
  // Outliers (IQR)
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const outliers = values.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
  
  return { mean, median, std, min: sorted[0], max: sorted[n - 1], skewness, outliers };
}

function profileDataset(data: SpreadsheetData): DatasetProfile {
  const { columns: cols, rows } = data;
  const totalRows = rows.length;
  const totalCols = cols.length;
  const warnings: string[] = [];
  
  // Duplicate rows
  const rowStrings = rows.map(r => cols.map(c => r[c] || "").join("|"));
  const uniqueRows = new Set(rowStrings);
  const duplicateRows = totalRows - uniqueRows.size;
  if (duplicateRows > 0) warnings.push(`${duplicateRows} linhas duplicadas encontradas`);
  
  // Memory estimate
  const charCount = rows.reduce((s, r) => s + cols.reduce((ss, c) => ss + (r[c]?.length || 0), 0), 0);
  const memBytes = charCount * 2;
  const memoryEstimate = memBytes > 1e6 ? `${(memBytes / 1e6).toFixed(1)} MB` : `${(memBytes / 1e3).toFixed(0)} KB`;
  
  // Profile each column
  const columnProfiles: ColumnProfile[] = cols.map(col => {
    const values = rows.map(r => r[col] || "");
    const missing = values.filter(v => !v.trim() || v === "NA" || v === "null" || v === "NaN" || v === "999").length;
    const missingPct = (missing / totalRows) * 100;
    const nonEmpty = values.filter(v => v.trim() && v !== "NA" && v !== "null" && v !== "NaN");
    const uniqueSet = new Set(nonEmpty);
    const unique = uniqueSet.size;
    const uniquePct = nonEmpty.length > 0 ? (unique / nonEmpty.length) * 100 : 0;
    const type = detectType(values);
    
    let qualityScore = 100;
    qualityScore -= missingPct * 0.5;
    
    const profile: ColumnProfile = { name: col, type, missing, missingPct, unique, uniquePct, qualityScore: Math.max(0, qualityScore) };
    
    if (type === "numeric") {
      const numVals = nonEmpty.map(Number).filter(v => !isNaN(v));
      const stats = calcNumericStats(numVals);
      Object.assign(profile, stats);
      if (stats.outliers && stats.outliers > totalRows * 0.05) {
        warnings.push(`Coluna "${col}": ${stats.outliers} outliers detectados`);
        profile.qualityScore -= 10;
      }
      if (Math.abs(stats.skewness || 0) > 2) {
        warnings.push(`Coluna "${col}": distribuição altamente assimétrica (skewness=${stats.skewness?.toFixed(2)})`);
      }
    }
    
    if (type === "categorical") {
      const freq: Record<string, number> = {};
      nonEmpty.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      profile.topValues = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));
    }
    
    if (missingPct > 30) warnings.push(`Coluna "${col}": ${missingPct.toFixed(1)}% de valores ausentes`);
    if (uniquePct === 100 && type !== "text" && totalRows > 10) profile.qualityScore = Math.min(profile.qualityScore, 95);
    
    profile.qualityScore = Math.max(0, Math.round(profile.qualityScore));
    return profile;
  });
  
  // Simple correlations for numeric columns
  const numericCols = columnProfiles.filter(c => c.type === "numeric");
  const correlations: { col1: string; col2: string; value: number }[] = [];
  
  for (let i = 0; i < Math.min(numericCols.length, 8); i++) {
    for (let j = i + 1; j < Math.min(numericCols.length, 8); j++) {
      const c1 = numericCols[i].name;
      const c2 = numericCols[j].name;
      const vals1 = rows.map(r => Number(r[c1])).filter(v => !isNaN(v));
      const vals2 = rows.map(r => Number(r[c2])).filter(v => !isNaN(v));
      const n = Math.min(vals1.length, vals2.length);
      if (n < 5) continue;
      
      const m1 = vals1.slice(0, n).reduce((s, v) => s + v, 0) / n;
      const m2 = vals2.slice(0, n).reduce((s, v) => s + v, 0) / n;
      let num = 0, d1 = 0, d2 = 0;
      for (let k = 0; k < n; k++) {
        num += (vals1[k] - m1) * (vals2[k] - m2);
        d1 += (vals1[k] - m1) ** 2;
        d2 += (vals2[k] - m2) ** 2;
      }
      const corr = d1 > 0 && d2 > 0 ? num / Math.sqrt(d1 * d2) : 0;
      if (Math.abs(corr) > 0.5) {
        correlations.push({ col1: c1, col2: c2, value: Math.round(corr * 100) / 100 });
      }
    }
  }
  
  if (correlations.filter(c => Math.abs(c.value) > 0.9).length > 0) {
    warnings.push("Correlações muito altas detectadas — possível multicolinearidade");
  }
  
  const overallQuality = Math.round(columnProfiles.reduce((s, c) => s + c.qualityScore, 0) / columnProfiles.length);
  
  return { totalRows, totalCols, overallQuality, duplicateRows, memoryEstimate, columns: columnProfiles, correlations, warnings };
}

const typeIcons: Record<string, typeof Hash> = {
  numeric: Hash,
  categorical: BarChart3,
  datetime: Calendar,
  text: Type,
  boolean: CheckCircle2,
};

const typeLabels: Record<string, string> = {
  numeric: "Numérico",
  categorical: "Categórico",
  datetime: "Data",
  text: "Texto",
  boolean: "Booleano",
};

const DataMindProfiler = ({ data, fileName, onClose, onSendToChat }: Props) => {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [selectedCol, setSelectedCol] = useState<string | null>(null);

  useEffect(() => {
    const p = profileDataset(data);
    setProfile(p);
  }, [data]);

  if (!profile) return null;

  const qualityColor = profile.overallQuality >= 80 ? "text-green-500" : profile.overallQuality >= 50 ? "text-yellow-500" : "text-red-500";
  const qualityBg = profile.overallQuality >= 80 ? "bg-green-500" : profile.overallQuality >= 50 ? "bg-yellow-500" : "bg-red-500";
  const selectedProfile = selectedCol ? profile.columns.find(c => c.name === selectedCol) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/60 rounded-xl bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${qualityBg}/10 flex items-center justify-center`}>
            <span className={`text-lg font-bold ${qualityColor}`}>{profile.overallQuality}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Perfil do Dataset</h3>
            <p className="text-xs text-muted-foreground">{fileName} · {profile.totalRows.toLocaleString()} linhas × {profile.totalCols} colunas · {profile.memoryEstimate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onSendToChat && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
              const summary = `📊 **Perfil do Dataset (${fileName})**\n- ${profile.totalRows} linhas, ${profile.totalCols} colunas\n- Score de qualidade: ${profile.overallQuality}/100\n- Duplicatas: ${profile.duplicateRows}\n- Avisos: ${profile.warnings.length}\n\nColunas:\n${profile.columns.map(c => `  - **${c.name}** (${typeLabels[c.type]}): ${c.missingPct.toFixed(1)}% missing, ${c.unique} únicos`).join("\n")}\n\n${profile.correlations.length > 0 ? `Correlações relevantes:\n${profile.correlations.map(c => `  - ${c.col1} ↔ ${c.col2}: ${c.value}`).join("\n")}` : ""}\n\nBaseado neste perfil, sugira as melhores análises para este dataset.`;
              onSendToChat(summary);
            }}>
              Analisar com IA
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-3 p-4">
        {[
          { label: "Qualidade", value: `${profile.overallQuality}/100`, color: qualityColor },
          { label: "Linhas", value: profile.totalRows.toLocaleString(), color: "text-foreground" },
          { label: "Duplicatas", value: String(profile.duplicateRows), color: profile.duplicateRows > 0 ? "text-yellow-500" : "text-green-500" },
          { label: "Avisos", value: String(profile.warnings.length), color: profile.warnings.length > 0 ? "text-yellow-500" : "text-green-500" },
        ].map((item, i) => (
          <div key={i} className="rounded-lg border border-border/40 p-3 text-center">
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Warnings */}
      {profile.warnings.length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-xs font-medium text-yellow-600">Avisos ({profile.warnings.length})</span>
            </div>
            <ul className="space-y-1">
              {profile.warnings.slice(0, 5).map((w, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Column grid */}
      <div className="px-4 pb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Colunas</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
          {profile.columns.map((col) => {
            const Icon = typeIcons[col.type] || Type;
            const isSelected = selectedCol === col.name;
            return (
              <button
                key={col.name}
                onClick={() => setSelectedCol(isSelected ? null : col.name)}
                className={`text-left rounded-lg border p-2.5 transition-all ${isSelected ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium truncate flex-1">{col.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabels[col.type]}</Badge>
                </div>
                <Progress value={col.qualityScore} className="h-1.5 mb-1" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{col.missingPct.toFixed(0)}% missing</span>
                  <span>{col.unique} únicos</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected column detail */}
      {selectedProfile && (
        <div className="px-4 pb-4 border-t border-border/40 pt-3">
          <h4 className="text-sm font-semibold mb-2">{selectedProfile.name}</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {selectedProfile.type === "numeric" && (
              <>
                {selectedProfile.mean !== undefined && <div><span className="text-muted-foreground">Média:</span> <span className="font-medium">{selectedProfile.mean.toFixed(2)}</span></div>}
                {selectedProfile.median !== undefined && <div><span className="text-muted-foreground">Mediana:</span> <span className="font-medium">{selectedProfile.median.toFixed(2)}</span></div>}
                {selectedProfile.std !== undefined && <div><span className="text-muted-foreground">Desvio Padrão:</span> <span className="font-medium">{selectedProfile.std.toFixed(2)}</span></div>}
                {selectedProfile.min !== undefined && <div><span className="text-muted-foreground">Min/Max:</span> <span className="font-medium">{selectedProfile.min.toFixed(2)} – {selectedProfile.max?.toFixed(2)}</span></div>}
                {selectedProfile.outliers !== undefined && <div><span className="text-muted-foreground">Outliers:</span> <span className="font-medium">{selectedProfile.outliers}</span></div>}
                {selectedProfile.skewness !== undefined && <div><span className="text-muted-foreground">Assimetria:</span> <span className="font-medium">{selectedProfile.skewness.toFixed(2)}</span></div>}
              </>
            )}
            {selectedProfile.type === "categorical" && selectedProfile.topValues && (
              <div className="col-span-2">
                <p className="text-muted-foreground mb-1">Top valores:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedProfile.topValues.map((tv, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{tv.value} ({tv.count})</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Correlations */}
      {profile.correlations.length > 0 && (
        <div className="px-4 pb-4 border-t border-border/40 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Correlações Relevantes</span>
          </div>
          <div className="space-y-1">
            {profile.correlations.slice(0, 6).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium">{c.col1}</span>
                <span className="text-muted-foreground">↔</span>
                <span className="font-medium">{c.col2}</span>
                <Badge variant={Math.abs(c.value) > 0.8 ? "destructive" : "secondary"} className="text-[10px] ml-auto">
                  {c.value > 0 ? "+" : ""}{c.value}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default DataMindProfiler;
