import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ChevronRight, ShieldCheck } from "lucide-react";
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
}

interface ConsentRespondProps {
  consent: ConsentData;
  onConsentComplete: (signatureId: string) => void;
}

const ConsentRespond = ({ consent, onConsentComplete }: ConsentRespondProps) => {
  const { locale } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const sections = consent.sections || [];
  const totalSteps = sections.length + 1;
  const isOnSignatureStep = currentStep >= sections.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const currentSection = !isOnSignatureStep ? sections[currentStep] : null;

  const canProceed = useCallback(() => {
    if (isOnSignatureStep) {
      if (!name.trim()) return false;
      if (consent.require_signature && !signatureData) return false;
      return true;
    }
    if (currentSection?.require_checkbox && !confirmations[currentSection.id]) return false;
    return true;
  }, [isOnSignatureStep, currentSection, confirmations, name, signatureData, consent.require_signature]);

  const handleSubmitConsent = async () => {
    setSubmitting(true);
    try {
      const sectionConfirmations = Object.entries(confirmations)
        .filter(([, v]) => v)
        .map(([sectionId]) => ({
          section_id: sectionId,
          confirmed_at: new Date().toISOString(),
        }));

      // Call edge function for server-side IP capture, PDF generation, and email
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{consent.title}</h1>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {locale === "pt" ? "Etapa" : "Step"} {currentStep + 1} / {totalSteps}
        </p>
      </div>

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
            <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap">
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
                    ? "Você pode revogar este consentimento a qualquer momento, conforme Art. 8° §5° da LGPD e Resolução CNS 466/2012, sem qualquer prejuízo."
                    : "You may revoke this consent at any time per LGPD Art. 8 §5 and Resolution CNS 466/2012, without any penalty."}
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
          onClick={() => setCurrentStep((p) => p - 1)}
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
          <Button onClick={() => setCurrentStep((p) => p + 1)} disabled={!canProceed()}>
            {locale === "pt" ? "Próximo" : "Next"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ConsentRespond;
