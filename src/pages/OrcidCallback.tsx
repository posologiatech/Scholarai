import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function OrcidCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState<string>("");
  const [orcidId, setOrcidId] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const error = params.get("error");
    if (error) {
      setStatus("error");
      setMessage(params.get("error_description") || error);
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("Código de autorização ausente.");
      return;
    }

    const redirect_uri = `${window.location.origin}/orcid/callback`;
    supabase.functions
      .invoke("orcid-oauth", { body: { code, redirect_uri } })
      .then(({ data, error }) => {
        if (error || !data?.ok) {
          setStatus("error");
          setMessage(error?.message || data?.error || "Falha ao conectar ORCID");
          return;
        }
        setStatus("ok");
        setOrcidId(data.orcid_id);
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Conectando ao ORCID…</h1>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
            <h1 className="text-xl font-semibold">ORCID conectado!</h1>
            {orcidId && (
              <p className="text-sm text-muted-foreground">
                ORCID iD: <span className="font-mono">{orcidId}</span>
              </p>
            )}
            <Button onClick={() => navigate("/my-plan")}>Voltar ao perfil</Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Erro ao conectar</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button asChild variant="outline">
              <Link to="/my-plan">Voltar</Link>
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
