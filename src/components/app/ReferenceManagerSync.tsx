import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Link2, Unlink, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";

interface Connection {
  id: string;
  provider: string;
  api_key: string;
  user_library_id: string | null;
  last_synced_at: string | null;
  sync_status: string;
}

export default function ReferenceManagerSync() {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProvider, setNewProvider] = useState<string>("zotero");
  const [newApiKey, setNewApiKey] = useState("");
  const [newLibraryId, setNewLibraryId] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (user) fetchConnections();
  }, [user]);

  const fetchConnections = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reference_manager_connections")
      .select("*")
      .order("created_at", { ascending: false }) as { data: Connection[] | null };
    setConnections(data || []);
    setLoading(false);
  };

  const addConnection = async () => {
    if (!newApiKey.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("reference_manager_connections").insert({
      user_id: user!.id,
      provider: newProvider,
      api_key: newApiKey.trim(),
      user_library_id: newLibraryId.trim() || null,
    } as any);
    setAdding(false);
    if (error) {
      if (error.code === "23505") {
        toast.error(pt ? "Conexão com esse provedor já existe" : "Connection with this provider already exists");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(pt ? "Conexão adicionada!" : "Connection added!");
    setShowAdd(false);
    setNewApiKey("");
    setNewLibraryId("");
    fetchConnections();
  };

  const removeConnection = async (id: string) => {
    await supabase.from("reference_manager_connections").delete().eq("id", id);
    toast.success(pt ? "Conexão removida" : "Connection removed");
    fetchConnections();
  };

  const doSync = async (connId: string, action: "pull" | "push" | "full_sync") => {
    setSyncing(connId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("sync-references", {
        body: { connectionId: connId, action },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data as any;
      toast.success(
        pt
          ? `Sincronização concluída: ${result.pulled || 0} importados, ${result.pushed || 0} exportados`
          : `Sync complete: ${result.pulled || 0} pulled, ${result.pushed || 0} pushed`
      );
      fetchConnections();
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const statusColor = (s: string) => {
    if (s === "syncing") return "bg-yellow-500/20 text-yellow-400";
    if (s === "error") return "bg-red-500/20 text-red-400";
    return "bg-green-500/20 text-green-400";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {pt ? "Gerenciadores Bibliográficos" : "Reference Managers"}
        </h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Link2 className="h-4 w-4 mr-1" />
              {pt ? "Conectar" : "Connect"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{pt ? "Conectar Gerenciador" : "Connect Reference Manager"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{pt ? "Provedor" : "Provider"}</Label>
                <Select value={newProvider} onValueChange={setNewProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zotero">Zotero</SelectItem>
                    <SelectItem value="mendeley">Mendeley</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {newProvider === "zotero"
                    ? "API Key (zotero.org/settings/keys)"
                    : "Access Token (Mendeley OAuth)"}
                </Label>
                <Input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={newProvider === "zotero" ? "Zotero API Key" : "Mendeley Access Token"}
                />
              </div>
              {newProvider === "zotero" && (
                <div>
                  <Label>User ID / Library ID</Label>
                  <Input
                    value={newLibraryId}
                    onChange={(e) => setNewLibraryId(e.target.value)}
                    placeholder={pt ? "Seu User ID numérico do Zotero" : "Your numeric Zotero User ID"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {pt ? "Encontre em zotero.org/settings/keys" : "Find at zotero.org/settings/keys"}
                  </p>
                </div>
              )}
              <Button onClick={addConnection} disabled={adding || !newApiKey.trim()} className="w-full">
                {adding && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {pt ? "Salvar Conexão" : "Save Connection"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {pt ? "Nenhuma conexão configurada. Conecte seu Zotero ou Mendeley." : "No connections configured. Connect your Zotero or Mendeley."}
        </p>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/50"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                  {conn.provider[0]}
                </div>
                <div>
                  <p className="text-sm font-medium capitalize">{conn.provider}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className={`text-[10px] ${statusColor(conn.sync_status)}`}>
                      {conn.sync_status}
                    </Badge>
                    {conn.last_synced_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {pt ? "Último sync:" : "Last sync:"}{" "}
                        {new Date(conn.last_synced_at).toLocaleString(pt ? "pt-BR" : "en-US")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => doSync(conn.id, "pull")}
                  disabled={syncing === conn.id}
                  title={pt ? "Importar do gerenciador" : "Pull from manager"}
                >
                  {syncing === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => doSync(conn.id, "push")}
                  disabled={syncing === conn.id}
                  title={pt ? "Exportar para gerenciador" : "Push to manager"}
                >
                  <ArrowUpFromLine className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => doSync(conn.id, "full_sync")}
                  disabled={syncing === conn.id}
                  title={pt ? "Sincronização completa" : "Full sync"}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => removeConnection(conn.id)}
                  title={pt ? "Desconectar" : "Disconnect"}
                >
                  <Unlink className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
