import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw, History, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const DataIntegrityPanel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const [verifying, setVerifying] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const { data: responses = [] } = useQuery({
    queryKey: ["integrity-responses", surveyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_responses")
        .select("id, respondent_id, started_at, response_hash, status")
        .eq("survey_id", surveyId)
        .order("started_at", { ascending: false });
      return data || [];
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["integrity-audit", surveyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_audit_log")
        .select("*")
        .eq("survey_id", surveyId)
        .in("action", ["answer_modified", "integrity_verified", "integrity_violation"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const verifyResponse = async (responseId: string) => {
    setVerifying(responseId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("survey-verify-integrity", {
        body: { response_id: responseId },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw error;
      setResults((prev) => ({ ...prev, [responseId]: data }));

      if (data.status === "intact") {
        toast.success(locale === "pt" ? "Integridade verificada ✅" : "Integrity verified ✅");
      } else {
        toast.error(locale === "pt" ? "Violação de integridade detectada ❌" : "Integrity violation detected ❌");
      }
    } catch (err) {
      console.error(err);
      toast.error(locale === "pt" ? "Erro ao verificar integridade" : "Failed to verify integrity");
    } finally {
      setVerifying(null);
    }
  };

  const verifyAll = async () => {
    for (const r of responses) {
      await verifyResponse(r.id);
    }
  };

  const intactCount = Object.values(results).filter((r: any) => r?.status === "intact").length;
  const violationCount = Object.values(results).filter((r: any) => r?.status === "violation").length;
  const uncheckedCount = responses.length - Object.keys(results).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{responses.length}</p>
            <p className="text-xs text-muted-foreground">{locale === "pt" ? "Total de respostas" : "Total responses"}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{intactCount}</p>
            <p className="text-xs text-muted-foreground">{locale === "pt" ? "Íntegras" : "Intact"}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">{violationCount}</p>
            <p className="text-xs text-muted-foreground">{locale === "pt" ? "Violações" : "Violations"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{uncheckedCount}</p>
            <p className="text-xs text-muted-foreground">{locale === "pt" ? "Não verificadas" : "Unchecked"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={verifyAll} disabled={!!verifying || responses.length === 0} className="gap-2">
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {locale === "pt" ? "Verificar todas" : "Verify all"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Reconstrói a cadeia de hashes SHA-256 desde a criação de cada resposta — cada edição encadeia no hash anterior, então uma edição feita fora do fluxo de auditoria quebra a cadeia em vez de passar despercebida"
            : "Rebuilds the SHA-256 hash chain from each answer's creation — every edit links to the prior hash, so a change made outside the audit flow breaks the chain instead of going unnoticed"}
        </p>
      </div>

      {/* Responses Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {locale === "pt" ? "Status de Integridade por Resposta" : "Integrity Status per Response"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{locale === "pt" ? "Data" : "Date"}</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>{locale === "pt" ? "Status" : "Status"}</TableHead>
                  <TableHead>{locale === "pt" ? "Ação" : "Action"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((r: any) => {
                  const result = results[r.id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.respondent_id || r.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{new Date(r.started_at).toLocaleDateString(locale === "pt" ? "pt-BR" : "en-US")}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {r.response_hash ? r.response_hash.slice(0, 12) + "…" : "—"}
                            </TooltipTrigger>
                            <TooltipContent><p className="font-mono text-xs">{r.response_hash || "No hash"}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {!result ? (
                          <Badge variant="secondary" className="text-xs">{locale === "pt" ? "Pendente" : "Pending"}</Badge>
                        ) : result.status === "intact" ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {locale === "pt" ? "Íntegro" : "Intact"}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs gap-1">
                            <XCircle className="h-3 w-3" />
                            {locale === "pt" ? "Violação" : "Violation"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => verifyResponse(r.id)}
                          disabled={verifying === r.id}
                        >
                          {verifying === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Audit History */}
      {auditLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              {locale === "pt" ? "Histórico de Alterações e Verificações" : "Change & Verification History"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {auditLogs.map((log: any) => {
                  const details = log.details || {};
                  const actionMap: Record<string, { pt: string; en: string; icon: React.ReactNode }> = {
                    answer_modified: {
                      pt: "Resposta editada",
                      en: "Answer modified",
                      icon: <ShieldAlert className="h-4 w-4 text-amber-500" />,
                    },
                    integrity_verified: {
                      pt: "Integridade verificada",
                      en: "Integrity verified",
                      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                    },
                    integrity_violation: {
                      pt: "Violação detectada",
                      en: "Violation detected",
                      icon: <XCircle className="h-4 w-4 text-red-500" />,
                    },
                  };
                  const action = actionMap[log.action] || { pt: log.action, en: log.action, icon: null };

                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
                      {action.icon}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium">{locale === "pt" ? action.pt : action.en}</p>
                        {details.change_reason && (
                          <p className="text-xs text-muted-foreground">
                            {locale === "pt" ? "Motivo" : "Reason"}: {details.change_reason}
                          </p>
                        )}
                        {details.version && (
                          <p className="text-xs text-muted-foreground">
                            {locale === "pt" ? "Versão" : "Version"}: {details.version}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataIntegrityPanel;
