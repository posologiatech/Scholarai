import { Conversation } from "@/pages/DataMind";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, BrainCircuit, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useState } from "react";

interface Props {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport?: (id: string) => void;
}

const DataMindSidebar = ({ conversations, activeId, onSelect, onNew, onDelete, onExport }: Props) => {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  return (
    <>
      <div className="w-64 border-r border-border/40 bg-muted/30 flex flex-col h-full">
        <div className="p-3 border-b border-border/40">
          <div className="flex items-center gap-2 mb-3 px-1">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-sm">DataMind</span>
          </div>
          <Button onClick={onNew} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Novo Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                Nenhuma conversa ainda. Comece uma nova análise!
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "rounded-lg border border-border/40 bg-background/60 px-2 py-2 transition-colors",
                  activeId === conv.id ? "ring-1 ring-primary/30" : "hover:bg-muted/70"
                )}
              >
                <button
                  className={cn(
                    "w-full flex items-center gap-2 text-left rounded-md px-1 py-1.5",
                    activeId === conv.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => onSelect(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1 min-w-0 text-sm">{conv.title}</span>
                </button>

                <div className="mt-1 flex items-center gap-1.5 px-1">
                  {onExport && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport(conv.id);
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1" />
                      Exportar PDF
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(conv.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Apagar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Todas as mensagens e arquivos desta conversa serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DataMindSidebar;
