import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, X, Mail, Eye, Edit, Trash2, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Share {
  id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  permission: string;
  created_at: string;
}

interface Props {
  conversationId: string;
}

const DataMindCollaboration = ({ conversationId }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("view");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !conversationId) return;
    loadShares();
  }, [open, conversationId]);

  const loadShares = async () => {
    const { data } = await supabase
      .from("datamind_conversation_shares")
      .select("*")
      .eq("conversation_id", conversationId);
    if (data) setShares(data);
  };

  const addShare = async () => {
    if (!email || !user) return;
    setLoading(true);
    const { error } = await supabase.from("datamind_conversation_shares").insert({
      conversation_id: conversationId,
      owner_id: user.id,
      shared_with_email: email,
      permission,
    });
    if (error) {
      toast({ title: "Erro ao compartilhar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Convite enviado!", description: `${email} agora tem acesso de ${permission === "edit" ? "edição" : "visualização"}.` });
      setEmail("");
      loadShares();
    }
    setLoading(false);
  };

  const removeShare = async (id: string) => {
    await supabase.from("datamind_conversation_shares").delete().eq("id", id);
    setShares(prev => prev.filter(s => s.id !== id));
    toast({ title: "Acesso removido" });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/datamind/${conversationId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copiado!" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
          <Users className="h-3.5 w-3.5" />
          Colaborar
          {shares.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{shares.length}</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Análise Colaborativa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Add collaborator */}
          <div className="flex gap-2">
            <Input
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="flex-1"
            />
            <Select value={permission} onValueChange={setPermission}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">
                  <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> Viewer</span>
                </SelectItem>
                <SelectItem value="edit">
                  <span className="flex items-center gap-1.5"><Edit className="h-3 w-3" /> Editor</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addShare} disabled={!email || loading} size="icon">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>

          {/* Copy link */}
          <Button variant="outline" size="sm" onClick={copyLink} className="w-full gap-2 text-xs">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Link copiado!" : "Copiar link da conversa"}
          </Button>

          {/* Current shares */}
          {shares.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Colaboradores ({shares.length})</p>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{share.shared_with_email}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {share.permission === "edit" ? "Editor" : "Viewer"}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeShare(share.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {shares.length === 0 && (
            <div className="text-center py-4">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhum colaborador ainda. Adicione emails acima.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DataMindCollaboration;
