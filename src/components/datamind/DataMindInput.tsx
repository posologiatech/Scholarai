import { useState, useRef } from "react";
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
  onSend: (content: string, file?: File) => void;
  loading: boolean;
  existingFiles?: DataMindFile[];
  selectedContext?: SelectedContext | null;
  onClearSelection?: () => void;
  onOpenGoogleSheetsImport?: () => void;
}

const DataMindInput = ({ onSend, loading, existingFiles = [], selectedContext, onClearSelection, onOpenGoogleSheetsImport }: Props) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim() && !file) return;
    onSend(text.trim(), file || undefined);
    setText("");
    setFile(null);
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
        {/* File attachment badge */}
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/50 border border-border/60 px-3 py-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <span className="truncate flex-1 text-foreground">{file.name}</span>
            <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
            <button onClick={() => setFile(null)}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
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

        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card p-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
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
                <span className="text-sm text-foreground">Upload File</span>
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
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta sobre seus dados..."
            className="min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none p-2 text-sm"
            disabled={loading}
            rows={1}
          />

          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={handleSend}
            disabled={loading || (!text.trim() && !file)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          DataMind usa IA para analisar dados. Verifique os resultados.
        </p>
      </div>
    </div>
  );
};

export default DataMindInput;
