import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { Finding } from "@/lib/datamind/findings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  findings: Finding[];
  scanning: boolean;
  onAsk: (question: string) => void;
  onDismiss: (finding: Finding) => void;
  loading?: boolean;
  /** Asks the model to prioritise and explain — one paid call, on demand. */
  onInterpret?: () => void;
  interpreting?: boolean;
  triageSummary?: string;
}

const COLLAPSED_COUNT = 4;

/**
 * How a finding is labelled matters as much as whether it is shown: a scan that
 * ran hundreds of tests must never present a lead with the same confidence as a
 * result that survived the false-discovery correction.
 */
function badgeFor(finding: Finding): { label: string; className: string } {
  if (finding.kind === "quality") {
    return finding.severity === "critical"
      ? { label: "Problema nos dados", className: "bg-destructive/10 text-destructive border-destructive/20" }
      : { label: "Qualidade", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  }
  if (finding.significant) {
    return { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
  }
  return { label: "Pista", className: "bg-muted text-muted-foreground border-border" };
}

const DataMindFindingsPanel = ({ findings, scanning, onAsk, onDismiss, loading, onInterpret, interpreting, triageSummary }: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (findings.length === 0 && !scanning) return null;

  const visible = expanded ? findings : findings.slice(0, COLLAPSED_COUNT);
  const confirmed = findings.filter((f) => f.significant && f.kind !== "quality").length;
  const interpreted = findings.some((f) => f.interpretation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 rounded-xl border border-border/60 bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-3 min-w-0">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground">Achados automáticos</span>
        {scanning ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            <span className="truncate">varrendo os dados…</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground truncate">
            {confirmed > 0 ? `${confirmed} confirmado(s) de ${findings.length}` : `${findings.length} item(ns)`}
          </span>
        )}
        {onInterpret && !scanning && findings.length > 0 && !interpreted && (
          <Button
            variant="ghost"
            size="sm"
            disabled={interpreting}
            onClick={onInterpret}
            className="ml-auto h-7 shrink-0 px-2 text-xs text-primary hover:bg-primary/10"
          >
            {interpreting ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="mr-1 h-3 w-3" />
            )}
            Interpretar
          </Button>
        )}
      </div>

      {triageSummary && (
        <p className="mb-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground break-words">
          {triageSummary}
        </p>
      )}

      <div className="space-y-2">
        {visible.map((finding) => {
          const badge = badgeFor(finding);
          return (
            <div
              key={finding.key}
              className="group rounded-lg border border-border/50 bg-background/50 p-3 min-w-0"
            >
              <div className="flex items-start gap-2 min-w-0">
                <Badge variant="outline" className={`shrink-0 text-[10px] ${badge.className}`}>
                  {badge.label}
                </Badge>
                <p className="flex-1 min-w-0 text-sm text-foreground break-words">
                  {finding.interpretation?.headline || finding.title}
                </p>
                <button
                  onClick={() => onDismiss(finding)}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Ocultar achado: ${finding.title}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* The engine's own wording stays visible under the model's: the
                  numbers below belong to the sentence the engine wrote, not to the
                  one the model rephrased. */}
              {finding.interpretation?.headline && (
                <p className="mt-1 text-xs text-muted-foreground/80 break-words">{finding.title}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground break-words">{finding.detail}</p>

              {finding.interpretation?.why && (
                <p className="mt-1.5 text-xs text-foreground/80 break-words">{finding.interpretation.why}</p>
              )}
              {finding.interpretation?.caution && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="min-w-0">{finding.interpretation.caution}</span>
                </p>
              )}

              {finding.negligible && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="min-w-0">
                    Significativo pelo tamanho da amostra, mas o efeito em si é desprezível.
                  </span>
                </p>
              )}
              {finding.fragile && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="min-w-0">
                    Frequências esperadas baixas: o p-valor é uma aproximação frágil.
                  </span>
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => onAsk(finding.question)}
                className="mt-2 h-7 px-2 text-xs text-primary hover:bg-primary/10"
              >
                Analisar em detalhe
              </Button>
            </div>
          );
        })}
      </div>

      {findings.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Mostrar menos" : `Mostrar mais ${findings.length - COLLAPSED_COUNT}`}
        </button>
      )}
    </motion.div>
  );
};

export default DataMindFindingsPanel;
