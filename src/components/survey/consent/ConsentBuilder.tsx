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
  BookOpen,
  CheckCircle2,
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

// Readability analysis (Art. 2.1-II CONEP)
function analyzeReadability(text: string): { score: number; level: string; suggestions: string[] } {
  if (!text || text.trim().length < 10) return { score: 0, level: "—", suggestions: [] };

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
  const avgSyllablesPerWord = words.length > 0 ? syllables / words.length : 0;

  // Simplified Flesch Reading Ease adapted for Portuguese
  const score = Math.max(0, Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord));

  let level: string;
  const suggestions: string[] = [];

  if (score >= 70) level = "Fácil";
  else if (score >= 50) level = "Moderado";
  else {
    level = "Difícil";
    suggestions.push("Considere simplificar frases longas e usar palavras mais curtas.");
  }

  if (avgWordsPerSentence > 25) suggestions.push("Frases muito longas (média > 25 palavras). Divida em frases menores.");
  if (avgSyllablesPerWord > 2.5) suggestions.push("Muitas palavras complexas. Use sinônimos mais simples quando possível.");

  const jargonPatterns = /\b(randomiz|aleatorizad|placebo|double-blind|duplo-cego|coorte|longitudinal|transversal|metodolog|epidemiolog)\w*/gi;
  const jargonMatches = text.match(jargonPatterns);
  if (jargonMatches && jargonMatches.length > 3) {
    suggestions.push(`${jargonMatches.length} termos técnicos encontrados. Explique cada termo em linguagem acessível.`);
  }

  return { score: Math.round(score), level, suggestions };
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-záàâãéèêíïóôõúüç]/g, "");
  if (w.length <= 2) return 1;
  const vowelGroups = w.match(/[aáàâãeéèêiíoóôõuúü]+/g);
  return vowelGroups ? Math.max(1, vowelGroups.length) : 1;
}

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
  const [showReadability, setShowReadability] = useState(false);

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

  // Compute readability for all sections
  const fullText = sections.map((s) => s.content_html).join(" ");
  const readability = analyzeReadability(fullText);

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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReadability(true)}>
              <BookOpen className="h-4 w-4 mr-1" />
              {locale === "pt" ? "Legibilidade" : "Readability"}
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {locale === "pt" ? "Salvar TCLE" : "Save Consent"}
            </Button>
          </div>
        </div>

        {/* First-time explainer */}
        <div className="flex items-start gap-2 p-3 border rounded-lg bg-primary/5 border-primary/20 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <p className="text-muted-foreground">
            {locale === "pt"
              ? "O TCLE é o documento que cada participante lê e assina antes de responder ao estudo. As seções abaixo já vêm com um modelo pronto conforme as exigências do CEP — edite o conteúdo, preencha os dados de contato do pesquisador e clique em \"Salvar TCLE\" para publicar."
              : "The consent form (TCLE) is what each participant reads and signs before answering the study. The sections below start from a template that meets ethics committee requirements — edit the content, fill in the researcher's contact details, and click \"Save Consent\" to publish it."}
          </p>
        </div>

        {/* Readability indicator (Art. 2.1-II CONEP) */}
        {fullText.trim().length > 50 && (
          <div className={`flex items-center gap-2 p-3 border rounded-lg text-sm ${
            readability.score >= 70 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800" :
            readability.score >= 50 ? "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800" :
            "bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
          }`}>
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>
              {locale === "pt"
                ? `Legibilidade: ${readability.level} (${readability.score}/100) — Art. 2.1-II CONEP`
                : `Readability: ${readability.level} (${readability.score}/100) — Art. 2.1-II CONEP`}
            </span>
            {readability.suggestions.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => setShowReadability(true)}>
                {locale === "pt" ? "Ver sugestões" : "See suggestions"}
              </Button>
            )}
          </div>
        )}

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

          {sections.map((section, idx) => {
            const sectionReadability = analyzeReadability(section.content_html);
            return (
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

                  {/* Per-section readability (Art. 2.1-II) */}
                  {section.content_html.trim().length > 30 && (
                    <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded ${
                      sectionReadability.score >= 70 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" :
                      sectionReadability.score >= 50 ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                      "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                    }`}>
                      <BookOpen className="h-3 w-3" />
                      {sectionReadability.level} ({sectionReadability.score}/100)
                    </div>
                  )}

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
            );
          })}
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

      {/* Readability analysis dialog (Art. 2.1-II CONEP) */}
      <Dialog open={showReadability} onOpenChange={setShowReadability}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {locale === "pt" ? "Análise de Legibilidade (Art. 2.1-II CONEP)" : "Readability Analysis (Art. 2.1-II CONEP)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {locale === "pt"
                ? "O Ofício Circular CONEP nº 23/2022 exige que o TCLE seja redigido em linguagem acessível ao participante. Esta análise avalia a complexidade do texto."
                : "CONEP Circular nº 23/2022 requires consent to be written in accessible language. This analysis evaluates text complexity."}
            </p>

            {/* Overall score */}
            <div className={`p-4 rounded-lg text-center ${
              readability.score >= 70 ? "bg-emerald-50 dark:bg-emerald-950/20" :
              readability.score >= 50 ? "bg-amber-50 dark:bg-amber-950/20" :
              "bg-red-50 dark:bg-red-950/20"
            }`}>
              <p className="text-3xl font-bold">{readability.score}<span className="text-sm font-normal">/100</span></p>
              <p className="text-sm font-medium mt-1">{readability.level}</p>
            </div>

            {/* Per-section scores */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{locale === "pt" ? "Por seção:" : "Per section:"}</p>
              {sections.filter((s) => s.content_html.trim().length > 10).map((s) => {
                const r = analyzeReadability(s.content_html);
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs p-2 border rounded">
                    <span className="truncate max-w-[200px]">{s.title || "—"}</span>
                    <Badge variant={r.score >= 70 ? "default" : r.score >= 50 ? "secondary" : "destructive"} className="text-[10px]">
                      {r.level} ({r.score})
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Suggestions */}
            {readability.suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{locale === "pt" ? "Sugestões:" : "Suggestions:"}</p>
                {readability.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {readability.suggestions.length === 0 && readability.score >= 70 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {locale === "pt" ? "O texto está em nível de legibilidade adequado." : "Text readability is adequate."}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsentBuilder;