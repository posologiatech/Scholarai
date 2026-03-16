import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Plus, MessageSquare, Trash2, Activity, Pencil, Check, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useRef, useEffect } from "react";

export interface DataSUSConversation {
  id: string;
  title: string;
  updated_at: string;
}

interface Props {
  conversations: DataSUSConversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  isPt: boolean;
}

const DataSUSSidebar = ({
  conversations, activeId, onSelect, onNew, onDelete, onRename, isPt,
}: Props) => {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (conv: DataSUSConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.title);
  };

  const confirmEdit = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  // Group by relative time
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);

  const today: DataSUSConversation[] = [];
  const thisWeek: DataSUSConversation[] = [];
  const older: DataSUSConversation[] = [];

  conversations.forEach((c) => {
    const d = new Date(c.updated_at);
    if (d >= todayStart) today.push(c);
    else if (d >= weekAgo) thisWeek.push(c);
    else older.push(c);
  });

  const renderGroup = (label: string, items: DataSUSConversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">
          {label}
        </p>
        {items.map((conv) => {
          const isActive = activeId === conv.id;
          const isEditing = editingId === conv.id;
          return (
            <div
              key={conv.id}
              className={cn(
                "group relative flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150",
                isActive
                  ? "bg-primary/8 text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              onClick={() => !isEditing && onSelect(conv.id)}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
              )}
              <MessageSquare className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />

              {isEditing ? (
                <div className="flex-1 min-w-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="h-6 text-sm px-1.5 py-0"
                  />
                  <button onClick={confirmEdit} className="h-5 w-5 rounded flex items-center justify-center text-primary hover:bg-primary/10 shrink-0">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={cancelEdit} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="truncate flex-1 min-w-0 text-sm font-medium" title={conv.title}>
                    {conv.title}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                      onClick={(e) => startEditing(conv, e)}
                      title={isPt ? "Renomear" : "Rename"}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv.id); }}
                      title={isPt ? "Apagar" : "Delete"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="w-64 border-r border-border/30 bg-sidebar-background flex flex-col flex-1 min-h-0">
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-display font-semibold text-base tracking-tight text-foreground">
              DataSUS
            </span>
          </div>
          <Button onClick={onNew} className="w-full gap-2 rounded-lg shadow-sm" size="sm">
            <Plus className="h-4 w-4" />
            {isPt ? "Nova Consulta" : "New Query"}
          </Button>
        </div>

        <div className="mx-4 border-t border-border/40" />

        <ScrollArea className="flex-1 px-2 pt-3">
          {conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                {isPt
                  ? "Nenhuma consulta ainda.\nComece uma nova pesquisa!"
                  : "No queries yet.\nStart a new search!"}
              </p>
            </div>
          ) : (
            <>
              {renderGroup(isPt ? "Hoje" : "Today", today)}
              {renderGroup(isPt ? "Esta semana" : "This week", thisWeek)}
              {renderGroup(isPt ? "Anteriores" : "Older", older)}
            </>
          )}
        </ScrollArea>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isPt ? "Apagar consulta?" : "Delete query?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isPt
                ? "Essa ação não pode ser desfeita. Todas as mensagens desta consulta serão permanentemente removidas."
                : "This action cannot be undone. All messages in this query will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isPt ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              {isPt ? "Apagar" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DataSUSSidebar;
