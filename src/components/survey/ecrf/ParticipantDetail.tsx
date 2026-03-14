import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, FileText, UserCircle, BrainCircuit, Loader2, Download, ShieldOff, AlertTriangle, PenLine, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DocumentUpload from "./DocumentUpload";

interface ParticipantDetailProps {
  participant: {
    id: string;
    participant_code: string;
    status: string;
    metadata: Record<string, any>;
    consent_signature_id: string | null;
    created_at: string;
  };
  surveyId: string;
  onBack: () => void;
}

const ParticipantDetail = ({ participant, surveyId, onBack }: ParticipantDetailProps) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [synthesis, setSynthesis] = useState("");
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [cosignOpen, setCosignOpen] = useState(false);

  const { data: consentSig } = useQuery({
    queryKey: ["consent-signature-detail", participant.consent_signature_id],
    queryFn: async () => {
      if (!participant.consent_signature_id) return null;
      const { data } = await supabase
        .from("consent_signatures")
        .select("*")
        .eq("id", participant.consent_signature_id)
        .single();
      return data;
    },
    enabled: !!participant.consent_signature_id,
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!participant.consent_signature_id) throw new Error("No consent to revoke");
      await supabase
        .from("consent_signatures")
        .update({
          revoked_at: new Date().toISOString(),
          revocation_reason: revokeReason || "Solicitação do participante",
        })
        .eq("id", participant.consent_signature_id);
      await supabase
        .from("study_participants")
        .update({ status: "withdrawn" })
        .eq("id", participant.id);
      await supabase.from("study_audit_log").insert({
        survey_id: surveyId,
        participant_id: participant.id,
        action: "consent_revoked",
        actor_id: user!.id,
        details: {
          participant_code: participant.participant_code,
          reason: revokeReason || "Solicitação do participante",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-participants", surveyId] });
      queryClient.invalidateQueries({ queryKey: ["consent-signature-detail"] });
      setRevokeOpen(false);
      toast.success(locale === "pt" ? "Consentimento revogado" : "Consent revoked");
    },
    onError: () => toast.error(locale === "pt" ? "Erro ao revogar" : "Revocation failed"),
  });

  // Co-signature mutation (Art. 4.3-7 CONEP)
  const cosignMutation = useMutation({
    mutationFn: async () => {
      if (!participant.consent_signature_id) throw new Error("No consent to co-sign");
      const { error } = await supabase
        .from("consent_signatures")
        .update({
          researcher_name: user?.email || "Pesquisador",
          researcher_signed_at: new Date().toISOString(),
          researcher_ip: "server-side",
        } as any)
        .eq("id", participant.consent_signature_id);
      if (error) throw error;

      await supabase.from("study_audit_log").insert({
        survey_id: surveyId,
        participant_id: participant.id,
        action: "researcher_cosigned",
        actor_id: user!.id,
        details: {
          participant_code: participant.participant_code,
          researcher_email: user?.email,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consent-signature-detail"] });
      setCosignOpen(false);
      toast.success(locale === "pt" ? "Co-assinatura registrada!" : "Co-signature recorded!");
    },
    onError: () => toast.error(locale === "pt" ? "Erro ao co-assinar" : "Co-signature failed"),
  });

  const handleGenerateSynthesis = async () => {
    setSynthesisLoading(true);
    setSynthesisOpen(true);
    setSynthesis("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("clinical-synthesis", {
        body: { participantId: participant.id, surveyId },
      });
      if (error) throw error;
      setSynthesis(data.synthesis || "");
      toast.success(locale === "pt" ? "Síntese gerada!" : "Synthesis generated!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate synthesis");
      setSynthesis(locale === "pt" ? "Erro ao gerar síntese." : "Error generating synthesis.");
    } finally {
      setSynthesisLoading(false);
    }
  };

  const handleDownloadSynthesisPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`Síntese Clínica - ${participant.participant_code}`, 20, 20);
      doc.setFontSize(10);
      doc.text(new Date().toLocaleString(), 20, 28);
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(synthesis, 170);
      doc.text(lines, 20, 40);
      doc.save(`sintese_${participant.participant_code}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  const { data: visits = [] } = useQuery({
    queryKey: ["study-visits", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_visits")
        .select("*")
        .eq("survey_id", surveyId)
        .order("visit_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["participant-documents", participant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_documents")
        .select("*")
        .eq("participant_id", participant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isRevoked = !!(consentSig as any)?.revoked_at;
  const isAnonymized = participant.status === "anonymized";
  const hasCosignature = !!(consentSig as any)?.researcher_signed_at;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <UserCircle className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold font-mono">{participant.participant_code}</h2>
            <p className="text-xs text-muted-foreground">
              {locale === "pt" ? "Cadastrado em" : "Registered on"}{" "}
              {new Date(participant.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {participant.status}
          </Badge>
        </div>

        {/* Banners */}
        {isRevoked && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-destructive/10 text-destructive text-sm">
            <ShieldOff className="h-4 w-4 shrink-0" />
            <span>
              {locale === "pt"
                ? `Consentimento revogado em ${new Date((consentSig as any).revoked_at).toLocaleString("pt-BR")}. Motivo: ${(consentSig as any).revocation_reason || "Não informado"}`
                : `Consent revoked on ${new Date((consentSig as any).revoked_at).toLocaleString("en-US")}. Reason: ${(consentSig as any).revocation_reason || "Not specified"}`}
            </span>
          </div>
        )}

        {isAnonymized && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted text-muted-foreground text-sm">
            <ShieldOff className="h-4 w-4 shrink-0" />
            <span>
              {locale === "pt"
                ? "Dados pessoais removidos conforme LGPD Art. 18"
                : "Personal data removed per LGPD Art. 18"}
            </span>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <FileText className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">TCLE</p>
              <p className="text-sm font-medium mt-1">
                {isRevoked
                  ? locale === "pt" ? "✗ Revogado" : "✗ Revoked"
                  : participant.consent_signature_id
                    ? locale === "pt" ? "✓ Assinado" : "✓ Signed"
                    : locale === "pt" ? "Pendente" : "Pending"}
              </p>
              {(consentSig as any)?.consent_version && (
                <p className="text-xs text-muted-foreground mt-0.5">v{(consentSig as any).consent_version}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <PenLine className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                {locale === "pt" ? "Co-assinatura" : "Co-signature"}
              </p>
              <p className="text-sm font-medium mt-1">
                {hasCosignature ? (
                  <Badge variant="default" className="text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                    {locale === "pt" ? "Assinado" : "Signed"}
                  </Badge>
                ) : participant.consent_signature_id && !isRevoked ? (
                  <Badge variant="outline" className="text-[10px] text-amber-600">
                    {locale === "pt" ? "Pendente" : "Pending"}
                  </Badge>
                ) : (
                  "—"
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                {locale === "pt" ? "Visitas" : "Visits"}
              </p>
              <p className="text-sm font-medium mt-1">{visits.length} {locale === "pt" ? "configuradas" : "configured"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Co-signature card (Art. 4.3-7 CONEP) */}
        {participant.consent_signature_id && !isRevoked && !isAnonymized && !hasCosignature && (
          <Card className="border-primary/20">
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {locale === "pt" ? "Co-assinatura do Pesquisador" : "Researcher Co-signature"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {locale === "pt"
                    ? "Conforme Art. 4.3-7 do Ofício Circular CONEP nº 23/2022, o TCLE eletrônico deve ser assinado pelo participante E pelo pesquisador."
                    : "Per CONEP Circular Art. 4.3-7, electronic consent must be signed by both participant and researcher."}
                </p>
              </div>
              <Button onClick={() => setCosignOpen(true)} className="shrink-0">
                <PenLine className="h-4 w-4 mr-1" />
                {locale === "pt" ? "Assinar como Pesquisador" : "Sign as Researcher"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Co-signed confirmation */}
        {hasCosignature && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {locale === "pt"
                ? `Documento co-assinado pelo pesquisador (${(consentSig as any).researcher_name}) em ${new Date((consentSig as any).researcher_signed_at).toLocaleString("pt-BR")}`
                : `Document co-signed by researcher (${(consentSig as any).researcher_name}) on ${new Date((consentSig as any).researcher_signed_at).toLocaleString("en-US")}`}
            </span>
          </div>
        )}

        {/* Revoke consent button */}
        {participant.consent_signature_id && !isRevoked && !isAnonymized && (
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {locale === "pt" ? "Revogação de Consentimento" : "Consent Revocation"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {locale === "pt"
                    ? "LGPD Art. 8° §5° / CEP Res. 466/2012 — O participante pode se retirar a qualquer momento"
                    : "LGPD Art. 8 §5 / IRB Res. 466/2012 — Participant may withdraw at any time"}
                </p>
              </div>
              <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => setRevokeOpen(true)}>
                <ShieldOff className="h-4 w-4 mr-1" />
                {locale === "pt" ? "Revogar" : "Revoke"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Visits tabs */}
        {visits.length > 0 ? (
          <Tabs defaultValue={visits[0]?.id} className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1">
              {visits.map((visit: any, idx: number) => (
                <TabsTrigger key={visit.id} value={visit.id} className="text-xs">
                  T{idx}: {visit.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {visits.map((visit: any) => (
              <TabsContent key={visit.id} value={visit.id} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{visit.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {visit.target_days != null && (
                      <p className="text-xs text-muted-foreground">
                        {locale === "pt" ? "Dias após baseline:" : "Days after baseline:"} {visit.target_days}
                      </p>
                    )}
                    <DocumentUpload
                      participantId={participant.id}
                      visitId={visit.id}
                      existingDocs={documents.filter((d: any) => d.visit_id === visit.id)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                {locale === "pt"
                  ? "Nenhuma visita configurada para este estudo. Configure as visitas na aba Visitas do builder."
                  : "No visits configured for this study. Configure visits in the builder's Visits tab."}
              </p>
              <DocumentUpload
                participantId={participant.id}
                visitId={null}
                existingDocs={documents.filter((d: any) => !d.visit_id)}
              />
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {participant.metadata?.notes && participant.metadata.notes !== "[DADOS REMOVIDOS]" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {locale === "pt" ? "Notas" : "Notes"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {participant.metadata.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* AI Clinical Synthesis */}
        {!isAnonymized && (
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {locale === "pt" ? "Síntese Clínica com IA" : "AI Clinical Synthesis"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {locale === "pt"
                    ? "Gera um rascunho de evolução clínica a partir dos dados coletados"
                    : "Generates a clinical evolution draft from collected data"}
                </p>
              </div>
              <Button onClick={handleGenerateSynthesis} disabled={synthesisLoading} className="gap-1.5">
                {synthesisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                {locale === "pt" ? "Gerar Síntese" : "Generate Synthesis"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Synthesis Dialog */}
        <Dialog open={synthesisOpen} onOpenChange={setSynthesisOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5" />
                {locale === "pt" ? "Síntese Clínica" : "Clinical Synthesis"} — {participant.participant_code}
              </DialogTitle>
            </DialogHeader>
            {synthesisLoading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {locale === "pt" ? "Gerando síntese clínica..." : "Generating clinical synthesis..."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  value={synthesis}
                  onChange={(e) => setSynthesis(e.target.value)}
                  className="min-h-[300px] text-sm font-mono"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadSynthesisPDF}>
                    <Download className="h-4 w-4" />
                    {locale === "pt" ? "Baixar PDF" : "Download PDF"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Revoke consent dialog */}
        <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {locale === "pt" ? "Revogar Consentimento" : "Revoke Consent"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {locale === "pt"
                  ? "A revogação marcará o participante como 'withdrawn' e registrará na trilha de auditoria."
                  : "Revocation will mark the participant as 'withdrawn' and log it in the audit trail."}
              </p>
              <div className="space-y-2">
                <Label>{locale === "pt" ? "Motivo (opcional)" : "Reason (optional)"}</Label>
                <Input
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder={locale === "pt" ? "Solicitação do participante" : "Participant request"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeOpen(false)}>
                {locale === "pt" ? "Cancelar" : "Cancel"}
              </Button>
              <Button variant="destructive" onClick={() => revokeMutation.mutate()} disabled={revokeMutation.isPending}>
                {locale === "pt" ? "Confirmar Revogação" : "Confirm Revocation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Co-signature dialog */}
        <Dialog open={cosignOpen} onOpenChange={setCosignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-primary" />
                {locale === "pt" ? "Co-assinatura do Pesquisador" : "Researcher Co-signature"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {locale === "pt"
                  ? "Conforme o Ofício Circular CONEP nº 23/2022 (Art. 4.3-7), o TCLE eletrônico deve conter a assinatura do pesquisador responsável. Ao confirmar, sua identidade será registrada junto ao documento."
                  : "Per CONEP Circular nº 23/2022 (Art. 4.3-7), electronic consent must contain the researcher's signature. By confirming, your identity will be recorded alongside the document."}
              </p>
              <div className="p-3 border rounded-lg bg-muted/50 text-sm space-y-1">
                <p><strong>{locale === "pt" ? "Pesquisador:" : "Researcher:"}</strong> {user?.email}</p>
                <p><strong>{locale === "pt" ? "Participante:" : "Participant:"}</strong> {participant.participant_code}</p>
                <p><strong>{locale === "pt" ? "Data/Hora:" : "Date/Time:"}</strong> {new Date().toLocaleString()}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCosignOpen(false)}>
                {locale === "pt" ? "Cancelar" : "Cancel"}
              </Button>
              <Button onClick={() => cosignMutation.mutate()} disabled={cosignMutation.isPending}>
                {cosignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                <PenLine className="h-4 w-4 mr-1" />
                {locale === "pt" ? "Confirmar Co-assinatura" : "Confirm Co-signature"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ParticipantDetail;
