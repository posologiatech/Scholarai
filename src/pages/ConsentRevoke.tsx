import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldOff, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const ConsentRevoke = () => {
  const { signatureId } = useParams<{ signatureId: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "confirming" | "done" | "error" | "already_revoked">("loading");
  const [reason, setReason] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!signatureId) {
      setStatus("error");
      return;
    }
    // Verify the signature exists via edge function
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consent-revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ signatureId, action: "check" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.alreadyRevoked) {
          setStatus("already_revoked");
        } else if (data.participantName) {
          setParticipantName(data.participantName);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [signatureId]);

  const handleRevoke = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consent-revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ signatureId, action: "revoke", reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus("done");
      toast.success("Consentimento revogado com sucesso.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao revogar consentimento");
    } finally {
      setSubmitting(false);
    }
  };

  // Mask name: "João Silva" -> "Jo** Si***"
  const maskedName = participantName
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w.slice(0, 2) + "*".repeat(w.length - 2)))
    .join(" ");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        {status === "loading" && (
          <CardContent className="pt-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Verificando consentimento...</p>
          </CardContent>
        )}

        {status === "error" && (
          <CardContent className="pt-8 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Link inválido</h2>
            <p className="text-sm text-muted-foreground">
              Este link de revogação não é válido ou o consentimento não foi encontrado.
            </p>
          </CardContent>
        )}

        {status === "already_revoked" && (
          <CardContent className="pt-8 text-center space-y-3">
            <ShieldOff className="h-10 w-10 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Consentimento já revogado</h2>
            <p className="text-sm text-muted-foreground">
              Este consentimento já foi revogado anteriormente. Nenhuma ação adicional é necessária.
            </p>
          </CardContent>
        )}

        {status === "ready" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldOff className="h-5 w-5 text-destructive" />
                Revogação de Consentimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Participante: <strong>{maskedName}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Você está prestes a revogar seu consentimento de participação nesta pesquisa.
                Conforme o Art. 8° §5° da LGPD e a Resolução CNS 466/2012, você tem o direito de
                retirar seu consentimento a qualquer momento, sem qualquer prejuízo.
              </p>
              <div className="space-y-2">
                <Label className="text-sm">Motivo da revogação (opcional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva o motivo, se desejar..."
                  rows={3}
                />
              </div>
              <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                <p className="font-medium">Atenção:</p>
                <p>• Dados já coletados poderão ser mantidos de forma anonimizada para fins estatísticos</p>
                <p>• Você não poderá mais participar do estudo após a revogação</p>
                <p>• Esta ação será registrada na trilha de auditoria da pesquisa</p>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setStatus("confirming")}
              >
                <ShieldOff className="h-4 w-4 mr-1" />
                Revogar meu consentimento
              </Button>
            </CardContent>
          </>
        )}

        {status === "confirming" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirmar revogação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-medium">
                Tem certeza de que deseja revogar seu consentimento?
              </p>
              <p className="text-sm text-muted-foreground">
                Esta ação não pode ser desfeita. Seu status será alterado para "retirado"
                e o pesquisador será notificado.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStatus("ready")}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleRevoke} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Confirmar Revogação
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {status === "done" && (
          <CardContent className="pt-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-semibold">Consentimento Revogado</h2>
            <p className="text-sm text-muted-foreground">
              Seu consentimento foi revogado com sucesso. O pesquisador responsável será
              notificado e seu status no estudo foi alterado para "retirado".
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Se precisar de mais informações, entre em contato com o pesquisador responsável
              ou com o Comitê de Ética em Pesquisa informado no TCLE.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ConsentRevoke;
