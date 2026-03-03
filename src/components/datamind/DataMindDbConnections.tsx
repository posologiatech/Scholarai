import { useState, useEffect } from "react";
import { Database, Plus, Trash2, TestTube, Loader2, CheckCircle2, XCircle, Eye, EyeOff, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  is_active: boolean;
  schema_cache: any;
  last_connected_at: string | null;
  created_at: string;
}

interface Props {
  onSelect?: (connection: DbConnection | null) => void;
  selectedId?: string | null;
}

const DataMindDbConnections = ({ onSelect, selectedId }: Props) => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    db_type: "postgresql",
    host: "",
    port: 5432,
    database_name: "",
    username: "",
    password: "",
    ssl_mode: "require",
  });

  const fetchConnections = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("datamind_db_connections" as any)
      .select("id, name, db_type, host, port, database_name, username, is_active, schema_cache, last_connected_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setConnections((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchConnections(); }, [user]);

  const saveConnection = async () => {
    if (!user || !form.name || !form.host || !form.database_name || !form.username || !form.password) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("datamind_db_connections" as any)
      .insert({
        user_id: user.id,
        name: form.name,
        db_type: form.db_type,
        host: form.host,
        port: form.port,
        database_name: form.database_name,
        username: form.username,
        password_encrypted: form.password,
        ssl_mode: form.ssl_mode,
      } as any)
      .select("id, name, db_type, host, port, database_name, username, is_active, schema_cache, last_connected_at, created_at")
      .single();

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setConnections(prev => [(data as any), ...prev]);
      setDialogOpen(false);
      setForm({ name: "", db_type: "postgresql", host: "", port: 5432, database_name: "", username: "", password: "", ssl_mode: "require" });
      toast({ title: "Conexão salva!" });
    }
  };

  const testConnection = async (id: string) => {
    setTesting(id);
    const { data: { session } } = await supabase.auth.getSession();

    try {
      const res = await supabase.functions.invoke("datamind-db", {
        body: { action: "test", connection_id: id },
      });

      if (res.error) {
        toast({ title: "Erro no teste", description: res.error.message, variant: "destructive" });
      } else if (res.data?.success) {
        toast({ title: "✅ Conexão OK", description: res.data.message });
        fetchConnections();
      } else {
        toast({ title: "Falha na conexão", description: res.data?.error || "Erro desconhecido", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao testar conexão", variant: "destructive" });
    }
    setTesting(null);
  };

  const deleteConnection = async (id: string) => {
    await supabase.from("datamind_db_connections" as any).delete().eq("id", id);
    setConnections(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) onSelect?.(null);
    toast({ title: "Conexão removida" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Bancos de Dados</span>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Conexão</DialogTitle>
              <DialogDescription>Conecte a um banco de dados para consultar com linguagem natural</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div>
                <Label className="text-xs">Nome da conexão</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Produção Analytics" className="h-8 text-sm" />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.db_type} onValueChange={v => setForm({ ...form, db_type: v, port: v === "mysql" ? 3306 : 5432 })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">SSL</Label>
                  <Select value={form.ssl_mode} onValueChange={v => setForm({ ...form, ssl_mode: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="require">Require</SelectItem>
                      <SelectItem value="prefer">Prefer</SelectItem>
                      <SelectItem value="disable">Disable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Host</Label>
                  <Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="db.example.com" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Porta</Label>
                  <Input type="number" value={form.port} onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 5432 })} className="h-8 text-sm" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Database</Label>
                <Input value={form.database_name} onChange={e => setForm({ ...form, database_name: e.target.value })} placeholder="my_database" className="h-8 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Usuário</Label>
                  <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="postgres" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className="h-8 text-sm pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={saveConnection} disabled={saving || !form.name || !form.host || !form.database_name} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Salvar Conexão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
      ) : connections.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 text-center py-3">Nenhuma conexão configurada</p>
      ) : (
        <div className="space-y-1">
          {connections.map(conn => (
            <div
              key={conn.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-all text-xs ${
                selectedId === conn.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60"
              }`}
              onClick={() => onSelect?.(selectedId === conn.id ? null : conn)}
            >
              <Database className="h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{conn.name}</p>
                <p className="text-[10px] text-muted-foreground/60 truncate">{conn.db_type} · {conn.host}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); testConnection(conn.id); }}
                  className="p-0.5 rounded hover:bg-muted"
                  title="Testar"
                >
                  {testing === conn.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}
                  className="p-0.5 rounded hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DataMindDbConnections;
