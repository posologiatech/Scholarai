import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RefreshCw, Wand2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  originalPrompt: string;
  onEdited: () => void;
}

export default function IllustrationEditor({ open, onClose, imageUrl, originalPrompt, onEdited }: Props) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-illustration", {
        body: { existingImageUrl: imageUrl, editInstruction: instruction.trim() },
      });

      if (error) { toast.error((error as any)?.message || "Error"); return; }
      if (data?.error) { toast.error(data.error); return; }

      setResult(data.image_url);
      toast.success(pt ? "Edição aplicada!" : "Edit applied!");
      onEdited();
    } catch {
      toast.error(pt ? "Erro inesperado" : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInstruction("");
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {pt ? "Editar com IA" : "Edit with AI"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{pt ? "Original" : "Original"}</p>
              <div className="rounded-lg border border-border overflow-hidden bg-white">
                <img src={imageUrl} alt="Original" className="w-full object-contain max-h-[300px]" />
              </div>
            </div>
            {result && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{pt ? "Editada" : "Edited"}</p>
                <div className="rounded-lg border border-primary/30 overflow-hidden bg-white">
                  <img src={result} alt="Edited" className="w-full object-contain max-h-[300px]" />
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1">
            {pt ? "Prompt original:" : "Original prompt:"} {originalPrompt}
          </p>

          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={pt
              ? "Ex: Mude a cor das mitocôndrias para azul, adicione uma legenda no canto inferior..."
              : "E.g., Change the mitochondria color to blue, add a legend in the bottom corner..."}
            className="min-h-[80px]"
            disabled={loading}
          />

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              {pt ? "Fechar" : "Close"}
            </Button>
            <Button onClick={handleEdit} disabled={loading || !instruction.trim()}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  {pt ? "Editando..." : "Editing..."}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-1" />
                  {pt ? "Aplicar edição" : "Apply edit"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
