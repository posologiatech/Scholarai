import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
  details?: string;
}

const DataQualityAlerts = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();

  const { data: questions } = useQuery({
    queryKey: ["dq-questions", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_questions").select("*").eq("survey_id", surveyId).order("question_order");
      return data || [];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["dq-responses", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_responses").select("*").eq("survey_id", surveyId);
      return data || [];
    },
  });

  const { data: answers } = useQuery({
    queryKey: ["dq-answers", surveyId, responses?.map(r => r.id).join(",")],
    queryFn: async () => {
      const ids = responses?.map(r => r.id) || [];
      if (!ids.length) return [];
      const { data } = await supabase.from("survey_answers").select("*").in("response_id", ids);
      return data || [];
    },
    enabled: !!responses?.length,
  });

  const { data: participants } = useQuery({
    queryKey: ["dq-participants", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("study_participants").select("*").eq("survey_id", surveyId);
      return data || [];
    },
  });

  const alerts = useMemo(() => {
    const result: Alert[] = [];
    if (!questions || !responses) return result;

    // 1. Check for required questions with missing answers
    const requiredQuestions = questions.filter((q: any) => q.is_required);
    const completedResponses = responses.filter(r => r.status === "complete");

    requiredQuestions.forEach((q: any) => {
      const qAnswers = answers?.filter(a => a.question_id === q.id) || [];
      const missing = completedResponses.length - qAnswers.filter(a => 
        a.answer_text || a.answer_numeric !== null || (Array.isArray(a.answer_choices) && (a.answer_choices as any[]).length > 0)
      ).length;
      if (missing > 0) {
        result.push({
          id: `missing-${q.id}`,
          severity: "critical",
          type: locale === "pt" ? "Dados Faltando" : "Missing Data",
          message: locale === "pt"
            ? `"${q.question_text?.slice(0, 50)}" tem ${missing} resposta(s) em branco`
            : `"${q.question_text?.slice(0, 50)}" has ${missing} blank answer(s)`,
        });
      }
    });

    // 2. Check for out-of-range values
    questions.forEach((q: any) => {
      const rules = q.validation_rules as any;
      if (!rules?.min && !rules?.max) return;
      const qAnswers = answers?.filter(a => a.question_id === q.id && a.answer_numeric !== null) || [];
      qAnswers.forEach(a => {
        const val = Number(a.answer_numeric);
        if ((rules.min !== undefined && val < rules.min) || (rules.max !== undefined && val > rules.max)) {
          result.push({
            id: `range-${a.id}`,
            severity: "warning",
            type: locale === "pt" ? "Fora do Range" : "Out of Range",
            message: locale === "pt"
              ? `Valor ${val} fora do range [${rules.min ?? "—"}–${rules.max ?? "—"}] em "${q.question_text?.slice(0, 40)}"`
              : `Value ${val} outside range [${rules.min ?? "—"}–${rules.max ?? "—"}] in "${q.question_text?.slice(0, 40)}"`,
            details: rules.unit ? `${locale === "pt" ? "Unidade:" : "Unit:"} ${rules.unit}` : undefined,
          });
        }
      });
    });

    // 3. Incomplete responses
    const incomplete = responses.filter(r => r.status === "in_progress").length;
    if (incomplete > 0) {
      result.push({
        id: "incomplete",
        severity: "info",
        type: locale === "pt" ? "Coletas Incompletas" : "Incomplete",
        message: locale === "pt"
          ? `${incomplete} resposta(s) iniciada(s) mas não finalizada(s)`
          : `${incomplete} response(s) started but not completed`,
      });
    }

    // 4. Participants without consent
    const noConsent = participants?.filter(p => !p.consent_signature_id).length || 0;
    if (noConsent > 0) {
      result.push({
        id: "no-consent",
        severity: "warning",
        type: locale === "pt" ? "TCLE Pendente" : "Pending Consent",
        message: locale === "pt"
          ? `${noConsent} participante(s) sem TCLE assinado`
          : `${noConsent} participant(s) without signed consent`,
      });
    }

    return result;
  }, [questions, responses, answers, participants, locale]);

  const severityIcon = {
    critical: <AlertCircle className="h-4 w-4 text-destructive" />,
    warning: <AlertTriangle className="h-4 w-4 text-[hsl(30,90%,55%)]" />,
    info: <Info className="h-4 w-4 text-primary" />,
  };

  const severityBadge = {
    critical: "destructive" as const,
    warning: "secondary" as const,
    info: "outline" as const,
  };

  return (
    <div className="space-y-4">
      {alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-[hsl(152,69%,41%)]" />
            <p className="text-sm font-medium">
              {locale === "pt" ? "Nenhum alerta de qualidade" : "No quality alerts"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "pt" ? "Todos os dados parecem consistentes." : "All data appears consistent."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {alerts.filter(a => a.severity === "critical").length} {locale === "pt" ? "críticos" : "critical"}
            </span>
            <span>•</span>
            <span>
              {alerts.filter(a => a.severity === "warning").length} {locale === "pt" ? "avisos" : "warnings"}
            </span>
            <span>•</span>
            <span>
              {alerts.filter(a => a.severity === "info").length} {locale === "pt" ? "informativos" : "info"}
            </span>
          </div>

          <div className="space-y-2">
            {alerts.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="flex items-start gap-3 py-3 px-4">
                  {severityIcon[alert.severity]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant={severityBadge[alert.severity]} className="text-[10px]">
                        {alert.type}
                      </Badge>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    {alert.details && (
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.details}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DataQualityAlerts;
