import { SurveyQuestion, useSurveyStore, QuestionType, QUESTION_TYPE_LABELS } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Copy, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import QuestionRenderer from "./QuestionRenderer";
import QuestionTypePicker from "./QuestionTypePicker";
import { QUESTION_TYPE_META } from "./questionTypeMeta";
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
    duplicateQuestion,
    updateQuestion,
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
      {block?.description && (
        <div className="px-4 sm:px-6 py-2 border-b bg-muted/20">
          <p className="text-xs text-muted-foreground">{block.description}</p>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
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
                    onToggleRequired={(v) => updateQuestion(question.id, { is_required: v })}
                    onDuplicate={() => duplicateQuestion(question.id)}
                    onRemove={() => removeQuestion(question.id)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>

          <div className="flex justify-center gap-2 pt-2">
            <QuestionTypePicker onSelect={(type) => addQuestion(activeBlockId, survey.id, type)} />
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
  onToggleRequired: (value: boolean) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const SortableQuestionCard = ({
  question,
  index,
  locale,
  isActive,
  ruleCount,
  onSelect,
  onToggleRequired,
  onDuplicate,
  onRemove,
}: SortableQuestionCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const meta = QUESTION_TYPE_META[question.question_type];
  const Icon = meta.icon;

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative group border-l-4 transition-shadow cursor-pointer",
        meta.border,
        isActive ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm",
        isDragging && "opacity-40 z-10"
      )}
      onClick={onSelect}
    >
      {/* Floating toolbar — appears on hover/active instead of a single lonely trash icon.
          focus-within (not just group-hover) keeps it visible for keyboard users tabbing to
          the buttons themselves — opacity-0 alone would make a focused button invisible. */}
      <div className="absolute -top-3 right-4 flex items-center gap-0.5 rounded-md border bg-card p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={locale === "pt" ? "Duplicar questão" : "Duplicate question"}
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={locale === "pt" ? "Excluir questão" : "Delete question"}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={locale === "pt" ? "Reordenar questão (arraste ou use as setas)" : "Reorder question (drag or use arrow keys)"}
            className="text-muted-foreground/40 cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Q{index + 1}
          </span>
          <span className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", meta.badgeBg, meta.badgeText)}>
            <Icon className="h-3 w-3" />
            {QUESTION_TYPE_LABELS[question.question_type]?.[locale as "pt" | "en"] || question.question_type}
          </span>
          {ruleCount > 0 && <LogicBadge count={ruleCount} />}
          <label
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {locale === "pt" ? "Obrigatória" : "Required"}
            <Switch checked={question.is_required} onCheckedChange={onToggleRequired} />
          </label>
        </div>
        <QuestionRenderer question={question} editable />
      </div>
    </Card>
  );
};

export default QuestionCanvas;
