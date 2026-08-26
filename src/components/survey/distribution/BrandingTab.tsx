import { useRef, useState } from "react";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface SurveyBranding {
  logoUrl?: string;
  color?: string;
  displayName?: string;
}

const PRESET_COLORS = ["#1f6f6b", "#7c3aed", "#c2410c", "#0f172a", "#be123c", "#0891b2"];

const BrandingTab = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const { survey, updateSurveyField } = useSurveyStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const branding: SurveyBranding = survey?.settings?.branding || {};
  const color = branding.color || "#1f6f6b";

  const patchBranding = (updates: Partial<SurveyBranding>) => {
    if (!survey) return;
    updateSurveyField("settings", { ...survey.settings, branding: { ...branding, ...updates } });
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${surveyId}/logo_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("survey-branding")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("survey-branding").getPublicUrl(path);
      patchBranding({ logoUrl: data.publicUrl });
    } catch {
      toast.error(locale === "pt" ? "Falha ao enviar o logo" : "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  if (!survey) return null;

  return (
    <div className="grid gap-8 md:grid-cols-2 max-w-3xl">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-xs">{locale === "pt" ? "Logo da instituição" : "Institution logo"}</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            {locale === "pt" ? "Enviar PNG, JPG ou SVG" : "Upload PNG, JPG or SVG"}
          </button>
          {branding.logoUrl && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => patchBranding({ logoUrl: undefined })}>
              <ImageOff className="h-3 w-3 mr-1" />
              {locale === "pt" ? "Remover logo" : "Remove logo"}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{locale === "pt" ? "Cor principal" : "Primary color"}</Label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => patchBranding({ color: c })}
                style={{ backgroundColor: c }}
                className={cn(
                  "h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-shadow",
                  color === c && "ring-2 ring-foreground"
                )}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => patchBranding({ color: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
              title={locale === "pt" ? "Cor personalizada" : "Custom color"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{locale === "pt" ? "Nome de exibição" : "Display name"}</Label>
          <Input
            value={branding.displayName || ""}
            onChange={(e) => patchBranding({ displayName: e.target.value })}
            placeholder={locale === "pt" ? "Ex.: Laboratório de Psicologia" : "e.g. Psychology Lab"}
          />
          <p className="text-xs text-muted-foreground">
            {locale === "pt"
              ? "Aparece abaixo do título na página que o participante vê."
              : "Shown under the title on the page respondents see."}
          </p>
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">{locale === "pt" ? "Prévia" : "Preview"}</Label>
        <Card className="overflow-hidden">
          <div className="px-5 pt-6 pb-4 text-center" style={{ backgroundColor: `${color}0d` }}>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="mx-auto mb-2 h-8 w-8 rounded object-contain" />
            ) : (
              <div className="mx-auto mb-2 h-8 w-8 rounded" style={{ backgroundColor: color }} />
            )}
            <p className="text-sm font-semibold">{survey.title}</p>
            {branding.displayName && <p className="text-xs text-muted-foreground mt-0.5">{branding.displayName}</p>}
          </div>
          <CardContent className="pt-4 pb-5">
            <div className="h-1.5 w-full rounded-full bg-secondary mb-4 overflow-hidden">
              <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: color }} />
            </div>
            <p className="text-sm mb-4">
              {locale === "pt" ? "Com que frequência você sente dificuldade para dormir?" : "How often do you have trouble sleeping?"}
            </p>
            <span
              className="inline-block rounded-md px-4 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {locale === "pt" ? "Continuar" : "Continue"}
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BrandingTab;
