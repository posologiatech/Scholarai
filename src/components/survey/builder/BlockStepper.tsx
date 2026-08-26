import { useState } from "react";
import { SurveyBlock, useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const BlockStepper = () => {
  const { locale } = useLanguage();
  const {
    survey,
    blocks,
    questions,
    logicRules,
    activeBlockId,
    addBlock,
    removeBlock,
    updateBlock,
    setActiveBlock,
    reorderBlocks,
  } = useSurveyStore();

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

  // A block that's a "show_block" logic target starts hidden for the respondent until its
  // condition fires — surfacing that here is the only place a researcher would otherwise see it.
  const hasIncomingLogic = (blockId: string) =>
    logicRules.some((r) => r.action === "show_block" && r.target_id === blockId);

  return (
    <div className="border-b bg-muted/20 px-4 py-2.5 overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedBlocks.map((b) => b.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-1.5 w-max">
            {sortedBlocks.map((block) => (
              <BlockChip
                key={block.id}
                block={block}
                qCount={questions.filter((q) => q.block_id === block.id).length}
                isActive={activeBlockId === block.id}
                canRemove={blocks.length > 1}
                hasIncomingLogic={hasIncomingLogic(block.id)}
                locale={locale}
                onSelect={() => setActiveBlock(block.id)}
                onTitleChange={(title) => updateBlock(block.id, { title })}
                onRemove={() => removeBlock(block.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => addBlock(survey.id, locale as "pt" | "en")}
              className="flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === "pt" ? "Bloco" : "Block"}
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

interface BlockChipProps {
  block: SurveyBlock;
  qCount: number;
  isActive: boolean;
  canRemove: boolean;
  hasIncomingLogic: boolean;
  locale: string;
  onSelect: () => void;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}

const BlockChip = ({
  block,
  qCount,
  isActive,
  canRemove,
  hasIncomingLogic,
  locale,
  onSelect,
  onTitleChange,
  onRemove,
}: BlockChipProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.title);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== block.title) onTitleChange(trimmed);
    else setDraft(block.title);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(block.title); setEditing(false); }
        }}
        className="h-8 w-40 text-xs shrink-0"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer shrink-0 touch-none transition-colors",
        isActive
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
        isDragging && "opacity-40"
      )}
    >
      {hasIncomingLogic && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-primary-foreground" : "bg-amber-500")}
          title={locale === "pt" ? "Visibilidade controlada por lógica" : "Visibility controlled by logic"}
        />
      )}
      <span className="font-medium max-w-[140px] truncate">{block.title}</span>
      <span className={cn("text-[10px]", isActive ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
        {qCount}
      </span>
      {isActive && (
        <span className="flex items-center gap-0.5 -mr-1 pl-0.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setDraft(block.title); setEditing(true); }}
            className="rounded p-0.5 hover:bg-primary-foreground/20"
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
          {canRemove && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="rounded p-0.5 hover:bg-primary-foreground/20"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      )}
    </div>
  );
};

export default BlockStepper;
