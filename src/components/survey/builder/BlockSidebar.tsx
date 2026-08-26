import { SurveyBlock, useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
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

const BlockSidebar = () => {
  const { locale } = useLanguage();
  const {
    survey,
    blocks,
    questions,
    activeBlockId,
    addBlock,
    removeBlock,
    updateBlock,
    setActiveBlock,
    reorderBlocks,
  } = useSurveyStore();

  // PointerSensor covers mouse, pen and touch via the Pointer Events API, so this also fixes
  // reordering on tablets/phones — the previous HTML5 drag-and-drop had no touch support at all.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!survey) return null;

  const sortedBlocks = [...blocks].sort((a, b) => a.block_order - b.block_order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sortedBlocks.map((b) => b.id);
    const fromIdx = ids.indexOf(active.id as string);
    const toIdx = ids.indexOf(over.id as string);
    if (fromIdx < 0 || toIdx < 0) return;
    reorderBlocks(arrayMove(ids, fromIdx, toIdx));
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="px-3 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            {locale === "pt" ? "Blocos" : "Blocks"}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addBlock(survey.id)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="p-2 space-y-1">
              {sortedBlocks.map((block) => {
                const qCount = questions.filter((q) => q.block_id === block.id).length;
                return (
                  <SortableBlockRow
                    key={block.id}
                    block={block}
                    qCount={qCount}
                    isActive={activeBlockId === block.id}
                    canRemove={blocks.length > 1}
                    locale={locale}
                    onSelect={() => setActiveBlock(block.id)}
                    onTitleChange={(title) => updateBlock(block.id, { title })}
                    onRemove={() => removeBlock(block.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>
    </div>
  );
};

interface SortableBlockRowProps {
  block: SurveyBlock;
  qCount: number;
  isActive: boolean;
  canRemove: boolean;
  locale: string;
  onSelect: () => void;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}

const SortableBlockRow = ({
  block,
  qCount,
  isActive,
  canRemove,
  locale,
  onSelect,
  onTitleChange,
  onRemove,
}: SortableBlockRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group rounded-lg px-3 py-2.5 cursor-pointer transition-colors border",
        isActive
          ? "bg-primary/10 border-primary/30 text-primary"
          : "border-transparent hover:bg-muted hover:border-border/50",
        isDragging && "opacity-40 z-10"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <Input
            value={block.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="h-auto p-0 border-none shadow-none text-sm font-medium bg-transparent focus-visible:ring-0"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {qCount} {qCount === 1 ? (locale === "pt" ? "questão" : "question") : (locale === "pt" ? "questões" : "questions")}
          </p>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default BlockSidebar;
