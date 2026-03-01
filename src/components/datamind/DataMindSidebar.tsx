import { Conversation } from "@/pages/DataMind";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, BrainCircuit, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
    <TooltipProvider delayDuration={300}>
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
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                Nenhuma conversa ainda. Comece uma nova análise!
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm cursor-pointer transition-colors",
                  activeId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => onSelect(conv.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1 min-w-0">{conv.title}</span>

                <div className="flex items-center gap-0.5 shrink-0">
                  {onExport && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 rounded hover:bg-primary/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); onExport(conv.id); }}
                        >
                          <FileDown className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Exportar PDF</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Apagar</TooltipContent>
                  </Tooltip>
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
    </TooltipProvider>
  );
};

export default DataMindSidebar;
