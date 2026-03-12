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
import jsPDF from "jspdf";

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
  const totalSteps = sections.length + 1; // sections + signature step
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
      // Generate PDF
      const pdf = new jsPDF();
      pdf.setFontSize(16);
      pdf.text(consent.title, 20, 20);
      pdf.setFontSize(10);
      pdf.text(`Data: ${new Date().toLocaleString("pt-BR")}`, 20, 30);
      pdf.text(`Participante: ${name}`, 20, 37);
      if (email) pdf.text(`Email: ${email}`, 20, 44);

      let yPos = 55;
      sections.forEach((section, idx) => {
        if (yPos > 260) { pdf.addPage(); yPos = 20; }
        pdf.setFontSize(12);
        pdf.text(`${idx + 1}. ${section.title}`, 20, yPos);
        yPos += 7;
        pdf.setFontSize(9);
        const lines = pdf.splitTextToSize(section.content_html, 170);
        pdf.text(lines, 20, yPos);
        yPos += lines.length * 5 + 5;
        pdf.setFontSize(8);
        pdf.text("✓ Li e compreendi esta seção", 25, yPos);
        yPos += 10;
      });

      // Add signature image
      if (signatureData) {
        if (yPos > 220) { pdf.addPage(); yPos = 20; }
        pdf.text("Assinatura:", 20, yPos);
        yPos += 5;
        pdf.addImage(signatureData, "PNG", 20, yPos, 80, 30);
        yPos += 35;
      }

      pdf.setFontSize(8);
      pdf.text(`Timestamp: ${new Date().toISOString()}`, 20, yPos);

      const pdfBlob = pdf.output("blob");
      const pdfFileName = `consent_${consent.id}_${Date.now()}.pdf`;

      // Upload PDF to storage
      const { error: uploadError } = await supabase.storage
        .from("consents")
        .upload(pdfFileName, pdfBlob, { contentType: "application/pdf" });

      // Save signature record
      const sectionConfirmations = Object.entries(confirmations)
        .filter(([, v]) => v)
        .map(([sectionId]) => ({
          section_id: sectionId,
          confirmed_at: new Date().toISOString(),
        }));

      const { data: sig, error: sigError } = await supabase
        .from("consent_signatures")
        .insert({
          consent_id: consent.id,
          respondent_name: name,
          respondent_email: email || null,
          signature_data: signatureData,
          user_agent: navigator.userAgent,
          section_confirmations: sectionConfirmations as any,
          pdf_path: uploadError ? null : pdfFileName,
        })
        .select("id")
        .single();

      if (sigError) throw sigError;

      setCompleted(true);
      onConsentComplete(sig.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar consentimento");
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-[hsl(var(--success))] mx-auto" />
        <h2 className="text-xl font-semibold">
          {locale === "pt" ? "Consentimento Registrado!" : "Consent Recorded!"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Aguarde, você será redirecionado ao questionário..."
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
                <Label>{locale === "pt" ? "E-mail (para receber cópia)" : "Email (to receive copy)"}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              {consent.require_signature && (
                <div className="space-y-2">
                  <Label>{locale === "pt" ? "Assinatura Digital *" : "Digital Signature *"}</Label>
                  <SignatureCanvas onSignatureChange={setSignatureData} />
                </div>
              )}
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
