import { useState, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  Clock,
  FileText,
  ZoomIn,
  ZoomOut,
  Eye,
  Timer,
} from "lucide-react";
import SignatureCanvas from "./SignatureCanvas";

interface ConsentSection {
  id: string;
  title: string;
  content_html: string;
  media_url?: string;
  media_type?: "video" | "audio";
  require_checkbox: boolean;
}

interface ConsentData {
  id: string;
  title: string;
  sections: ConsentSection[];
  video_url: string | null;
  audio_url: string | null;
  require_signature: boolean;
  researcher_name?: string;
  researcher_email?: string;
  researcher_phone?: string;
  contact_hours?: string;
  paper_access_info?: string;
}

interface ConsentRespondProps {
  consent: ConsentData;
  onConsentComplete: (signatureId: string) => void;
}

const ConsentRespond = ({ consent, onConsentComplete }: ConsentRespondProps) => {
  const { locale } = useLanguage();
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [showPrivacyScreen, setShowPrivacyScreen] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);

  // Accessibility (Art. 2.1-III CONEP)
  const [fontSize, setFontSize] = useState(14);
  const [highContrast, setHighContrast] = useState(false);

  // Reading time tracking (Art. 2.2-IV CONEP)
  const [sectionTimestamps, setSectionTimestamps] = useState<Record<string, number>>({});
  const sectionEnteredAt = useRef<number>(Date.now());

  // Document access logging (Art. 5.2 CONEP)
  const accessLogged = useRef(false);

  const sections = consent.sections || [];
  const totalSteps = sections.length + 1;
  const isOnSignatureStep = currentStep >= sections.length;
  const progress = showPrivacyScreen ? 0 : ((currentStep + 1) / totalSteps) * 100;

  const currentSection = !isOnSignatureStep ? sections[currentStep] : null;

  const hasResearcherContact = consent.researcher_name || consent.researcher_email || consent.researcher_phone;

  // Log document access when consent loads (Art. 5.2)
  useEffect(() => {
    if (!accessLogged.current && consent.id) {
      accessLogged.current = true;
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consent-sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "log_access", consentId: consent.id }),
      }).catch(() => {}); // fire and forget
    }
  }, [consent.id]);

  // Track time per section
  useEffect(() => {
    sectionEnteredAt.current = Date.now();
  }, [currentStep]);

  const recordSectionTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - sectionEnteredAt.current) / 1000);
    const sectionId = currentSection?.id || "signature";
    setSectionTimestamps((prev) => ({
      ...prev,
      [sectionId]: (prev[sectionId] || 0) + elapsed,
    }));
  }, [currentSection]);

  const canProceed = useCallback(() => {
    if (isOnSignatureStep) {
      if (!name.trim()) return false;
      if (consent.require_signature && !signatureData) return false;
      if (!receiptConfirmed) return false;
      return true;
    }
    if (currentSection?.require_checkbox && !confirmations[currentSection.id]) return false;
    return true;
  }, [isOnSignatureStep, currentSection, confirmations, name, signatureData, consent.require_signature, receiptConfirmed]);

  const handleSubmitConsent = async () => {
    setSubmitting(true);
    try {
      recordSectionTime();

      const sectionConfirmations = Object.entries(confirmations)
        .filter(([, v]) => v)
        .map(([sectionId]) => ({
          section_id: sectionId,
          confirmed_at: new Date().toISOString(),
        }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consent-sign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            consentId: consent.id,
            respondentName: name,
            respondentEmail: email || null,
            signatureData,
            sectionConfirmations,
            consentTitle: consent.title,
            sections: sections.map((s) => ({ title: s.title, content_html: s.content_html })),
            paperAccessInfo: consent.paper_access_info || null,
            readingTimes: sectionTimestamps,
            receiptConfirmed: true,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to sign consent");

      setCompleted(true);
      onConsentComplete(result.signatureId);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar consentimento");
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
        <h2 className="text-xl font-semibold">
          {locale === "pt" ? "Consentimento Registrado!" : "Consent Recorded!"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? email
              ? "Uma cópia do TCLE foi enviada ao seu e-mail. Aguarde, você será redirecionado ao questionário..."
              : "Aguarde, você será redirecionado ao questionário..."
            : email
              ? "A copy of the consent was sent to your email. Please wait, redirecting..."
              : "Please wait, you will be redirected to the questionnaire..."}
        </p>
      </div>
    );
  }

  // Accessibility controls bar
  const AccessibilityBar = () => (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30 text-xs">
      <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground shrink-0">
        {locale === "pt" ? "Acessibilidade:" : "Accessibility:"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setFontSize((f) => Math.max(12, f - 2))}
        title={locale === "pt" ? "Diminuir fonte" : "Decrease font"}
      >
        <ZoomOut className="h-3 w-3" />
      </Button>
      <span className="text-xs font-mono w-8 text-center">{fontSize}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setFontSize((f) => Math.min(24, f + 2))}
        title={locale === "pt" ? "Aumentar fonte" : "Increase font"}
      >
        <ZoomIn className="h-3 w-3" />
      </Button>
      <Button
        variant={highContrast ? "default" : "ghost"}
        size="sm"
        className="h-6 text-[10px] px-2"
        onClick={() => setHighContrast((c) => !c)}
      >
        {locale === "pt" ? "Alto Contraste" : "High Contrast"}
      </Button>
    </div>
  );

  const contentStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: "1.7",
    ...(highContrast ? { color: "hsl(var(--foreground))", fontWeight: 500 } : {}),
  };

  // Privacy location screen (Art. 2.2-VII CONEP)
  if (showPrivacyScreen) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{consent.title}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              {locale === "pt" ? "Aviso Importante sobre Privacidade" : "Important Privacy Notice"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {locale === "pt"
                ? "Antes de prosseguir, certifique-se de que você está em um local privado e seguro para ler este documento e formalizar seu consentimento. O sigilo e a confidencialidade das informações dependem também da segurança do ambiente onde você se encontra."
                : "Before proceeding, make sure you are in a private and secure location to read this document and formalize your consent. The secrecy and confidentiality of the information also depend on the security of the environment where you are."}
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>{locale === "pt" ? "Evite locais públicos ou computadores compartilhados" : "Avoid public places or shared computers"}</li>
              <li>{locale === "pt" ? "Certifique-se de que ninguém pode ver sua tela" : "Make sure no one can see your screen"}</li>
              <li>{locale === "pt" ? "Utilize uma conexão de internet segura" : "Use a secure internet connection"}</li>
            </ul>

            <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50">
              <Checkbox
                id="privacy-confirm"
                checked={privacyConfirmed}
                onCheckedChange={(v) => setPrivacyConfirmed(!!v)}
              />
              <Label htmlFor="privacy-confirm" className="text-sm leading-relaxed cursor-pointer">
                {locale === "pt"
                  ? "Confirmo que estou em um local seguro e privado para ler este termo e formalizar meu consentimento."
                  : "I confirm I am in a secure and private location to read this document and formalize my consent."}
              </Label>
            </div>

            <Button
              className="w-full"
              disabled={!privacyConfirmed}
              onClick={() => setShowPrivacyScreen(false)}
            >
              {locale === "pt" ? "Prosseguir para o TCLE" : "Proceed to Consent"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {hasResearcherContact && (
          <ResearcherContactCard consent={consent} locale={locale} />
        )}
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto px-4 py-6 space-y-6 ${highContrast ? "bg-background text-foreground" : ""}`}>
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{consent.title}</h1>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {locale === "pt" ? "Etapa" : "Step"} {currentStep + 1} / {totalSteps}
          </p>
          {/* Reading time indicator (Art. 2.2-IV) */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="h-3 w-3" />
            {Math.round((Date.now() - sectionEnteredAt.current) / 1000)}s
          </div>
        </div>
      </div>

      {/* Accessibility controls (Art. 2.1-III CONEP) */}
      <AccessibilityBar />

      {/* Researcher contact card - always visible (Art. 2.2-V/VI) */}
      {hasResearcherContact && (
        <ResearcherContactCard consent={consent} locale={locale} />
      )}

      {/* Video/Audio */}
      {currentStep === 0 && consent.video_url && (
        <Card>
          <CardContent className="pt-4">
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe
                src={consent.video_url.replace("watch?v=", "embed/")}
                className="w-full h-full"
                allowFullScreen
                title="Explanatory video"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 0 && consent.audio_url && (
        <Card>
          <CardContent className="pt-4">
            <audio controls className="w-full" src={consent.audio_url} />
          </CardContent>
        </Card>
      )}

      {/* Section content */}
      {currentSection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {currentStep + 1}. {currentSection.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="prose prose-sm max-w-none whitespace-pre-wrap"
              style={contentStyle}
            >
              {currentSection.content_html}
            </div>

            {currentSection.require_checkbox && (
              <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50">
                <Checkbox
                  id={`confirm-${currentSection.id}`}
                  checked={!!confirmations[currentSection.id]}
                  onCheckedChange={(v) =>
                    setConfirmations((prev) => ({ ...prev, [currentSection.id]: !!v }))
                  }
                />
                <Label htmlFor={`confirm-${currentSection.id}`} className="text-sm leading-relaxed cursor-pointer">
                  {locale === "pt"
                    ? "Declaro que li e compreendi esta seção"
                    : "I declare that I have read and understood this section"}
                </Label>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Signature step */}
      {isOnSignatureStep && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {locale === "pt" ? "Identificação e Assinatura" : "Identification & Signature"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "pt" ? "Nome Completo *" : "Full Name *"}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{locale === "pt" ? "E-mail (para receber cópia do TCLE)" : "Email (to receive consent copy)"}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {locale === "pt"
                    ? "Conforme Resolução 466/2012, você receberá uma cópia deste termo por e-mail."
                    : "Per regulation, you will receive a copy of this consent via email."}
                </p>
              </div>

              {consent.require_signature && (
                <div className="space-y-2">
                  <Label>{locale === "pt" ? "Assinatura Digital *" : "Digital Signature *"}</Label>
                  <SignatureCanvas onSignatureChange={setSignatureData} />
                </div>
              )}

              {/* Receipt confirmation (Art. 5.1 CONEP) */}
              <div className="flex items-start gap-3 p-3 border rounded-lg bg-primary/5">
                <Checkbox
                  id="receipt-confirm"
                  checked={receiptConfirmed}
                  onCheckedChange={(v) => setReceiptConfirmed(!!v)}
                />
                <Label htmlFor="receipt-confirm" className="text-sm leading-relaxed cursor-pointer">
                  {locale === "pt"
                    ? "Confirmo que recebi todas as informações necessárias para tomar minha decisão e que desejo receber uma cópia deste termo (Art. 5.1, Ofício Circular CONEP nº 23/2022)."
                    : "I confirm I received all necessary information to make my decision and wish to receive a copy of this consent (Art. 5.1, CONEP Circular nº 23/2022)."}
                </Label>
              </div>

              {/* Paper access notice (Art. 2.3-I CONEP) */}
              {consent.paper_access_info && (
                <div className="p-3 border rounded-lg bg-muted/30 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {locale === "pt" ? "Acesso à via impressa do TCLE" : "Access to printed consent copy"}
                  </p>
                  <p>
                    {locale === "pt"
                      ? "Você tem o direito de solicitar uma via impressa deste Termo de Consentimento. Para isso, entre em contato:"
                      : "You have the right to request a printed copy of this Consent Form. Contact:"}
                  </p>
                  <p className="whitespace-pre-wrap">{consent.paper_access_info}</p>
                </div>
              )}

              {/* Legal basis notice */}
              <div className="p-3 border rounded-lg bg-muted/30 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  {locale === "pt" ? "Base Legal e Direitos" : "Legal Basis & Rights"}
                </p>
                <p>
                  {locale === "pt"
                    ? "O tratamento dos seus dados é fundamentado no Art. 7°, inciso IV da LGPD (Lei 13.709/2018) — pesquisa científica com consentimento informado."
                    : "Data processing is based on LGPD Art. 7, IV — scientific research with informed consent."}
                </p>
                <p>
                  {locale === "pt"
                    ? "Você pode revogar este consentimento a qualquer momento, conforme Art. 8° §5° da LGPD e Resolução CNS 466/2012, sem qualquer prejuízo. Um link para revogação será enviado junto à cópia do TCLE."
                    : "You may revoke this consent at any time per LGPD Art. 8 §5 and Resolution CNS 466/2012, without any penalty. A revocation link will be sent with the consent copy."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          disabled={currentStep === 0}
          onClick={() => {
            recordSectionTime();
            setCurrentStep((p) => p - 1);
          }}
        >
          {locale === "pt" ? "Voltar" : "Back"}
        </Button>

        {isOnSignatureStep ? (
          <Button onClick={handleSubmitConsent} disabled={!canProceed() || submitting}>
            {submitting ? (
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            {locale === "pt" ? "Aceitar e Assinar" : "Accept & Sign"}
          </Button>
        ) : (
          <Button
            onClick={() => {
              recordSectionTime();
              setCurrentStep((p) => p + 1);
            }}
            disabled={!canProceed()}
          >
            {locale === "pt" ? "Próximo" : "Next"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Researcher contact card component
const ResearcherContactCard = ({ consent, locale }: { consent: ConsentData; locale: string }) => (
  <Card className="border-primary/20">
    <CardContent className="pt-4">
      <div className="flex items-start gap-3">
        <Phone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="space-y-1 text-xs">
          <p className="font-medium text-sm text-foreground">
            {locale === "pt" ? "Contato do Pesquisador Responsável" : "Principal Investigator Contact"}
          </p>
          {consent.researcher_name && <p>{consent.researcher_name}</p>}
          {consent.researcher_email && (
            <p className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {consent.researcher_email}
            </p>
          )}
          {consent.researcher_phone && (
            <p className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {consent.researcher_phone}
            </p>
          )}
          {consent.contact_hours && (
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {consent.contact_hours}
            </p>
          )}
          <p className="text-muted-foreground mt-1">
            {locale === "pt"
              ? "Em caso de dúvidas, entre em contato com o pesquisador nos horários indicados."
              : "If you have questions, contact the researcher during the indicated hours."}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default ConsentRespond;