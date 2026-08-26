import { SurveyQuestion, useSurveyStore } from "@/hooks/useSurveyStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, GripVertical } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const RankOrder = ({ question, editable, respondMode, value, onChange }: Props) => {
  const { updateQuestion } = useSurveyStore();
  const choices = [...(question.choices || [])].sort((a, b) => a.order - b.order);

  const addChoice = () => {
    updateQuestion(question.id, {
      choices: [
        ...choices,
        { id: genId(), text: `Item ${choices.length + 1}`, value: String(choices.length + 1), order: choices.length },
      ],
    });
  };

  if (respondMode) {
    // Ranking is stored keyed by choice TEXT, matching the coding convention the other
    // choice-based types (multiple_choice) already use. Nothing counts as "answered" until
    // the respondent actually drags something — see surveyLogic.ts's rank_order case, which
    // requires answer.length === choices.length (same "must interact" rule the Slider follows).
    const ranked: string[] = Array.isArray(value) && value.length === choices.length ? value : choices.map((c) => c.text);
    return (
      <RankOrderDnd
        items={ranked}
        onReorder={(next) => onChange?.(next)}
      />
    );
  }

  return (
    <div className="space-y-2">
      {choices.map((c, idx) => (
        <div key={c.id} className="flex items-center gap-2 group">
          <span className="text-xs font-medium text-muted-foreground w-5 text-center">{idx + 1}</span>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
          {editable ? (
            <Input
              value={c.text}
              onChange={(e) =>
                updateQuestion(question.id, {
                  choices: choices.map((ch) => (ch.id === c.id ? { ...ch, text: e.target.value } : ch)),
                })
              }
              className="h-8 text-sm border-dashed"
            />
          ) : (
            <span className="text-sm">{c.text}</span>
          )}
          {editable && choices.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={() => updateQuestion(question.id, { choices: choices.filter((ch) => ch.id !== c.id) })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {editable && (
        <Button variant="ghost" size="sm" className="text-xs" onClick={addChoice}>
          <Plus className="h-3 w-3 mr-1" />
          Add Item
        </Button>
      )}
    </div>
  );
};

const RankOrderDnd = ({ items, onReorder }: { items: string[]; onReorder: (items: string[]) => void }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = items.indexOf(active.id as string);
    const toIdx = items.indexOf(over.id as string);
    if (fromIdx < 0 || toIdx < 0) return;
    onReorder(arrayMove(items, fromIdx, toIdx));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Arraste os itens para ordená-los por preferência</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {items.map((text, idx) => (
              <RankOrderItem key={text} id={text} index={idx} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

const RankOrderItem = ({ id, index }: { id: string; index: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 bg-card border rounded px-3 py-2 text-sm cursor-grab active:cursor-grabbing touch-none",
        isDragging && "opacity-50"
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      <span className="text-xs font-bold text-primary w-5 shrink-0">{index + 1}.</span>
      {id}
    </div>
  );
};

export default RankOrder;
