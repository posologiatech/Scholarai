import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RichText } from "./RichText";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, List, ListOrdered, Heading2, Table as TableIcon,
  Link2, Image as ImageIcon, Loader2, Eye, Pencil, Quote, Maximize2,
} from "lucide-react";

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

const TABLE_SNIPPET = "\n\n| Coluna 1 | Coluna 2 | Coluna 3 |\n| --- | --- | --- |\n| | | |\n| | | |\n\n";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  storagePrefix?: string;
  className?: string;
  onExpand?: () => void;
}

export const RichEditor = ({
  value, onChange, placeholder, minHeight = 200, storagePrefix = "misc", className, onExpand,
}: Props) => {
  const { locale } = useLanguage();
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const surround = (before: string, after = before, placeholderText = "texto") => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  };

  const insertAtCursor = (text: string) => {
    const ta = taRef.current;
    const pos = ta ? ta.selectionStart : value.length;
    onChange(value.slice(0, pos) + text + value.slice(pos));
  };

  const linePrefix = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) { insertAtCursor(prefix); return; }
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(locale === "pt" ? "Selecione uma imagem" : "Select an image");
      return;
    }
    setUploading(true);
    try {
      const path = `${storagePrefix}/${Date.now()}-${sanitize(file.name)}`;
      const { error } = await supabase.storage.from("research-content").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("research-content").getPublicUrl(path);
      insertAtCursor(`\n\n![${file.name}](${data.publicUrl})\n\n`);
      toast.success(locale === "pt" ? "Imagem inserida" : "Image inserted");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const btn = "h-7 w-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors";

  return (
    <div className={cn("rounded-xl border bg-card/40 overflow-hidden", className)}>
      <div className="flex items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1 flex-wrap">
        <button type="button" className={btn} title="Negrito" onClick={() => surround("**")}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Itálico" onClick={() => surround("*")}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Título" onClick={() => linePrefix("## ")}><Heading2 className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Citação" onClick={() => linePrefix("> ")}><Quote className="h-3.5 w-3.5" /></button>
        <span className="w-px h-4 bg-border mx-1" />
        <button type="button" className={btn} title="Lista" onClick={() => linePrefix("- ")}><List className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Lista numerada" onClick={() => linePrefix("1. ")}><ListOrdered className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Tabela" onClick={() => insertAtCursor(TABLE_SNIPPET)}><TableIcon className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Link" onClick={() => surround("[", "](https://)", "texto")}><Link2 className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Imagem" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div className="ml-auto flex items-center gap-1">
          {onExpand && (
            <button type="button" className={btn} title={locale === "pt" ? "Expandir" : "Expand"} onClick={onExpand}><Maximize2 className="h-3.5 w-3.5" /></button>
          )}
          <div className="flex rounded-md border overflow-hidden text-[11px]">
            <button type="button" onClick={() => setMode("edit")} className={cn("px-2 py-0.5 flex items-center gap-1", mode === "edit" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><Pencil className="h-3 w-3" />{locale === "pt" ? "Editar" : "Edit"}</button>
            <button type="button" onClick={() => setMode("preview")} className={cn("px-2 py-0.5 flex items-center gap-1", mode === "preview" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><Eye className="h-3 w-3" />{locale === "pt" ? "Ver" : "View"}</button>
          </div>
        </div>
      </div>
      {mode === "edit" ? (
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="border-0 rounded-none focus-visible:ring-0 resize-y font-mono text-sm leading-relaxed bg-transparent"
        />
      ) : (
        <div className="p-4 overflow-y-auto" style={{ minHeight }}>
          <RichText content={value} />
        </div>
      )}
    </div>
  );
};

export default RichEditor;
