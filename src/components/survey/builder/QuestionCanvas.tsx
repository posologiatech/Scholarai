import { useState } from "react";
import { useSurveyStore, QuestionType } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import QuestionRenderer from "./QuestionRenderer";
import LogicBadge from "@/components/survey/flow/LogicBadge";
import AIQuestionGenerator from "./AIQuestionGenerator";

const questionTypeLabels: Record<QuestionType, { en: string; pt: string }> = {
  multiple_choice: { en: "Multiple Choice", pt: "Múltipla Escolha" },
  text_entry: { en: "Text Entry", pt: "Entrada de Texto" },
  matrix_table: { en: "Matrix / Likert", pt: "Matriz / Likert" },
  slider: { en: "Slider", pt: "Controle Deslizante" },
  rank_order: { en: "Rank Order", pt: "Classificação" },
  constant_sum: { en: "Constant Sum", pt: "Soma Constante" },
};

const QuestionCanvas = () => {
  const { locale } = useLanguage();
  const {
    survey,
    blocks,
    questions,
    logicRules,
    activeBlockId,
    activeQuestionId,
    addQuestion,
    removeQuestion,
    setActiveQuestion,
    reorderQuestions,
  } = useSurveyStore();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (!survey || !activeBlockId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {locale === "pt" ? "Selecione um bloco" : "Select a block"}
      </div>
    );
  }

  const block = blocks.find((b) => b.id === activeBlockId);
  const blockQuestions = questions
    .filter((q) => q.block_id === activeBlockId)
    .sort((a, b) => a.question_order - b.question_order);

  const handleDragStart = (e: React.DragEvent, qId: string) => {
    setDragId(qId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", qId);
  };

  const handleDragOver = (e: React.DragEvent, qId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverId(qId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = blockQuestions.map((q) => q.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    reorderQuestions(activeBlockId, ids);
    setDragId(null);
    setOverId(null);
  };

  const handleDragEnd = () => { setDragId(null); setOverId(null); };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 py-3 border-b bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground">{block?.title}</h2>
        {block?.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{block.description}</p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4 max-w-3xl mx-auto">
          {blockQuestions.map((question, idx) => {
            const isDragging = dragId === question.id;
            const isOver = overId === question.id && dragId !== question.id;
            return (
              <Card
                key={question.id}
                draggable
                onDragStart={(e) => handleDragStart(e, question.id)}
                onDragOver={(e) => handleDragOver(e, question.id)}
                onDrop={(e) => handleDrop(e, question.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "relative group transition-all cursor-pointer",
                  activeQuestionId === question.id
                    ? "ring-2 ring-primary shadow-md"
                    : "hover:shadow-sm",
                  isDragging && "opacity-40",
                  isOver && "ring-2 ring-primary/50 ring-dashed"
                )}
                onClick={() => setActiveQuestion(question.id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Q{idx + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {questionTypeLabels[question.question_type]?.[locale] || question.question_type}
                      </span>
                      {question.is_required && (
                        <span className="text-xs text-destructive font-medium">*</span>
                      )}
                      {logicRules.filter((r) => r.source_question_id === question.id).length > 0 && (
                        <LogicBadge count={logicRules.filter((r) => r.source_question_id === question.id).length} />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); removeQuestion(question.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <QuestionRenderer question={question} editable />
                </div>
              </Card>
            );
          })}

          <div className="flex justify-center gap-2 pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {locale === "pt" ? "Adicionar Questão" : "Add Question"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(Object.keys(questionTypeLabels) as QuestionType[]).map((type) => (
                  <DropdownMenuItem key={type} onClick={() => addQuestion(activeBlockId, survey.id, type)}>
                    {questionTypeLabels[type][locale]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <AIQuestionGenerator blockId={activeBlockId} surveyId={survey.id} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default QuestionCanvas;
