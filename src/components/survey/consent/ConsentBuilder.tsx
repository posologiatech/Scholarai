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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Video,
  ShieldCheck,
  Save,
  AlertTriangle,
  Lock,
  Phone,
  Mail,
  Clock,
  MapPin,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ConsentSection {
  id: string;
  title: string;
  content_html: string;
  media_url?: string;
  media_type?: "video" | "audio";
  require_checkbox: boolean;
  is_required?: boolean;
}

interface ConsentBuilderProps {
  surveyId: string;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const VIRTUAL_RISKS_SECTION: ConsentSection = {
  id: "virtual-risks-default",
  title: "Riscos do Ambiente Virtual",
  content_html: `Este estudo utiliza uma plataforma digital para coleta de dados. É importante que você esteja ciente dos seguintes riscos e medidas de segurança:

RISCOS DO MEIO VIRTUAL:
• Risco de interceptação de dados durante a transmissão pela internet, embora improvável dado o uso de criptografia TLS 1.3
• Risco de acesso não autorizado ao dispositivo que você está utilizando (computador, celular, tablet)
• Risco de perda de privacidade caso outra pessoa acesse seu dispositivo durante ou após o preenchimento
• Risco de falhas tecnológicas (queda de internet, travamento do navegador) que podem interromper o processo
• Risco de captura de tela ou gravação não autorizada por terceiros com acesso ao seu dispositivo

MEDIDAS DE SEGURANÇA ADOTADAS:
• Toda comunicação é criptografada em trânsito (TLS 1.3) e em repouso (AES-256)
• Controle de acesso granular por políticas de segurança em nível de linha (Row-Level Security)
• Seus dados são armazenados em servidores seguros com certificações internacionais
• O IP é capturado via servidor para fins de auditoria e segurança jurídica
• Hash de integridade SHA-256 é gerado para cada assinatura
• Trilha de auditoria completa conforme GCP-ICH

RECOMENDAÇÕES AO PARTICIPANTE:
• Utilize um dispositivo pessoal e seguro (evite computadores públicos ou compartilhados)
• Certifique-se de estar em um local privado durante o preenchimento
• Não compartilhe o link de acesso ao questionário com terceiros
• Após concluir, feche o navegador para encerrar sua sessão`,
  require_checkbox: true,
  is_required: true,
};

const defaultSections: ConsentSection[] = [
  { id: genId(), title: "Objetivos da Pesquisa", content_html: "", require_checkbox: true },
  { id: genId(), title: "Riscos e Desconfortos", content_html: "", require_checkbox: true },
  VIRTUAL_RISKS_SECTION,
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
  const [currentVersion, setCurrentVersion] = useState(1);
  const [showVersionWarning, setShowVersionWarning] = useState(false);
  const [hasExistingSignatures, setHasExistingSignatures] = useState(false);

  // Researcher contact fields (Art. 2.2-V/VI CONEP)
  const [researcherName, setResearcherName] = useState("");
  const [researcherEmail, setResearcherEmail] = useState("");
  const [researcherPhone, setResearcherPhone] = useState("");
  const [contactHours, setContactHours] = useState("");
  // Paper access info (Art. 2.3-I CONEP)
  const [paperAccessInfo, setPaperAccessInfo] = useState("");

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

  const { data: signatureCount = 0 } = useQuery({
    queryKey: ["consent-signature-count", consentId],
    queryFn: async () => {
      if (!consentId) return 0;
      const { count } = await supabase
        .from("consent_signatures")
        .select("*", { count: "exact", head: true })
        .eq("consent_id", consentId);
      return count || 0;
    },
    enabled: !!consentId,
  });

  useEffect(() => {
    if (existing) {
      setConsentId(existing.id);
      setTitle(existing.title);
      const loadedSections = (existing.sections as any as ConsentSection[]) || defaultSections;
      // Ensure virtual risks section exists
      const hasVirtualRisks = loadedSections.some(
        (s) => s.is_required && s.title === "Riscos do Ambiente Virtual"
      );
      if (!hasVirtualRisks) {
        loadedSections.splice(2, 0, VIRTUAL_RISKS_SECTION);
      }
      setSections(loadedSections);
      setVideoUrl(existing.video_url || "");
      setAudioUrl(existing.audio_url || "");
      setRequireSignature(existing.require_signature);
      setCurrentVersion((existing as any).version || 1);
      setResearcherName((existing as any).researcher_name || "");
      setResearcherEmail((existing as any).researcher_email || "");
      setResearcherPhone((existing as any).researcher_phone || "");
      setContactHours((existing as any).contact_hours || "");
      setPaperAccessInfo((existing as any).paper_access_info || "");
    }
  }, [existing]);

  useEffect(() => {
    setHasExistingSignatures(signatureCount > 0);
  }, [signatureCount]);

  const doSave = async (bumpVersion: boolean) => {
    const newVersion = bumpVersion ? currentVersion + 1 : currentVersion;

    const payload: any = {
      survey_id: surveyId,
      user_id: user!.id,
      title,
      sections: sections as any,
      video_url: videoUrl || null,
      audio_url: audioUrl || null,
      require_signature: requireSignature,
      updated_at: new Date().toISOString(),
      version: newVersion,
      researcher_name: researcherName || null,
      researcher_email: researcherEmail || null,
      researcher_phone: researcherPhone || null,
      contact_hours: contactHours || null,
      paper_access_info: paperAccessInfo || null,
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

    setCurrentVersion(newVersion);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (hasExistingSignatures && consentId) {
        setShowVersionWarning(true);
        return;
      }
      await doSave(false);
    },
    onSuccess: () => {
      if (!showVersionWarning) {
        queryClient.invalidateQueries({ queryKey: ["study-consent", surveyId] });
        toast.success(locale === "pt" ? "TCLE salvo!" : "Consent saved!");
      }
    },
    onError: () => toast.error(locale === "pt" ? "Erro ao salvar" : "Save failed"),
  });

