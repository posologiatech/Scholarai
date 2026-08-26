import { useRef, useState } from "react";
import { SurveyQuestion } from "@/hooks/useSurveyStore";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Upload, X } from "lucide-react";
import { uploadSurveyFile } from "@/lib/survey/uploadToSurvey";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
  /** Anonymous distribution token — only set on the real public respond page. */
  token?: string;
}

// Strips the `{uuid}-` prefix survey-upload/index.ts prepends to the original filename,
// so the respondent sees the name they actually picked rather than the storage key.
const displayName = (path: string) => path.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "") || path;

const FileUploadQuestion = ({ question, respondMode, value, onChange, token }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = question.settings?.accept || undefined;

  if (!respondMode) {
    return (
      <div className="border border-dashed rounded-md p-3 text-sm text-muted-foreground bg-muted/20 flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Upload de arquivo{accept ? ` (${accept})` : ""}
      </div>
    );
  }

  const handleFile = async (file: File) => {
    setError(null);
    if (!token) {
      // Builder preview: no real distribution to upload against, just reflect the pick locally.
      onChange?.(file.name);
      return;
    }
    setUploading(true);
    try {
      const path = await uploadSurveyFile(token, file);
      onChange?.(path);
    } catch (err: any) {
      setError(err.message || "Falha no envio do arquivo");
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-card">
        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate flex-1">{displayName(value)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label="Remover arquivo"
          onClick={() => onChange?.(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
        Escolher arquivo
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default FileUploadQuestion;
