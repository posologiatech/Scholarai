import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Send, X, FileSpreadsheet, Upload, FolderOpen, Search, Grid3X3, Sheet } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataMindFile, SelectedContext } from "@/pages/DataMind";

interface Props {
  onSend: (content: string, attachments?: File[]) => void;
  loading: boolean;
  existingFiles?: DataMindFile[];
  selectedContext?: SelectedContext | null;
  onClearSelection?: () => void;
  onOpenGoogleSheetsImport?: () => void;
}

/** Roughly ten lines; past that the box scrolls instead of eating the page. */
const MAX_INPUT_HEIGHT = 260;

const DataMindInput = ({ onSend, loading, existingFiles = [], selectedContext, onClearSelection, onOpenGoogleSheetsImport }: Props) => {
  const [text, setText] = useState("");
  // Several spreadsheets can ride on one message: comparing two files is a normal
  // question, and making the researcher send them one at a time would split that
  // question across turns.
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // The box grows with the question instead of scrolling a single line — a
  // question about data is often several lines long, and the researcher should be
  // able to read what they wrote before sending it.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [text]);

  const handleSend = () => {
    if (!text.trim() && attachments.length === 0) return;
    onSend(text.trim(), attachments.length > 0 ? attachments : undefined);
    setText("");
    setAttachments([]);
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setAttachments((prev) => {
      // Same file picked twice in a row is a slip, not an intention to upload it twice.
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredFiles = existingFiles.filter((f) =>
    f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="border-t border-border/40 bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Attached spreadsheets, one row each so any of them can be removed */}
        {attachments.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {attachments.map((f, i) => (
              <div
                key={`${f.name}-${f.size}-${i}`}
                className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border/60 px-3 py-2 text-sm min-w-0"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate flex-1 min-w-0 text-foreground">{f.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remover ${f.name}`}
                  className="shrink-0"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
            {attachments.length > 1 && (
              <p className="px-1 text-xs text-muted-foreground">
                {attachments.length} planilhas serão enviadas juntas e ficam disponíveis para comparação na mesma análise.
              </p>
            )}
          </div>
        )}

        {/* Selection context badge */}
        {selectedContext && selectedContext.data.length > 0 && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
            <Grid3X3 className="h-4 w-4 text-primary" />
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
              {selectedContext.summary}
            </Badge>
            <span className="text-xs text-muted-foreground">serão enviadas como contexto</span>
            <button onClick={onClearSelection} className="ml-auto">
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}

        {/* The support widget floats over the bottom-right corner on wide screens,
            which is exactly where the send button sits — inset it so the button
            stays clickable instead of being covered. */}
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card p-2 lg:pr-14">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = "";
              setAttachOpen(false);
            }}
          />

          {/* Attachment popover */}
          <Popover open={attachOpen} onOpenChange={setAttachOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={loading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start" sideOffset={8}>
              {/* Search */}
              <div className="p-2 border-b border-border/40">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Upload */}
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  fileRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Enviar planilha(s)</span>
              </button>

              {/* Google Sheets import */}
              {onOpenGoogleSheetsImport && (
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setAttachOpen(false);
                    onOpenGoogleSheetsImport();
                  }}
                >
                  <Sheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Importar do Google Sheets</span>
                </button>
              )}

              {/* Existing files */}
              {existingFiles.length > 0 && (
                <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Files ({existingFiles.length})</span>
                  </div>
                </button>
              )}

              {/* Recent files */}
              {filteredFiles.length > 0 && (
                <div className="border-t border-border/40">
                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Recent</span>
                  </div>
                  {filteredFiles.slice(0, 5).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors cursor-default"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <span className="text-xs text-foreground truncate flex-1">{f.file_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(f.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta sobre seus dados..."
            className="min-h-[76px] resize-none overflow-y-auto border-0 bg-transparent focus-visible:ring-0 shadow-none p-2 text-sm leading-relaxed"
            style={{ maxHeight: MAX_INPUT_HEIGHT }}
            disabled={loading}
            rows={3}
          />

          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={handleSend}
            disabled={loading || (!text.trim() && attachments.length === 0)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Enter envia · Shift+Enter quebra linha · DataMind usa IA para analisar dados. Verifique os resultados.
        </p>
      </div>
    </div>
  );
};

export default DataMindInput;
