import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, ClipboardList, Copy, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Finding, suggestionsFromFindings } from "@/lib/datamind/findings";
import { buildBriefing, briefingFacts, briefingToText } from "@/lib/datamind/briefing";
import { CompactProfile } from "@/lib/datamind/profile";

interface BriefedFile {
  id: string;
  file_name: string;
  schema_info: Record<string, unknown>;
}

interface Props {
  file: BriefedFile;
  findings: Finding[];
  /** The model the researcher picked, so the written briefing does not silently use another. */
  model?: { provider: string; model: string } | null;
  onAsk?: (question: string) => void;
  loading?: boolean;
}

/**
 * What is in this file, before the researcher asks anything.
 *
 * The briefing itself is free: it is assembled from the profile computed at
 * upload and the findings already stored by the scan, so it renders with no
 * call and no recomputation. Only the written version costs — which is why it
 * is a button, the same resolution the researcher chose for triage.
 */
const DataMindBriefing = ({ file, findings, model, onAsk, loading }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [writing, setWriting] = useState(false);
  const stored = (file.schema_info as { briefing?: { text?: string } } | null)?.briefing?.text;
  const [prose, setProse] = useState<string>(stored || "");

  const profile = (file.schema_info as { profile?: CompactProfile } | null)?.profile;
  const briefing = useMemo(
    () => buildBriefing(file.file_name, profile, findings, suggestionsFromFindings(findings, 3)),
    [file.file_name, profile, findings]
  );

  if (!briefing) return null;

  const visible = expanded ? briefing.sections : briefing.sections.slice(0, 1);

  /**
   * Asks the model to write the briefing out.
   *
   * It is sent the finished facts and nothing else — no rows, no profile object —
   * so the written paragraphs can restate what is below but cannot introduce a
   * number the engine never produced.
   */
  const write = async () => {
    setWriting(true);
    try {
      const { data, error } = await supabase.functions.invoke("datamind-briefing", {
        body: {
          facts: briefingFacts(briefing),
          fileName: file.file_name,
          ...(model ? { provider: model.provider, model: model.model } : {}),
        },
      });
      if (error) throw error;
      const text = (data?.text || "").trim();
      if (!text) throw new Error(data?.error || "Resposta vazia.");

      setProse(text);
      setExpanded(true);

      // Persisted alongside the profile that produced it, so a reload does not
      // charge the researcher a second time for the same paragraphs.
      await supabase
        .from("datamind_files")
        .update({
          schema_info: {
            ...(file.schema_info || {}),
            briefing: { text, at: new Date().toISOString() },
          },
        })
        .eq("id", file.id);
    } catch (e) {
      console.error("[briefing] write failed:", e);
      toast({ title: "Não foi possível redigir o briefing", variant: "destructive" });
    } finally {
      setWriting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(briefingToText(briefing, prose));
      toast({ title: "Briefing copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 rounded-xl border border-border/60 bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-2 min-w-0">
        <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium text-foreground">Briefing do arquivo</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{briefing.headline}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Copy className="mr-1 h-3 w-3" />
            Copiar
          </Button>
          {!prose && (
            <Button
              variant="ghost"
              size="sm"
              disabled={writing}
              onClick={write}
              className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
            >
              {writing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
              Redigir com IA
            </Button>
          )}
        </div>
      </div>

      {prose && (
        <div className="mb-3 space-y-2 rounded-lg bg-muted/50 p-3">
          {prose.split(/\n{2,}/).map((paragraph, i) => (
            <p key={i} className="text-xs text-foreground/90 break-words">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((section) => (
          <div key={section.title} className="min-w-0">
            <p className="text-xs font-medium text-foreground">{section.title}</p>
            <ul className="mt-1 space-y-0.5">
              {section.lines.map((line, i) => (
                <li key={i} className="text-xs text-muted-foreground break-words">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {briefing.starters.length > 0 && expanded && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {briefing.starters.map((question) => (
            <Button
              key={question}
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onAsk?.(question)}
              className="h-7 max-w-full px-2 text-xs"
            >
              <span className="truncate">{question}</span>
            </Button>
          ))}
        </div>
      )}

      {briefing.sections.length > 1 && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Mostrar menos" : `Ver briefing completo (${briefing.sections.length} seções)`}
        </button>
      )}
    </motion.div>
  );
};

export default DataMindBriefing;
