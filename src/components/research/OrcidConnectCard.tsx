import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ORCID_CLIENT_ID = "APP-R7IDKI2P0QYBK6MA";
const ORCID_AUTHORIZE = "https://orcid.org/oauth/authorize";
const SCOPE = "/authenticate /activities/update /read-limited";

export function OrcidConnectCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<{ orcid_id: string; name: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("orcid_connections")
      .select("orcid_id,name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setConnection(data ?? null);
        setLoading(false);
      });
  }, [user]);

  const connect = () => {
    const redirect_uri = `${window.location.origin}/orcid/callback`;
    const url = `${ORCID_AUTHORIZE}?client_id=${encodeURIComponent(ORCID_CLIENT_ID)}&response_type=code&scope=${encodeURIComponent(SCOPE)}&redirect_uri=${encodeURIComponent(redirect_uri)}`;
    window.location.href = url;
  };

  const disconnect = async () => {
    if (!user) return;
    const { error } = await supabase.from("orcid_connections").delete().eq("user_id", user.id);
    if (error) return toast.error("Erro ao desconectar");
    setConnection(null);
    toast.success("ORCID desconectado");
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <img src="https://orcid.org/sites/default/files/images/orcid_16x16.png" alt="ORCID" className="h-4 w-4" />
            ORCID
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte seu ORCID iD para autenticar publicações e enviar works automaticamente para seu perfil.
          </p>
        </div>
        {connection && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : connection ? (
        <div className="space-y-3">
          <div className="text-sm">
            <div className="text-muted-foreground">Conectado como</div>
            <div className="font-medium">{connection.name || "Pesquisador"}</div>
            <a
              href={`https://orcid.org/${connection.orcid_id}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              {connection.orcid_id} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect}>
            Desconectar
          </Button>
        </div>
      ) : (
        <Button onClick={connect} className="bg-[#A6CE39] hover:bg-[#95b832] text-white">
          Conectar com ORCID
        </Button>
      )}
    </Card>
  );
}
