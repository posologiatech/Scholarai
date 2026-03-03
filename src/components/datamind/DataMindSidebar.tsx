import { Conversation } from "@/pages/DataMind";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, BrainCircuit, FileDown, MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      <div className="w-64 border-r border-border/30 bg-sidebar-background flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BrainCircuit className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-display font-semibold text-base tracking-tight text-foreground">DataMind</span>
          </div>
          <Button onClick={onNew} className="w-full gap-2 rounded-lg shadow-sm" size="sm">
            <Plus className="h-4 w-4" />
            Novo Chat
          </Button>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-border/40" />

        {/* Conversations */}
        <ScrollArea className="flex-1 px-2 pt-3">
          <div className="space-y-0.5">
            {conversations.length === 0 && (
              <div className="text-center py-12 px-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  Nenhuma conversa ainda.<br />Comece uma nova análise!
                </p>
              </div>
            )}
            {conversations.map((conv) => {
              const isActive = activeId === conv.id;
              return (
                <div
                  key={conv.id}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150",
                    isActive
                      ? "bg-primary/8 text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  onClick={() => onSelect(conv.id)}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                  )}

                  <MessageSquare className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
                  <span className="truncate flex-1 min-w-0 text-sm font-medium">{conv.title}</span>

                  {/* Actions dropdown — visible on hover or when active */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "shrink-0 h-6 w-6 rounded-md flex items-center justify-center transition-opacity",
                          "opacity-0 group-hover:opacity-100 focus:opacity-100",
                          isActive && "opacity-60 group-hover:opacity-100",
                          "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {onExport && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onExport(conv.id);
                          }}
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Exportar PDF
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(conv.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Apagar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
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
