import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { History, Loader2, Rocket, Lock, Save, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  createSurveyVersion,
  listSurveyVersions,
  restoreSurveyVersion,
  SurveyVersion,
} from "@/lib/survey/versionHistory";

const TRIGGER_META: Record<string, { icon: typeof Rocket; labelPt: string; labelEn: string }> = {
  manual: { icon: Save, labelPt: "Manual", labelEn: "Manual" },
  publish: { icon: Rocket, labelPt: "Publicação", labelEn: "Publish" },
  close: { icon: Lock, labelPt: "Encerramento", labelEn: "Close" },
  pre_restore: { icon: RotateCcw, labelPt: "Antes de restaurar", labelEn: "Before restore" },
};

interface Props {
  surveyId: string;
  /** Ensures the local builder store's pending edits are flushed to Supabase before this
   *  component snapshots or restores — otherwise a manual "Salvar versão" could capture stale
   *  DB state, or a restore could get silently overwritten by the next autosave tick. */
  onEnsureSaved: () => Promise<void>;
}

const VersionHistoryPanel = ({ surveyId, onEnsureSaved }: Props) => {
  const { locale } = useLanguage();
  const queryClient = useQueryClient();
  const { setSurvey, setBlocks, setQuestions, setLogicRules, setActiveBlock, markClean } = useSurveyStore();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmVersion, setConfirmVersion] = useState<SurveyVersion | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["survey-versions", surveyId],
    queryFn: () => listSurveyVersions(surveyId),
  });

  const handleSaveVersion = async () => {
    setSaving(true);
    try {
      await onEnsureSaved();
      await createSurveyVersion(surveyId, "manual", label.trim() || undefined);
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["survey-versions", surveyId] });
      toast.success(locale === "pt" ? "Versão salva" : "Version saved");
    } catch {
      toast.error(locale === "pt" ? "Falha ao salvar versão" : "Failed to save version");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version: SurveyVersion) => {
    setRestoringId(version.id);
    setConfirmVersion(null);
    try {
      await onEnsureSaved();
      // Checkpoint the current (about-to-be-overwritten) state first, so restoring is itself
      // never a one-way door — the researcher can always restore back to "just before this".
      await createSurveyVersion(surveyId, "pre_restore");
      const result = await restoreSurveyVersion(version.id);

      const [surveyRes, blocksRes, questionsRes, rulesRes] = await Promise.all([
        supabase.from("surveys").select("*").eq("id", surveyId).single(),
        supabase.from("survey_blocks").select("*").eq("survey_id", surveyId).order("block_order"),
        supabase.from("survey_questions").select("*").eq("survey_id", surveyId).order("question_order"),
        supabase.from("survey_logic_rules").select("*").eq("survey_id", surveyId).order("rule_order"),
      ]);
      if (surveyRes.data) setSurvey(surveyRes.data as any);
      const blocks = (blocksRes.data as any[]) || [];
      setBlocks(blocks);
      setQuestions((questionsRes.data as any[]) || []);
      setLogicRules((rulesRes.data as any[]) || []);
      if (blocks.length) setActiveBlock(blocks[0].id);
      markClean();

      queryClient.invalidateQueries({ queryKey: ["survey-versions", surveyId] });

      if (result.kept_protected_questions > 0) {
        toast.success(
          locale === "pt" ? "Versão restaurada" : "Version restored",
          {
            description:
              locale === "pt"
                ? `${result.kept_protected_questions} questão(ões) com respostas já registradas foi(ram) mantida(s), mesmo não estando nesta versão.`
                : `${result.kept_protected_questions} question(s) with recorded answers were kept, even though not part of this version.`,
          }
        );
      } else {
        toast.success(locale === "pt" ? "Versão restaurada" : "Version restored");
      }
    } catch (err: any) {
      toast.error(locale === "pt" ? "Falha ao restaurar versão" : "Failed to restore version", {
        description: err.message,
      });
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === "pt" ? "pt-BR" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            {locale === "pt" ? "Histórico de Versões" : "Version History"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {locale === "pt"
              ? "Uma versão é salva automaticamente ao publicar ou encerrar a coleta. Você também pode salvar uma a qualquer momento."
              : "A version is saved automatically when you publish or close the collection. You can also save one manually at any time."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={locale === "pt" ? "Nome da versão (opcional)" : "Version name (optional)"}
          />
          <Button onClick={handleSaveVersion} disabled={saving} className="shrink-0">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            {locale === "pt" ? "Salvar versão" : "Save version"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !versions?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {locale === "pt" ? "Nenhuma versão salva ainda." : "No versions saved yet."}
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-3">
              {versions.map((v) => {
                const meta = TRIGGER_META[v.trigger_type] || TRIGGER_META.manual;
                const Icon = meta.icon;
                const blockCount = v.snapshot?.blocks?.length ?? 0;
                const questionCount = v.snapshot?.questions?.length ?? 0;
                return (
                  <div key={v.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {v.label || (locale === "pt" ? meta.labelPt : meta.labelEn)}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {locale === "pt" ? meta.labelPt : meta.labelEn}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(v.created_at)} · {blockCount} {locale === "pt" ? "blocos" : "blocks"} · {questionCount} {locale === "pt" ? "questões" : "questions"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={restoringId === v.id}
                      onClick={() => setConfirmVersion(v)}
                    >
                      {restoringId === v.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {locale === "pt" ? "Restaurar" : "Restore"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <AlertDialog open={!!confirmVersion} onOpenChange={(open) => !open && setConfirmVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              {locale === "pt" ? "Restaurar esta versão?" : "Restore this version?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "pt"
                ? "A estrutura atual (blocos, questões, lógica) será substituída pela desta versão. Questões que já têm respostas registradas nunca são apagadas, mesmo que não façam parte desta versão. O estado atual é salvo automaticamente antes, então isso também pode ser desfeito."
                : "The current structure (blocks, questions, logic) will be replaced by this version's. Questions that already have recorded answers are never deleted, even if they aren't part of this version. The current state is auto-saved first, so this can also be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{locale === "pt" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmVersion && handleRestore(confirmVersion)}>
              {locale === "pt" ? "Restaurar" : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VersionHistoryPanel;
