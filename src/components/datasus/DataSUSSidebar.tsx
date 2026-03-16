import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Plus, MessageSquare, Trash2, Pencil, Check, X, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useRef, useEffect, useMemo } from "react";

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
  const [searchQuery, setSearchQuery] = useState("");
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
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim());
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  // Group by relative time
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
  const monthAgo = new Date(todayStart.getTime() - 30 * 86400000);

  const today: DataSUSConversation[] = [];
  const thisWeek: DataSUSConversation[] = [];
  const thisMonth: DataSUSConversation[] = [];
  const older: DataSUSConversation[] = [];

  filtered.forEach((c) => {
    const d = new Date(c.updated_at);
    if (d >= todayStart) today.push(c);
    else if (d >= weekAgo) thisWeek.push(c);
    else if (d >= monthAgo) thisMonth.push(c);
    else older.push(c);
  });

  const renderItem = (conv: DataSUSConversation) => {
    const isActive = activeId === conv.id;
    const isEditing = editingId === conv.id;
    return (
      <div
        key={conv.id}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 mx-1",
          isActive
            ? "bg-primary/10 text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        onClick={() => !isEditing && onSelect(conv.id)}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
        )}

        <div className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          isActive ? "bg-primary/15" : "bg-muted/60"
        )}>
          <MessageSquare className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
        </div>

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
              className="h-7 text-xs px-2 py-0 rounded-lg"
            />
            <button onClick={confirmEdit} className="h-6 w-6 rounded-md flex items-center justify-center text-primary hover:bg-primary/10 shrink-0">
              <Check className="h-3 w-3" />
            </button>
            <button onClick={cancelEdit} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <span className="truncate flex-1 min-w-0 text-[13px] font-medium leading-tight" title={conv.title}>
              {conv.title}
            </span>
            <div className="flex items-center gap-0.5 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                onClick={(e) => startEditing(conv, e)}
                title={isPt ? "Renomear" : "Rename"}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv.id); }}
                title={isPt ? "Apagar" : "Delete"}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderGroup = (label: string, items: DataSUSConversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-4 mb-1.5">
          {label}
        </p>
        <div className="space-y-0.5">
          {items.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="w-[280px] border-r border-border/20 bg-muted/20 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 pb-3 space-y-3">
          <Button
            onClick={onNew}
            className="w-full gap-2 rounded-xl shadow-sm h-10 font-medium"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            {isPt ? "Nova Consulta" : "New Query"}
          </Button>

          {/* Search */}
          {conversations.length > 3 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isPt ? "Buscar consultas..." : "Search queries..."}
                className="h-8 pl-8 text-xs rounded-lg bg-background/60 border-border/30"
              />
            </div>
          )}
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                {searchQuery
                  ? (isPt ? "Nenhum resultado encontrado" : "No results found")
                  : (isPt ? "Nenhuma consulta ainda.\nComece uma nova pesquisa!" : "No queries yet.\nStart a new search!")}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {renderGroup(isPt ? "Hoje" : "Today", today)}
              {renderGroup(isPt ? "Esta semana" : "This week", thisWeek)}
              {renderGroup(isPt ? "Este mês" : "This month", thisMonth)}
              {renderGroup(isPt ? "Anteriores" : "Older", older)}
            </div>
          )}
        </ScrollArea>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">{isPt ? "Apagar consulta?" : "Delete query?"}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {isPt
                ? "Essa ação não pode ser desfeita. Todas as mensagens desta consulta serão permanentemente removidas."
                : "This action cannot be undone. All messages in this query will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{isPt ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
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
