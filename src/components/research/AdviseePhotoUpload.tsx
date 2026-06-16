import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  value: string;
  onChange: (url: string) => void;
}

const sanitize = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");

export const AdviseePhotoUpload = ({ value, onChange }: Props) => {
  const { locale } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      return toast.error(locale === "pt" ? "Selecione uma imagem" : "Select an image");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error(locale === "pt" ? "Imagem deve ter até 5MB" : "Image must be under 5MB");
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `advisees/${crypto.randomUUID()}-${sanitize(file.name).slice(0, 40)}.${ext}`;
      const { error } = await supabase.storage.from("research-content").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("research-content").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-16 w-16">
        <AvatarImage src={value} alt="" />
        <AvatarFallback><User className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
      </Avatar>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {value ? (locale === "pt" ? "Trocar foto" : "Change photo") : (locale === "pt" ? "Enviar foto" : "Upload photo")}
      </Button>
    </div>
  );
};
