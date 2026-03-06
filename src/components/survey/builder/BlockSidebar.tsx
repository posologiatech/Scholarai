import { useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

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

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (!survey) return null;

  const sortedBlocks = [...blocks].sort((a, b) => a.block_order - b.block_order);

  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    setDragId(blockId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", blockId);
  };

  const handleDragOver = (e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverId(blockId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = sortedBlocks.map((b) => b.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    reorderBlocks(ids);
    setDragId(null);
    setOverId(null);
  };

  const handleDragEnd = () => { setDragId(null); setOverId(null); };

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
        <div className="p-2 space-y-1">
          {sortedBlocks.map((block) => {
            const qCount = questions.filter((q) => q.block_id === block.id).length;
            const isActive = activeBlockId === block.id;
            const isDragging = dragId === block.id;
            const isOver = overId === block.id && dragId !== block.id;
            return (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, block.id)}
                onDragOver={(e) => handleDragOver(e, block.id)}
                onDrop={(e) => handleDrop(e, block.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group rounded-lg px-3 py-2.5 cursor-pointer transition-all border",
                  isActive
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-transparent hover:bg-muted hover:border-border/50",
                  isDragging && "opacity-40",
                  isOver && "border-primary border-dashed bg-primary/5"
                )}
                onClick={() => setActiveBlock(block.id)}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing" />
                  <div className="flex-1 min-w-0">
                    <Input
                      value={block.title}
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                      className="h-auto p-0 border-none shadow-none text-sm font-medium bg-transparent focus-visible:ring-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {qCount} {qCount === 1 ? (locale === "pt" ? "questão" : "question") : (locale === "pt" ? "questões" : "questions")}
                    </p>
                  </div>
                  {blocks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default BlockSidebar;
