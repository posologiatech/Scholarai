import { useState, useMemo } from "react";
import { SpreadsheetData } from "@/pages/DataMind";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, CheckCircle2, Trash2, RefreshCw, Save,
  ArrowRight, X, Sparkles, Eye, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface DataIssue {
  id: string;
  type: "missing" | "outlier" | "duplicate" | "inconsistent_type" | "whitespace";
  severity: "high" | "medium" | "low";
  column: string;
  description: string;
  affectedRows: number;
  suggestion: string;
  enabled: boolean;
}

interface Transformation {
  id: string;
  issueId: string;
  type: string;
  column: string;
  description: string;
  before: string[];
  after: string[];
}

interface Props {
  data: SpreadsheetData;
  conversationId?: string;
  fileId?: string;
  onApply: (cleanedData: SpreadsheetData) => void;
  onClose: () => void;
}

function detectIssues(data: SpreadsheetData): DataIssue[] {
  const issues: DataIssue[] = [];
  const { columns, rows } = data;

  columns.forEach((col) => {
    // Missing values
    const missingCount = rows.filter(r => {
      const v = r[col]?.trim();
      return !v || v === "" || v === "NA" || v === "N/A" || v === "null" || v === "NaN" || v === "999" || v === "999.0";
    }).length;
    if (missingCount > 0) {
      issues.push({
        id: `missing_${col}`,
        type: "missing",
        severity: missingCount > rows.length * 0.3 ? "high" : missingCount > rows.length * 0.1 ? "medium" : "low",
        column: col,
        description: `${missingCount} valores ausentes (${((missingCount / rows.length) * 100).toFixed(1)}%)`,
        affectedRows: missingCount,
        suggestion: "Preencher com mediana (numérico) ou moda (categórico), ou remover linhas",
        enabled: true,
      });
    }

    // Inconsistent types
    const vals = rows.map(r => r[col]?.trim()).filter(Boolean);
    const numCount = vals.filter(v => !isNaN(Number(v!.replace(/,/g, "")))).length;
    const isNumeric = numCount > vals.length * 0.7;
    if (isNumeric && numCount < vals.length && numCount > 0) {
      const inconsistent = vals.length - numCount;
      issues.push({
        id: `type_${col}`,
        type: "inconsistent_type",
        severity: "medium",
        column: col,
        description: `${inconsistent} valores não-numéricos em coluna majoritariamente numérica`,
        affectedRows: inconsistent,
        suggestion: "Converter para numérico ou marcar como ausente",
        enabled: true,
      });
    }

    // Outliers (numeric columns only)
    if (isNumeric) {
      const nums = vals.map(v => Number(v!.replace(/,/g, ""))).filter(n => !isNaN(n));
      if (nums.length > 10) {
        const sorted = [...nums].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        const outlierCount = nums.filter(n => n < lower || n > upper).length;
        if (outlierCount > 0) {
          issues.push({
            id: `outlier_${col}`,
            type: "outlier",
            severity: outlierCount > rows.length * 0.05 ? "high" : "low",
            column: col,
            description: `${outlierCount} outliers detectados (IQR method: < ${lower.toFixed(1)} ou > ${upper.toFixed(1)})`,
            affectedRows: outlierCount,
            suggestion: "Winsorizar, remover ou manter com flag",
            enabled: false,
          });
        }
      }
    }

    // Whitespace issues
    const whitespaceCount = vals.filter(v => v !== v!.trim() || /\s{2,}/.test(v!)).length;
    if (whitespaceCount > 0) {
      issues.push({
        id: `whitespace_${col}`,
        type: "whitespace",
        severity: "low",
        column: col,
        description: `${whitespaceCount} valores com espaços extras`,
        affectedRows: whitespaceCount,
        suggestion: "Remover espaços iniciais/finais e duplicados",
        enabled: true,
      });
    }
  });

  // Duplicate rows
  const seen = new Set<string>();
  let dupes = 0;
  for (const row of rows) {
    const key = columns.map(c => row[c] || "").join("|");
    if (seen.has(key)) dupes++;
    else seen.add(key);
  }
  if (dupes > 0) {
    issues.push({
      id: "duplicates",
      type: "duplicate",
      severity: dupes > rows.length * 0.1 ? "high" : "medium",
      column: "(todas)",
      description: `${dupes} linhas duplicadas encontradas`,
      affectedRows: dupes,
      suggestion: "Remover duplicatas mantendo a primeira ocorrência",
      enabled: true,
    });
  }

  return issues.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

function applyTransformations(data: SpreadsheetData, issues: DataIssue[]): { cleaned: SpreadsheetData; transforms: Transformation[] } {
  const transforms: Transformation[] = [];
  let rows = data.rows.map(r => ({ ...r }));
  const { columns } = data;

  for (const issue of issues) {
    if (!issue.enabled) continue;

    if (issue.type === "whitespace") {
      const before: string[] = [];
      const after: string[] = [];
      rows.forEach(r => {
        const val = r[issue.column] || "";
        const cleaned = val.trim().replace(/\s{2,}/g, " ");
        if (val !== cleaned) {
          if (before.length < 3) { before.push(val); after.push(cleaned); }
          r[issue.column] = cleaned;
        }
      });
      transforms.push({ id: issue.id, issueId: issue.id, type: "trim", column: issue.column, description: `Espaços limpos em "${issue.column}"`, before, after });
    }

    if (issue.type === "missing") {
      const vals = rows.map(r => r[issue.column]?.trim()).filter(v => v && v !== "" && v !== "NA" && v !== "N/A" && v !== "null" && v !== "NaN" && v !== "999" && v !== "999.0");
      const nums = vals.map(v => Number(v!.replace(/,/g, ""))).filter(n => !isNaN(n));
      const isNumeric = nums.length > vals.length * 0.7;

      let fillValue = "";
      if (isNumeric && nums.length > 0) {
        const sorted = [...nums].sort((a, b) => a - b);
        fillValue = String(sorted[Math.floor(sorted.length / 2)]);
      } else {
        const freq: Record<string, number> = {};
        vals.forEach(v => { freq[v!] = (freq[v!] || 0) + 1; });
        fillValue = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      }

      const before: string[] = [];
      const after: string[] = [];
      rows.forEach(r => {
        const v = r[issue.column]?.trim();
        if (!v || v === "" || v === "NA" || v === "N/A" || v === "null" || v === "NaN" || v === "999" || v === "999.0") {
          if (before.length < 3) { before.push(r[issue.column] || "(vazio)"); after.push(fillValue); }
          r[issue.column] = fillValue;
        }
      });
      transforms.push({ id: issue.id, issueId: issue.id, type: "fill_missing", column: issue.column, description: `Valores ausentes preenchidos com ${isNumeric ? "mediana" : "moda"} (${fillValue})`, before, after });
    }

    if (issue.type === "duplicate") {
      const seen = new Set<string>();
      const before = [`${rows.length} linhas`];
      rows = rows.filter(row => {
        const key = columns.map(c => row[c] || "").join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const after = [`${rows.length} linhas`];
      transforms.push({ id: issue.id, issueId: issue.id, type: "dedup", column: "(todas)", description: `Duplicatas removidas`, before, after });
    }
  }

  return { cleaned: { columns, rows }, transforms };
}

const severityConfig = {
  high: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: "🔴" },
  medium: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: "🟡" },
  low: { color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: "🟢" },
};

const typeLabels: Record<string, string> = {
  missing: "Valores Ausentes",
  outlier: "Outliers",
  duplicate: "Duplicatas",
  inconsistent_type: "Tipo Inconsistente",
  whitespace: "Espaços Extras",
};

const DataCleaningPanel = ({ data, conversationId, fileId, onApply, onClose }: Props) => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<DataIssue[]>(() => detectIssues(data));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const enabledCount = issues.filter(i => i.enabled).length;
  const totalAffected = issues.filter(i => i.enabled).reduce((sum, i) => sum + i.affectedRows, 0);

  const preview = useMemo(() => {
    if (!previewOpen) return null;
    return applyTransformations(data, issues);
  }, [previewOpen, issues, data]);

  const qualityScore = useMemo(() => {
    const totalCells = data.rows.length * data.columns.length;
    const affectedCells = issues.reduce((sum, i) => sum + i.affectedRows, 0);
    return Math.max(0, Math.round((1 - affectedCells / totalCells) * 100));
  }, [issues, data]);

  const handleApply = async () => {
    const { cleaned, transforms } = applyTransformations(data, issues);

    // Save profile to DB
    if (user && conversationId) {
      setSaving(true);
      await supabase.from("datamind_cleaning_profiles").insert({
        user_id: user.id,
        conversation_id: conversationId,
        file_id: fileId || null,
        title: `Limpeza - ${new Date().toLocaleDateString("pt-BR")}`,
        issues: issues as any,
        transformations: transforms as any,
        status: "applied",
      });
      setSaving(false);
    }

    onApply(cleaned);
    toast({ title: "Limpeza aplicada!", description: `${transforms.length} transformações executadas em ${data.rows.length} linhas.` });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/60 rounded-xl bg-card shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Data Cleaning Pipeline</h3>
            <p className="text-xs text-muted-foreground">
              {issues.length} problemas detectados · Score de qualidade: {qualityScore}%
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quality Score */}
      <div className="px-5 py-3 border-b border-border/30">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">Qualidade dos Dados</span>
          <span className="text-sm font-bold text-foreground">{qualityScore}%</span>
        </div>
        <Progress value={qualityScore} className="h-2" />
      </div>

      {/* Issues List */}
      <ScrollArea className="max-h-[400px]">
        <div className="divide-y divide-border/30">
          {issues.map((issue) => (
            <div key={issue.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
              <div className="pt-0.5">
                <Switch
                  checked={issue.enabled}
                  onCheckedChange={(checked) =>
                    setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, enabled: checked } : i))
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${severityConfig[issue.severity].color}`}>
                    {severityConfig[issue.severity].icon} {issue.severity === "high" ? "Alto" : issue.severity === "medium" ? "Médio" : "Baixo"}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">{typeLabels[issue.type]}</span>
                </div>
                <p className="text-sm text-foreground font-medium">{issue.column}</p>
                <p className="text-xs text-muted-foreground">{issue.description}</p>
                <p className="text-xs text-primary/80 mt-0.5 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {issue.suggestion}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {issue.affectedRows} linhas
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Preview */}
      {previewOpen && preview && preview.transforms.length > 0 && (
        <div className="border-t border-border/40 px-5 py-3 bg-muted/10">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview das Transformações
          </h4>
          <div className="space-y-2">
            {preview.transforms.map((t) => (
              <div key={t.id} className="rounded-lg border border-border/40 bg-card p-3">
                <p className="text-xs font-medium text-foreground mb-1.5">{t.description}</p>
                {t.before.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex-1">
                      <span className="text-muted-foreground">Antes:</span>
                      {t.before.map((b, i) => (
                        <span key={i} className="ml-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded text-[11px]">{b}</span>
                      ))}
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <span className="text-muted-foreground">Depois:</span>
                      {t.after.map((a, i) => (
                        <span key={i} className="ml-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded text-[11px]">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/10">
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(!previewOpen)} className="gap-1.5 text-xs">
          {previewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {previewOpen ? "Ocultar Preview" : "Preview"}
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{enabledCount} de {issues.length} selecionados · {totalAffected} linhas afetadas</span>
          <Button size="sm" onClick={handleApply} disabled={enabledCount === 0 || saving} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aplicar Limpeza
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default DataCleaningPanel;
