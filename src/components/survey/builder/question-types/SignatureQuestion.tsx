import { useState } from "react";
import { SurveyQuestion } from "@/hooks/useSurveyStore";
import { Button } from "@/components/ui/button";
import { Loader2, PenTool, RotateCcw } from "lucide-react";
import SignatureCanvas from "@/components/survey/consent/SignatureCanvas";
import { uploadSurveyFile } from "@/lib/survey/uploadToSurvey";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
  /** Anonymous distribution token — only set on the real public respond page, never in the
   *  builder's own preview (which has no active distribution to upload against). */
  token?: string;
}

const SignatureQuestion = ({ respondMode, value, onChange, token }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!respondMode) {
    return (
      <div className="border border-dashed rounded-md p-3 text-sm text-muted-foreground bg-muted/20 flex items-center gap-2">
        <PenTool className="h-4 w-4" />
        Campo de assinatura
      </div>
    );
  }

  if (value) {
    return (
      <div className="space-y-2">
        <div className="border rounded-lg bg-card p-2">
          <img src={value.startsWith("data:") ? value : undefined} alt="" className={value.startsWith("data:") ? "h-20 mx-auto" : "hidden"} />
          {!value.startsWith("data:") && (
            <p className="text-xs text-muted-foreground text-center py-6">Assinatura registrada</p>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => onChange?.(null)}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Assinar novamente
        </Button>
      </div>
    );
  }

  const handleSignature = async (dataUrl: string | null) => {
    if (!dataUrl) return;
    if (!token) {
      // Builder preview has no real distribution to upload against — keep the raw dataURL locally.
      onChange?.(dataUrl);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = await uploadSurveyFile(token, blob, "signature.png");
      onChange?.(path);
    } catch (err: any) {
      setError(err.message || "Falha ao salvar assinatura");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <SignatureCanvas onSignatureChange={handleSignature} />
      {uploading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Salvando assinatura...
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default SignatureQuestion;