  const handleVersionedSave = async (bump: boolean) => {
    setShowVersionWarning(false);
    try {
      await doSave(bump);
      queryClient.invalidateQueries({ queryKey: ["study-consent", surveyId] });
      toast.success(
        locale === "pt"
          ? bump
            ? `TCLE salvo como versão ${currentVersion + 1}!`
            : "TCLE salvo (mesma versão)!"
          : bump
            ? `Consent saved as version ${currentVersion + 1}!`
            : "Consent saved (same version)!"
      );
    } catch {
      toast.error(locale === "pt" ? "Erro ao salvar" : "Save failed");
    }
  };

  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      { id: genId(), title: "", content_html: "", require_checkbox: true },
    ]);
  }, []);

  const removeSection = useCallback((id: string, isRequired?: boolean) => {
    if (isRequired) {
      toast.error(
        locale === "pt"
          ? "Esta seção é obrigatória conforme o Ofício Circular CONEP nº 23/2022 e não pode ser removida."
          : "This section is required per CONEP Circular nº 23/2022 and cannot be removed."
      );
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, [locale]);

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
            <Badge variant="outline" className="ml-2 text-xs">
              v{currentVersion}
            </Badge>
          </div>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {locale === "pt" ? "Salvar TCLE" : "Save Consent"}
          </Button>
        </div>

        {/* Signature count info */}
        {hasExistingSignatures && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {locale === "pt"
                ? `${signatureCount} participante(s) já assinaram a versão ${currentVersion}. Alterações criarão uma nova versão.`
                : `${signatureCount} participant(s) already signed version ${currentVersion}. Changes will create a new version.`}
            </span>
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <Label>{locale === "pt" ? "Título do TCLE" : "Consent Title"}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Researcher Contact (Art. 2.2-V/VI CONEP) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {locale === "pt" ? "Contato do Pesquisador (Art. 2.2 CONEP)" : "Researcher Contact (Art. 2.2 CONEP)"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {locale === "pt"
                ? "Essas informações serão exibidas ao participante durante todo o processo de consentimento."
                : "This info will be shown to the participant throughout the consent process."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {locale === "pt" ? "Nome do Pesquisador" : "Researcher Name"}
                </Label>
                <Input
                  value={researcherName}
                  onChange={(e) => setResearcherName(e.target.value)}
                  placeholder="Dr. João Silva"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {locale === "pt" ? "E-mail" : "Email"}
                </Label>
                <Input
                  value={researcherEmail}
                  onChange={(e) => setResearcherEmail(e.target.value)}
                  placeholder="pesquisador@universidade.br"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {locale === "pt" ? "Telefone" : "Phone"}
                </Label>
                <Input
                  value={researcherPhone}
                  onChange={(e) => setResearcherPhone(e.target.value)}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {locale === "pt" ? "Horários de Atendimento" : "Contact Hours"}
                </Label>
                <Input
                  value={contactHours}
                  onChange={(e) => setContactHours(e.target.value)}
                  placeholder="Seg-Sex, 08h-17h"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paper access (Art. 2.3-I CONEP) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {locale === "pt" ? "Acesso em Papel (Art. 2.3 CONEP)" : "Paper Access (Art. 2.3 CONEP)"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {locale === "pt"
                ? "Informe o endereço ou contato onde o participante pode solicitar uma via impressa do TCLE."
                : "Provide the address or contact where participants can request a printed copy."}
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={paperAccessInfo}
              onChange={(e) => setPaperAccessInfo(e.target.value)}
              placeholder={
                locale === "pt"
                  ? "Endereço: Rua..., Sala...\nTelefone: (11) 99999-0000\nHorário: Seg-Sex, 08h-17h"
                  : "Address: ...\nPhone: ...\nHours: Mon-Fri, 8am-5pm"
              }
              rows={3}
            />
          </CardContent>
        </Card>

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
            <Card key={section.id} className={section.is_required ? "relative border-primary/30" : "relative"}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold text-muted-foreground w-6">{idx + 1}.</span>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    placeholder={locale === "pt" ? "Título da seção" : "Section title"}
                    className="font-medium"
                    disabled={section.is_required}
                  />
                  {section.is_required ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px] gap-1">
                      <Lock className="h-3 w-3" />
                      {locale === "pt" ? "Obrigatória (CONEP)" : "Required (CONEP)"}
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSection(section.id, section.is_required)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <Textarea
                  value={section.content_html}
                  onChange={(e) => updateSection(section.id, { content_html: e.target.value })}
                  placeholder={
                    locale === "pt"
                      ? "Conteúdo desta seção do TCLE..."
                      : "Content of this consent section..."
                  }
                  rows={section.is_required ? 6 : 4}
                />

                <div className="flex items-center gap-2">
                  <Switch
                    checked={section.require_checkbox}
                    onCheckedChange={(v) => updateSection(section.id, { require_checkbox: v })}
                    disabled={section.is_required}
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

      {/* Version warning dialog */}
      <Dialog open={showVersionWarning} onOpenChange={setShowVersionWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {locale === "pt" ? "Versionamento do TCLE" : "Consent Versioning"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {locale === "pt"
              ? `Existem ${signatureCount} assinatura(s) na versão ${currentVersion}. Conforme exigência do CEP, alterações no TCLE após assinaturas devem gerar uma nova versão. Deseja criar a versão ${currentVersion + 1}?`
              : `There are ${signatureCount} signature(s) on version ${currentVersion}. Per ethics requirements, changes after signatures must create a new version. Create version ${currentVersion + 1}?`}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleVersionedSave(false)}>
              {locale === "pt" ? "Salvar sem versionar" : "Save without versioning"}
            </Button>
            <Button onClick={() => handleVersionedSave(true)}>
              {locale === "pt" ? `Criar v${currentVersion + 1}` : `Create v${currentVersion + 1}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsentBuilder;
