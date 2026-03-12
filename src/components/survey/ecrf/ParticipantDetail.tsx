import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, FileText, UserCircle, BrainCircuit, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
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

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <FileText className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">TCLE</p>
              <p className="text-sm font-medium mt-1">
                {participant.consent_signature_id
                  ? locale === "pt" ? "✓ Assinado" : "✓ Signed"
                  : locale === "pt" ? "Pendente" : "Pending"}
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
          <Card>
            <CardContent className="pt-4 text-center">
              <FileText className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                {locale === "pt" ? "Documentos" : "Documents"}
              </p>
              <p className="text-sm font-medium mt-1">{documents.length}</p>
            </CardContent>
          </Card>
        </div>

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
        {participant.metadata?.notes && (
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
      </div>
    </div>
  );
};

export default ParticipantDetail;
