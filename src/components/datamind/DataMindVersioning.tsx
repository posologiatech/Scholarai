import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Message } from "@/pages/DataMind";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GitBranch, Save, RotateCcw, GitCompare, Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

interface Checkpoint {
  id: string;
  label: string;
  description: string | null;
  branch_name: string;
  parent_checkpoint_id: string | null;
  messages_snapshot: Message[];
  created_at: string;
}

interface Props {
  conversationId: string;
  messages: Message[];
  onRestore: (messages: Message[]) => void;
}

const DataMindVersioning = ({ conversationId, messages, onRestore }: Props) => {
  const { user } = useAuth();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const loadCheckpoints = async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("datamind_checkpoints")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false });
    if (data) setCheckpoints(data as unknown as Checkpoint[]);
  };

  useEffect(() => {
    if (open) loadCheckpoints();
  }, [open, conversationId]);

  const saveCheckpoint = async (label: string, branchName?: string) => {
    if (!user || !conversationId || messages.length === 0) return;
    
    const { error } = await supabase.from("datamind_checkpoints").insert({
      conversation_id: conversationId,
      user_id: user.id,
      label: label || `Checkpoint ${checkpoints.length + 1}`,
      messages_snapshot: messages as any,
      branch_name: branchName || "main",
      parent_checkpoint_id: checkpoints.length > 0 ? checkpoints[0].id : null,
    });

    if (error) {
      toast.error("Erro ao salvar checkpoint");
      return;
    }
    toast.success("Checkpoint salvo!");
    setNewLabel("");
    loadCheckpoints();
  };

  const restoreCheckpoint = (cp: Checkpoint) => {
    onRestore(cp.messages_snapshot);
    toast.success(`Restaurado: ${cp.label}`);
    setRestoreTarget(null);
    setOpen(false);
  };

  const deleteCheckpoint = async (id: string) => {
    await supabase.from("datamind_checkpoints").delete().eq("id", id);
    loadCheckpoints();
  };

  const createBranch = async () => {
    if (!newBranch.trim()) return;
    await saveCheckpoint(`Branch: ${newBranch}`, newBranch);
    setBranchDialogOpen(false);
    setNewBranch("");
  };

  const compareCheckpoint = checkpoints.find(c => c.id === compareTarget);
  const branches = [...new Set(checkpoints.map(c => c.branch_name))];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
            <GitBranch className="h-3.5 w-3.5" />
            Versões
            {checkpoints.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{checkpoints.length}</Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Versionamento de Análises
            </DialogTitle>
          </DialogHeader>

          {/* Save new checkpoint */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nome do checkpoint (ex: 'Antes de remover outliers')"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && saveCheckpoint(newLabel)}
            />
            <Button size="sm" className="gap-1.5" onClick={() => saveCheckpoint(newLabel)} disabled={messages.length === 0}>
              <Save className="h-3.5 w-3.5" />
              Salvar
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBranchDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Branch
            </Button>
          </div>

          {/* Branches */}
          {branches.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Branches:</span>
              {branches.map(b => (
                <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
              ))}
            </div>
          )}

          {/* Checkpoint list */}
          <ScrollArea className="flex-1 max-h-96">
            <div className="space-y-2">
              {checkpoints.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum checkpoint salvo. Salve o estado atual para poder restaurar depois.
                </div>
              )}
              {checkpoints.map((cp) => (
                <div key={cp.id} className="rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{cp.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{cp.branch_name}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(cp.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                        <span>{cp.messages_snapshot?.length || 0} mensagens</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Comparar"
                        onClick={() => setCompareTarget(compareTarget === cp.id ? null : cp.id)}
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Restaurar"
                        onClick={() => setRestoreTarget(cp.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        title="Excluir"
                        onClick={() => deleteCheckpoint(cp.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Compare view */}
                  {compareTarget === cp.id && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Comparação: Checkpoint ({cp.messages_snapshot?.length || 0} msgs) vs Atual ({messages.length} msgs)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">CHECKPOINT</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {(cp.messages_snapshot || []).slice(-5).map((m, i) => (
                              <div key={i} className={`text-xs p-1.5 rounded ${m.role === "user" ? "bg-primary/5" : "bg-muted/50"}`}>
                                <span className="font-medium">{m.role === "user" ? "Você" : "IA"}:</span>{" "}
                                {m.content.slice(0, 80)}...
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">ATUAL</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {messages.slice(-5).map((m, i) => (
                              <div key={i} className={`text-xs p-1.5 rounded ${m.role === "user" ? "bg-primary/5" : "bg-muted/50"}`}>
                                <span className="font-medium">{m.role === "user" ? "Você" : "IA"}:</span>{" "}
                                {m.content.slice(0, 80)}...
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {messages.length > (cp.messages_snapshot?.length || 0)
                          ? `+${messages.length - (cp.messages_snapshot?.length || 0)} mensagens desde o checkpoint`
                          : messages.length < (cp.messages_snapshot?.length || 0)
                            ? `${(cp.messages_snapshot?.length || 0) - messages.length} mensagens a mais no checkpoint`
                            : "Mesmo número de mensagens"}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Branch dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar Branch</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Crie uma branch para explorar cenários alternativos (ex: "sem outliers", "apenas 2020-2024").
          </p>
          <Input
            placeholder="Nome da branch"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBranch()}
          />
          <Button onClick={createBranch} disabled={!newBranch.trim()}>
            <GitBranch className="h-4 w-4 mr-2" />
            Criar e Salvar Checkpoint
          </Button>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              As mensagens atuais serão substituídas pelo estado salvo no checkpoint. Salve o estado atual antes se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const cp = checkpoints.find(c => c.id === restoreTarget);
              if (cp) restoreCheckpoint(cp);
            }}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DataMindVersioning;
