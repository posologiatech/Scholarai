import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Check, FileText } from "lucide-react";
import { PROJECT_BODY_TEMPLATE_PT } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";
import ReactMarkdown from "react-markdown";

export const ProjectBodyEditor = ({
  projectId, initial,
}: { projectId: string; initial: string | null }) => {
  const { locale } = useLanguage();
  const [value, setValue] = useState(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const timer = useRef<number | null>(null);
  const skipNext = useRef(true);

  useEffect(() => { setValue(initial ?? ""); skipNext.current = true; }, [initial, projectId]);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from("research_projects")
        .update({ full_content: value })
        .eq("id", projectId);
      if (!error) {
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } else setStatus("idle");
    }, 1200);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const insertTemplate = () => {
    if (value.trim() && !confirm(locale === "pt" ? "Substituir o conteúdo atual pelo modelo?" : "Replace current content with template?")) return;
    setValue(PROJECT_BODY_TEMPLATE_PT);
  };

  return (
    <div className="rounded-2xl border bg-card/40 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{locale === "pt" ? "Corpo do projeto" : "Project body"}</h3>
          <span className="text-xs text-muted-foreground">· {locale === "pt" ? "Introdução, metodologia, fases, resultados esperados" : "Introduction, methodology, phases, expected results"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground min-w-[80px] text-right">
            {status === "saving" && (<><Loader2 className="h-3 w-3 inline animate-spin mr-1" />{locale === "pt" ? "Salvando…" : "Saving…"}</>)}
            {status === "saved" && (<><Check className="h-3 w-3 inline mr-1 text-emerald-500" />{locale === "pt" ? "Salvo" : "Saved"}</>)}
          </div>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button onClick={() => setMode("edit")} className={`px-2.5 py-1 ${mode === "edit" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{locale === "pt" ? "Editar" : "Edit"}</button>
            <button onClick={() => setMode("preview")} className={`px-2.5 py-1 ${mode === "preview" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{locale === "pt" ? "Visualizar" : "Preview"}</button>
          </div>
          {!value.trim() && (
            <Button variant="outline" size="sm" onClick={insertTemplate}>{locale === "pt" ? "Usar modelo" : "Use template"}</Button>
          )}
        </div>
      </div>
      <div className="p-5">
        {mode === "edit" ? (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={locale === "pt"
              ? "Escreva aqui o texto completo do projeto. Markdown é suportado."
              : "Write the full project text here. Markdown supported."}
            className="min-h-[500px] font-mono text-sm leading-relaxed border-0 focus-visible:ring-0 resize-y bg-transparent p-0"
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none min-h-[500px]">
            {value.trim() ? <ReactMarkdown>{value}</ReactMarkdown> : <p className="text-muted-foreground">{locale === "pt" ? "Vazio." : "Empty."}</p>}
          </div>
        )}
      </div>
    </div>
  );
};
