import { useState, useEffect } from "react";
import { SpreadsheetData } from "@/pages/DataMind";
import { DatasetProfile, profileDataset } from "@/lib/datamind/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, BarChart3, AlertTriangle, CheckCircle2, TrendingUp, Hash, Type, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  data: SpreadsheetData;
  fileName: string;
  onClose: () => void;
  onSendToChat?: (msg: string) => void;
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
              // The column lines carry type and cardinality so the model can pick a
              // test without guessing, and the warnings travel with it so it cannot
              // recommend an analysis over data the profile already flagged.
              const columnLines = profile.columns
                .map((c) => {
                  const parts = [typeLabels[c.type], `${c.missingPct.toFixed(1)}% missing`, `${c.unique} únicos`];
                  if (c.isIdCandidate) parts.push("parece identificador");
                  if (c.isConstant) parts.push("constante");
                  if (c.sentinels?.length) {
                    parts.push(`códigos de ausência suspeitos: ${c.sentinels.map((sv) => sv.value).join(", ")}`);
                  }
                  if (c.topValues?.length) {
                    parts.push(`níveis: ${c.topValues.slice(0, 5).map((tv) => `${tv.value} (${tv.count})`).join(", ")}`);
                  }
                  return `  - **${c.name}** (${parts.join("; ")})`;
                })
                .join("\n");

              const warningLines =
                profile.warnings.length > 0
                  ? `\n\nProblemas detectados:\n${profile.warnings.map((w) => `  - [${w.severity}] ${w.message}`).join("\n")}`
                  : "";

              const correlationLines =
                profile.correlations.length > 0
                  ? `\n\nCorrelações relevantes:\n${profile.correlations.map((c) => `  - ${c.col1} ↔ ${c.col2}: r=${c.value} (n=${c.n})`).join("\n")}`
                  : "";

              const summary = `📊 **Perfil do Dataset (${fileName})**\n- ${profile.totalRows} linhas, ${profile.totalCols} colunas\n- Score de qualidade: ${profile.overallQuality}/100\n- Duplicatas: ${profile.duplicateRows}\n\nColunas:\n${columnLines}${warningLines}${correlationLines}\n\nBaseado neste perfil, sugira as melhores análises para este dataset.`;
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
                <li key={i} className="text-xs text-muted-foreground">
                  <span className={w.severity === "critical" ? "text-red-500 font-medium" : ""}>•</span> {w.message}
                </li>
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
