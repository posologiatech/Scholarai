import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, Camera, Trash2, Loader2 } from "lucide-react";

interface DocumentUploadProps {
  participantId: string;
  visitId: string | null;
  existingDocs: any[];
}

const fileTypeLabels: Record<string, { pt: string; en: string }> = {
  lab_result: { pt: "Resultado de Exame", en: "Lab Result" },
  prescription: { pt: "Receita Médica", en: "Prescription" },
  image: { pt: "Imagem Clínica", en: "Clinical Image" },
  other: { pt: "Outro", en: "Other" },
};

const DocumentUpload = ({ participantId, visitId, existingDocs }: DocumentUploadProps) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileType, setFileType] = useState("lab_result");

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);

      // Sanitize filename
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const filePath = `${user!.id}/${participantId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("study-documents")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("participant_documents").insert({
        participant_id: participantId,
        visit_id: visitId,
        user_id: user!.id,
        file_name: file.name,
        file_path: filePath,
        file_type: fileType,
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-documents", participantId] });
      toast.success(locale === "pt" ? "Documento enviado!" : "Document uploaded!");
    },
    onError: (err: any) => {
      toast.error(err.message || (locale === "pt" ? "Erro no upload" : "Upload failed"));
    },
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("study-documents").remove([doc.file_path]);
      const { error } = await supabase.from("participant_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-documents", participantId] });
      toast.success(locale === "pt" ? "Documento removido" : "Document removed");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(locale === "pt" ? "Arquivo muito grande (max 20MB)" : "File too large (max 20MB)");
        return;
      }
      uploadMutation.mutate(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={fileType} onValueChange={setFileType}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(fileTypeLabels).map(([key, labels]) => (
              <SelectItem key={key} value={key}>
                {locale === "pt" ? labels.pt : labels.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileChange}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1" />
          )}
          {locale === "pt" ? "Enviar Arquivo" : "Upload File"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (fileRef.current) {
              fileRef.current.setAttribute("capture", "environment");
              fileRef.current.click();
              fileRef.current.removeAttribute("capture");
            }
          }}
          disabled={uploading}
        >
          <Camera className="h-3.5 w-3.5 mr-1" />
          {locale === "pt" ? "Câmera" : "Camera"}
        </Button>
      </div>

      {/* Existing docs */}
      {existingDocs.length > 0 && (
        <div className="space-y-2">
          {existingDocs.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 border rounded-md bg-card text-sm"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{doc.file_name}</span>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {fileTypeLabels[doc.file_type]
                  ? locale === "pt"
                    ? fileTypeLabels[doc.file_type].pt
                    : fileTypeLabels[doc.file_type].en
                  : doc.file_type}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => deleteMutation.mutate(doc)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
