import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X, FileSpreadsheet } from "lucide-react";

interface Props {
  onSend: (content: string, file?: File) => void;
  loading: boolean;
}

const DataMindInput = ({ onSend, loading }: Props) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

  return (
    <div className="border-t border-border/40 bg-background p-4">
      <div className="max-w-4xl mx-auto">
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
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

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
