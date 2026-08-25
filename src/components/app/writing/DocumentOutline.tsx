import { ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectionHeadingInfo } from "@/lib/writing/sectionPosition";

interface DocumentOutlineProps {
  headings: SectionHeadingInfo[];
  selectedSection: string;
  onSelectSection: (sectionId: string) => void;
  onNavigate: (pos: number) => void;
  onInsertSkeleton: () => void;
  pt: boolean;
}

export function DocumentOutline({ headings, selectedSection, onSelectSection, onNavigate, onInsertSkeleton, pt }: DocumentOutlineProps) {
  const handleClick = (heading: SectionHeadingInfo) => {
    onNavigate(heading.pos);
    if (heading.sectionId) onSelectSection(heading.sectionId);
  };

  return (
    <div className="w-40 shrink-0 border-r border-border/30 bg-background/60 overflow-y-auto py-3 px-2">
      {headings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-1 pt-4 text-center">
          <ListTree className="h-4 w-4 text-muted-foreground/50" />
          <p className="text-[10px] text-muted-foreground/70 leading-snug">
            {pt ? "Documento sem seções" : "No sections yet"}
          </p>
          <Button size="sm" variant="outline" className="h-7 text-[10px] w-full" onClick={onInsertSkeleton}>
            {pt ? "Estruturar" : "Structure"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {headings.map((h) => (
            <button
              key={h.pos}
              onClick={() => handleClick(h)}
              style={{ paddingLeft: `${6 + Math.max(0, h.level - 2) * 12}px` }}
              className={cn(
                "text-left text-[11px] rounded-md py-1 pr-2 truncate transition-colors",
                h.sectionId === selectedSection
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              title={h.text || (pt ? "(sem título)" : "(untitled)")}
            >
              {h.text || (pt ? "(sem título)" : "(untitled)")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentOutline;
