import { useState } from "react";
import { useSurveyStore, QuestionType, SurveyChoice, MatrixItem, QUESTION_TYPE_LABELS } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

interface GeneratedQuestion {
  question_text: string;
  question_type: QuestionType;
  description?: string;
  is_required: boolean;
  choices?: { text: string; value: string }[];
  matrix_rows?: { text: string }[];
  matrix_columns?: { text: string }[];
  settings?: Record<string, any>;
}

const AIQuestionGenerator = ({ blockId, surveyId }: { blockId: string; surveyId: string }) => {
  const { locale } = useLanguage();
  const { questions, addQuestion, updateQuestion } = useSurveyStore();
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    if (!objective.trim()) return;
    setLoading(true);
    setGenerated([]);
    setSelected(new Set());

    try {
      const existingTexts = questions.filter((q) => q.block_id === blockId).map((q) => q.question_text).filter(Boolean);

      const { data, error } = await supabase.functions.invoke("survey-generate-questions", {
        body: {
          research_objective: objective,
          existing_questions: existingTexts,
          question_count: 5,
          language: locale,
        },
      });

      if (error) throw error;
      if (data?.questions) {
        setGenerated(data.questions);
        setSelected(new Set(data.questions.map((_: any, i: number) => i)));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate questions");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    selected.forEach((idx) => {
      const gq = generated[idx];
      if (!gq) return;
      const qId = addQuestion(blockId, surveyId, gq.question_type);
      const updates: any = {
        question_text: gq.question_text,
        description: gq.description || "",
        is_required: gq.is_required,
      };

      if (gq.choices?.length) {
        updates.choices = gq.choices.map((c, i) => ({
          id: genId(), text: c.text, value: c.value || String(i + 1), order: i,
        }));
      }
      if (gq.matrix_rows?.length) {
        updates.matrix_rows = gq.matrix_rows.map((r, i) => ({ id: genId(), text: r.text, order: i }));
      }
      if (gq.matrix_columns?.length) {
        updates.matrix_columns = gq.matrix_columns.map((c, i) => ({ id: genId(), text: c.text, order: i }));
      }
      if (gq.settings) {
        updates.settings = gq.settings;
      }

      updateQuestion(qId, updates);
    });

    toast.success(
      locale === "pt"
        ? `${selected.size} questões adicionadas!`
        : `${selected.size} questions added!`
    );
    setOpen(false);
    setGenerated([]);
    setObjective("");
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          {locale === "pt" ? "Gerar com IA" : "Generate with AI"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {locale === "pt" ? "Gerar Questões com IA" : "AI Question Generator"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              {locale === "pt" ? "Objetivo da pesquisa" : "Research Objective"}
            </Label>
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={locale === "pt"
                ? "Descreva o objetivo da sua pesquisa... Ex: Avaliar a satisfação de pacientes com um novo protocolo de tratamento para hipertensão"
                : "Describe your research objective... Ex: Evaluate patient satisfaction with a new hypertension treatment protocol"}
              rows={3}
              className="mt-1.5"
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading || !objective.trim()} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading
              ? (locale === "pt" ? "Gerando..." : "Generating...")
              : (locale === "pt" ? "Gerar Questões" : "Generate Questions")}
          </Button>

          {generated.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                {locale === "pt" ? "Selecione as questões para adicionar:" : "Select questions to add:"}
              </p>
              {generated.map((gq, idx) => (
                <Card
                  key={idx}
                  className={`cursor-pointer transition-all ${selected.has(idx) ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => toggleSelect(idx)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selected.has(idx)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">
                            {QUESTION_TYPE_LABELS[gq.question_type]?.[locale] || gq.question_type}
                          </span>
                          {gq.is_required && <span className="text-[10px] text-destructive">*</span>}
                        </div>
                        <p className="text-sm font-medium">{gq.question_text}</p>
                        {gq.description && <p className="text-xs text-muted-foreground mt-1">{gq.description}</p>}
                        {gq.choices && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {gq.choices.map((c, i) => (
                              <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded">{c.text}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {generated.length > 0 && (
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{locale === "pt" ? "Cancelar" : "Cancel"}</Button>
            </DialogClose>
            <Button onClick={handleAdd} disabled={selected.size === 0} className="gap-2">
              <Check className="h-4 w-4" />
              {locale === "pt"
                ? `Adicionar ${selected.size} questão(ões)`
                : `Add ${selected.size} question(s)`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AIQuestionGenerator;
