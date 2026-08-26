import { useState } from "react";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

export interface SurveyWebhook {
  enabled?: boolean;
  url?: string;
  secret?: string;
}

type TestResult = { ok: boolean; status?: number; error?: string } | null;

const WebhookTab = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { survey, updateSurveyField } = useSurveyStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const webhook: SurveyWebhook = survey?.settings?.webhook || {};

  const patchWebhook = (updates: Partial<SurveyWebhook>) => {
    if (!survey) return;
    updateSurveyField("settings", { ...survey.settings, webhook: { ...webhook, ...updates } });
  };

  const testWebhook = async () => {
    if (!webhook.url) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("survey-webhook-test", {
        body: { surveyId, url: webhook.url, secret: webhook.secret },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setTestResult(data);
      if (!data.ok) {
        toast.error(locale === "pt" ? "O endpoint não respondeu com sucesso" : "The endpoint did not respond with success");
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
      toast.error(locale === "pt" ? "Falha ao enviar o teste" : "Failed to send the test");
    } finally {
      setTesting(false);
    }
  };

  if (!survey) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">
            {locale === "pt" ? "Notificar um sistema externo" : "Notify an external system"}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "pt"
              ? "Envia uma requisição POST toda vez que uma resposta é registrada — útil para Zapier, uma planilha ou o CRM do laboratório."
              : "Sends a POST request every time a response is recorded — useful for Zapier, a spreadsheet, or the lab's CRM."}
          </p>
        </div>
        <Switch
          checked={!!webhook.enabled}
          onCheckedChange={(v) => patchWebhook({ enabled: v })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{locale === "pt" ? "URL do webhook" : "Webhook URL"}</Label>
        <Input
          value={webhook.url || ""}
          onChange={(e) => patchWebhook({ url: e.target.value })}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{locale === "pt" ? "Segredo (opcional)" : "Secret (optional)"}</Label>
        <Input
          type="password"
          value={webhook.secret || ""}
          onChange={(e) => patchWebhook({ secret: e.target.value })}
          placeholder={locale === "pt" ? "Usado para assinar a requisição" : "Used to sign the request"}
        />
        <p className="text-xs text-muted-foreground">
          {locale === "pt"
            ? "Se preenchido, cada requisição carrega o cabeçalho X-Scholar-Signature (HMAC-SHA256 do corpo) para você validar a origem."
            : "If set, every request carries an X-Scholar-Signature header (HMAC-SHA256 of the body) so you can verify its origin."}
        </p>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {locale === "pt"
              ? "Por padrão só enviamos metadados (id da pesquisa, id da resposta, quantidade de respostas, horário) — nunca o conteúdo das respostas, já que este é um formulário de pesquisa."
              : "By default we only send metadata (survey id, response id, answer count, timestamp) — never the answer content itself, since this is a research form."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={testWebhook} disabled={!webhook.url || testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              {locale === "pt" ? "Testar webhook" : "Test webhook"}
            </Button>
            {testResult && (
              <span className={`flex items-center gap-1 text-xs ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {testResult.ok
                  ? (locale === "pt" ? `Recebido (${testResult.status})` : `Received (${testResult.status})`)
                  : (testResult.error || (locale === "pt" ? "Falhou" : "Failed"))}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhookTab;
