import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Check, FileText, Sparkles, Wand2, Plus, ChevronDown } from "lucide-react";
import { PROJECT_BODY_TEMPLATE_PT } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Section =
  | "introducao" | "objetivos" | "metodologia" | "fases"
  | "resultados_esperados" | "cronograma_textual" | "referencial_teorico"
  | "discussao" | "completo";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "completo", label: "Texto completo do projeto" },
  { id: "introducao", label: "Introdução" },
  { id: "objetivos", label: "Objetivos (Geral + Específicos)" },
  { id: "referencial_teorico", label: "Referencial Teórico (com RAG)" },
  { id: "metodologia", label: "Metodologia" },
  { id: "fases", label: "Fases do Projeto" },
  { id: "resultados_esperados", label: "Resultados Esperados" },
  { id: "cronograma_textual", label: "Cronograma (textual)" },
  { id: "discussao", label: "Discussão preliminar" },
];

export const ProjectBodyEditor = ({
  projectId, initial,
}: { projectId: string; initial: string | null }) => {
  const { locale } = useLanguage();
  const [value, setValue] = useState(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const timer = useRef<number | null>(null);
  const skipNext = useRef(true);

  // Auto-write state
  const [writing, setWriting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewLabel, setPreviewLabel] = useState("");
  const [ragInfo, setRagInfo] = useState<{ used: boolean; papers: number } | null>(null);

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

  const autowrite = async (section: Section, label: string) => {
    setWriting(true);
    setPreviewLabel(label);
    setPreviewText("");
    setRagInfo(null);
    setPreviewOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-autowrite", {
        body: { project_id: projectId, section },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreviewText(data?.text ?? "");
      setRagInfo({ used: !!data?.rag_used, papers: data?.rag_papers ?? 0 });
    } catch (e: any) {
      toast.error(e.message ?? (locale === "pt" ? "Falha ao gerar" : "Generation failed"));
      setPreviewOpen(false);
    } finally {
      setWriting(false);
    }
  };

  const insertAtEnd = () => {
    setValue((v) => (v.trim() ? v + "\n\n" + previewText : previewText));
    setPreviewOpen(false);
    toast.success(locale === "pt" ? "Seção inserida" : "Section inserted");
  };

  const replaceAll = () => {
    if (value.trim() && !confirm(locale === "pt" ? "Substituir TODO o conteúdo atual?" : "Replace ALL current content?")) return;
    setValue(previewText);
    setPreviewOpen(false);
    toast.success(locale === "pt" ? "Conteúdo substituído" : "Content replaced");
  };

  return (
    <div className="rounded-2xl border bg-card/40 backdrop-blur-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm">{locale === "pt" ? "Corpo do projeto" : "Project body"}</h3>
          <span className="text-xs text-muted-foreground truncate">· {locale === "pt" ? "Introdução, metodologia, fases, resultados esperados" : "Introduction, methodology, phases, expected results"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground min-w-[80px] text-right">
            {status === "saving" && (<><Loader2 className="h-3 w-3 inline animate-spin mr-1" />{locale === "pt" ? "Salvando…" : "Saving…"}</>)}
            {status === "saved" && (<><Check className="h-3 w-3 inline mr-1 text-emerald-500" />{locale === "pt" ? "Salvo" : "Saved"}</>)}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-primary/80" disabled={writing}>
                {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {locale === "pt" ? "Auto-redação IA" : "AI Auto-write"}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">
                {locale === "pt" ? "Gerar com base no projeto + biblioteca (RAG)" : "Generate from project + library (RAG)"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SECTIONS.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => autowrite(s.id, s.label)} className="gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm">{s.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
              ? "Escreva aqui o texto completo do projeto. Markdown é suportado. Use 'Auto-redação IA' para gerar seções a partir do seu projeto e da biblioteca."
              : "Write the full project text here. Markdown supported."}
            className="min-h-[500px] font-mono text-sm leading-relaxed border-0 focus-visible:ring-0 resize-y bg-transparent p-0"
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none min-h-[500px]">
            {value.trim() ? <ReactMarkdown>{value}</ReactMarkdown> : <p className="text-muted-foreground">{locale === "pt" ? "Vazio." : "Empty."}</p>}
          </div>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {locale === "pt" ? "Pré-visualização — " : "Preview — "}{previewLabel}
            </DialogTitle>
            {ragInfo && (
              <p className="text-xs text-muted-foreground">
                {ragInfo.used
                  ? (locale === "pt"
                      ? `Gerado com RAG sobre ${ragInfo.papers} paper(s) da biblioteca.`
                      : `Generated with RAG over ${ragInfo.papers} library paper(s).`)
                  : (locale === "pt"
                      ? "Nenhum paper vinculado encontrado — gerado apenas com dados do projeto. Vincule referências da Biblioteca para resultados melhores."
                      : "No linked papers found — generated from project data only.")}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-muted/30">
            {writing && !previewText ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "pt" ? "Gerando com IA…" : "Generating…"}
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{previewText}</ReactMarkdown>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>{locale === "pt" ? "Cancelar" : "Cancel"}</Button>
            <Button variant="secondary" onClick={replaceAll} disabled={!previewText}>{locale === "pt" ? "Substituir tudo" : "Replace all"}</Button>
            <Button onClick={insertAtEnd} disabled={!previewText} className="gap-1.5">
              <Plus className="h-4 w-4" /> {locale === "pt" ? "Inserir no final" : "Insert at end"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
