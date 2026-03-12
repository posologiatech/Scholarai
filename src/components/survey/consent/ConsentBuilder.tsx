import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Video,
  FileText,
  ShieldCheck,
  Save,
} from "lucide-react";

interface ConsentSection {
  id: string;
  title: string;
  content_html: string;
  media_url?: string;
  media_type?: "video" | "audio";
  require_checkbox: boolean;
}

interface ConsentBuilderProps {
  surveyId: string;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const defaultSections: ConsentSection[] = [
  { id: genId(), title: "Objetivos da Pesquisa", content_html: "", require_checkbox: true },
  { id: genId(), title: "Riscos e Desconfortos", content_html: "", require_checkbox: true },
  { id: genId(), title: "Benefícios", content_html: "", require_checkbox: true },
  { id: genId(), title: "Privacidade e Confidencialidade", content_html: "", require_checkbox: true },
  { id: genId(), title: "Participação Voluntária", content_html: "", require_checkbox: true },
];

const ConsentBuilder = ({ surveyId }: ConsentBuilderProps) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("TCLE");
  const [sections, setSections] = useState<ConsentSection[]>(defaultSections);
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [requireSignature, setRequireSignature] = useState(true);
  const [consentId, setConsentId] = useState<string | null>(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["study-consent", surveyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_consents")
        .select("*")
        .eq("survey_id", surveyId)
        .maybeSingle();
      return data;
    },
    enabled: !!surveyId,
  });

  useEffect(() => {
    if (existing) {
      setConsentId(existing.id);
      setTitle(existing.title);
      setSections((existing.sections as any as ConsentSection[]) || defaultSections);
      setVideoUrl(existing.video_url || "");
      setAudioUrl(existing.audio_url || "");
      setRequireSignature(existing.require_signature);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        survey_id: surveyId,
        user_id: user!.id,
        title,
        sections: sections as any,
        video_url: videoUrl || null,
        audio_url: audioUrl || null,
        require_signature: requireSignature,
        updated_at: new Date().toISOString(),
      };

      if (consentId) {
        const { error } = await supabase
          .from("study_consents")
          .update(payload)
          .eq("id", consentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("study_consents")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setConsentId(data.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-consent", surveyId] });
      toast.success(locale === "pt" ? "TCLE salvo!" : "Consent saved!");
    },
    onError: () => toast.error(locale === "pt" ? "Erro ao salvar" : "Save failed"),
  });

  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      { id: genId(), title: "", content_html: "", require_checkbox: true },
    ]);
  }, []);

  const removeSection = useCallback((id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateSection = useCallback((id: string, updates: Partial<ConsentSection>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {locale === "pt" ? "Termo de Consentimento Livre e Esclarecido" : "Informed Consent Form"}
            </h2>
          </div>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {locale === "pt" ? "Salvar TCLE" : "Save Consent"}
          </Button>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label>{locale === "pt" ? "Título do TCLE" : "Consent Title"}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Media */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4" />
              {locale === "pt" ? "Mídia Explicativa (opcional)" : "Explanatory Media (optional)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                {locale === "pt" ? "URL do Vídeo (YouTube, Vimeo)" : "Video URL (YouTube, Vimeo)"}
              </Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {locale === "pt" ? "URL do Áudio" : "Audio URL"}
              </Label>
              <Input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Signature toggle */}
        <div className="flex items-center gap-3 p-4 border rounded-lg bg-card">
          <Switch checked={requireSignature} onCheckedChange={setRequireSignature} />
          <div>
            <Label className="text-sm font-medium">
              {locale === "pt" ? "Exigir Assinatura Digital" : "Require Digital Signature"}
            </Label>
            <p className="text-xs text-muted-foreground">
              {locale === "pt"
                ? "O participante deve assinar com o dedo ou mouse no canvas"
                : "Participant must sign with finger or mouse on canvas"}
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {locale === "pt" ? "Seções do TCLE" : "Consent Sections"}
            </h3>
            <Button variant="outline" size="sm" onClick={addSection}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {locale === "pt" ? "Adicionar Seção" : "Add Section"}
            </Button>
          </div>

          {sections.map((section, idx) => (
            <Card key={section.id} className="relative">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold text-muted-foreground w-6">{idx + 1}.</span>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    placeholder={locale === "pt" ? "Título da seção" : "Section title"}
                    className="font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(section.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Textarea
                  value={section.content_html}
                  onChange={(e) => updateSection(section.id, { content_html: e.target.value })}
                  placeholder={
                    locale === "pt"
                      ? "Conteúdo desta seção do TCLE..."
                      : "Content of this consent section..."
                  }
                  rows={4}
                />

                <div className="flex items-center gap-2">
                  <Switch
                    checked={section.require_checkbox}
                    onCheckedChange={(v) => updateSection(section.id, { require_checkbox: v })}
                  />
                  <Label className="text-xs">
                    {locale === "pt"
                      ? 'Exigir checkbox "Li e compreendi"'
                      : 'Require "I have read and understood" checkbox'}
                  </Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConsentBuilder;
