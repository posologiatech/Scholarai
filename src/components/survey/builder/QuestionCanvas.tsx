import { SurveyQuestion, useSurveyStore, QuestionType, QUESTION_TYPE_LABELS } from "@/hooks/useSurveyStore";
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
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = blockQuestions.map((q) => q.id);
    const fromIdx = ids.indexOf(active.id as string);
    const toIdx = ids.indexOf(over.id as string);
    if (fromIdx < 0 || toIdx < 0) return;
    reorderQuestions(activeBlockId, arrayMove(ids, fromIdx, toIdx));
  };

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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blockQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {blockQuestions.map((question, idx) => {
                const ruleCount = logicRules.filter((r) => r.source_question_id === question.id).length;
                return (
                  <SortableQuestionCard
                    key={question.id}
                    question={question}
                    index={idx}
                    locale={locale}
                    isActive={activeQuestionId === question.id}
                    ruleCount={ruleCount}
                    onSelect={() => setActiveQuestion(question.id)}
                    onRemove={() => removeQuestion(question.id)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>

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
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                  <DropdownMenuItem key={type} onClick={() => addQuestion(activeBlockId, survey.id, type)}>
                    {QUESTION_TYPE_LABELS[type][locale]}
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

interface SortableQuestionCardProps {
  question: SurveyQuestion;
  index: number;
  locale: string;
  isActive: boolean;
  ruleCount: number;
  onSelect: () => void;
  onRemove: () => void;
}

const SortableQuestionCard = ({
  question,
  index,
  locale,
  isActive,
  ruleCount,
  onSelect,
  onRemove,
}: SortableQuestionCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative group transition-shadow cursor-pointer",
        isActive ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm",
        isDragging && "opacity-40 z-10"
      )}
      onClick={onSelect}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="text-muted-foreground/40 cursor-grab active:cursor-grabbing touch-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Q{index + 1}
            </span>
            <span className="text-xs text-muted-foreground">
              {QUESTION_TYPE_LABELS[question.question_type]?.[locale as "pt" | "en"] || question.question_type}
            </span>
            {question.is_required && (
              <span className="text-xs text-destructive font-medium">*</span>
            )}
            {ruleCount > 0 && <LogicBadge count={ruleCount} />}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
        <QuestionRenderer question={question} editable />
      </div>
    </Card>
  );
};

export default QuestionCanvas;
