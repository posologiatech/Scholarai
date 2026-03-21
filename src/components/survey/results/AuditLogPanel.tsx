import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Clock } from "lucide-react";

const actionLabels: Record<string, { pt: string; en: string; color: string }> = {
  consent_signed: { pt: "TCLE Assinado", en: "Consent Signed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  consent_revoked: { pt: "Consentimento Revogado", en: "Consent Revoked", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  data_exported: { pt: "Dados Exportados", en: "Data Exported", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  data_deleted: { pt: "Dados Anonimizados", en: "Data Anonymized", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  data_modified: { pt: "Dados Modificados", en: "Data Modified", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  answer_modified: { pt: "Resposta Editada", en: "Answer Modified", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  integrity_verified: { pt: "Integridade Verificada", en: "Integrity Verified", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  integrity_violation: { pt: "Violação de Integridade", en: "Integrity Violation", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const AuditLogPanel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_audit_log")
        .select("*")
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!surveyId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {locale === "pt"
              ? "Nenhum evento registrado na trilha de auditoria"
              : "No events recorded in the audit trail"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">
          {locale === "pt" ? "Trilha de Auditoria (GCP/CEP)" : "Audit Trail (GCP/IRB)"}
        </h3>
        <Badge variant="secondary" className="ml-auto">{logs.length}</Badge>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {logs.map((log: any) => {
            const label = actionLabels[log.action] || {
              pt: log.action,
              en: log.action,
              color: "bg-muted text-muted-foreground",
            };
            const details = log.details || {};

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
              >
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={label.color}>
                      {locale === "pt" ? label.pt : label.en}
                    </Badge>
                    {details.consent_version && (
                      <span className="text-xs text-muted-foreground">v{details.consent_version}</span>
                    )}
                  </div>
                  {details.respondent_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {details.respondent_name}
                    </p>
                  )}
                  {log.ip_address && (
                    <p className="text-xs text-muted-foreground font-mono">IP: {log.ip_address}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AuditLogPanel;
