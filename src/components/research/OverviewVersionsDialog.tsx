import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { History, RotateCcw, Save, Trash2 } from "lucide-react";
import { diffWords } from "diff";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

type Props = {
  projectId: string;
  currentContent: string;
  onRestore: (text: string) => void;
};

export const OverviewVersionsDialog = ({ projectId, currentContent, onRestore }: Props) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: versions = [], refetch } = useQuery({
    queryKey: ["overview-versions", projectId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_overview_versions")
        .select("id, content, summary, created_at, author_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveSnapshot = async () => {
    const summary = prompt(locale === "pt" ? "Descrição desta versão (opcional)" : "Version note (optional)") ?? "";
    const { error } = await supabase.from("research_overview_versions").insert({
      project_id: projectId,
      author_id: user?.id,
      content: currentContent,
      summary: summary || null,
    });
    if (error) return toast.error(error.message);
    toast.success(locale === "pt" ? "Versão salva" : "Version saved");
    refetch();
    qc.invalidateQueries({ queryKey: ["overview-versions", projectId] });
  };

  const removeVersion = async (id: string) => {
    if (!confirm(locale === "pt" ? "Excluir versão?" : "Delete version?")) return;
    const { error } = await supabase.from("research_overview_versions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
    if (selectedId === id) setSelectedId(null);
  };

  const selected = versions.find((v: any) => v.id === selectedId);
  const parts = selected ? diffWords(selected.content || "", currentContent || "") : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5"><History className="h-3.5 w-3.5" />{locale === "pt" ? "Histórico" : "History"}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><History className="h-4 w-4" />{locale === "pt" ? "Histórico do corpo do projeto" : "Project body history"}</span>
            <Button size="sm" variant="outline" onClick={saveSnapshot} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />{locale === "pt" ? "Salvar versão atual" : "Snapshot now"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-[260px_1fr] gap-3 overflow-hidden">
          <div className="border rounded-md overflow-y-auto">
            {versions.length === 0 && <p className="p-3 text-sm text-muted-foreground">{locale === "pt" ? "Nenhuma versão salva ainda." : "No saved versions yet."}</p>}
            {versions.map((v: any) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 ${selectedId === v.id ? "bg-muted" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: locale === "pt" ? ptBR : enUS })}</p>
                    {v.summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.summary}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{(v.content?.length ?? 0)} {locale === "pt" ? "caracteres" : "chars"}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeVersion(v.id); }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </button>
            ))}
          </div>
          <div className="border rounded-md overflow-y-auto p-4 bg-muted/20">
            {!selected ? (
              <p className="text-sm text-muted-foreground">{locale === "pt" ? "Selecione uma versão para ver o diff vs. atual." : "Select a version to see the diff vs. current."}</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">
                    {locale === "pt" ? "Vermelho = removido nesta versão · Verde = adicionado" : "Red = removed · Green = added"}
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => { onRestore(selected.content || ""); setOpen(false); toast.success(locale === "pt" ? "Versão restaurada (lembre-se de salvar)" : "Restored"); }} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />{locale === "pt" ? "Restaurar esta versão" : "Restore this version"}
                  </Button>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {parts.map((p, i) => (
                    <span key={i} className={p.added ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : p.removed ? "bg-red-500/20 text-red-700 dark:text-red-300 line-through" : ""}>
                      {p.value}
                    </span>
                  ))}
                </pre>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OverviewVersionsDialog;
