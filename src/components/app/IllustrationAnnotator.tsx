import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Type, ArrowRight, Square, Circle, Download, Undo2, Trash2, Move } from "lucide-react";
import jsPDF from "jspdf";

type Tool = "select" | "text" | "arrow" | "rect" | "circle";

interface Annotation {
  id: string;
  type: "text" | "arrow" | "rect" | "circle";
  x: number;
  y: number;
  text?: string;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  radius?: number;
  color: string;
  fontSize?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
}

export default function IllustrationAnnotator({ open, onClose, imageUrl }: Props) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [color, setColor] = useState("#e74c3c");
  const [fontSize, setFontSize] = useState(16);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentEnd, setCurrentEnd] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!open || !imageUrl) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageUrl;
    image.onload = () => {
      setImg(image);
      // Fit to container
      const maxW = Math.min(900, window.innerWidth - 100);
      const maxH = window.innerHeight - 300;
      const s = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1);
      setScale(s);
    };
  }, [open, imageUrl]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw annotations
    for (const a of annotations) {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = 2;

      if (a.type === "text" && a.text) {
        ctx.font = `${(a.fontSize || 16) * scale}px sans-serif`;
        ctx.fillText(a.text, a.x * scale, a.y * scale);
      } else if (a.type === "arrow" && a.endX !== undefined && a.endY !== undefined) {
        const sx = a.x * scale, sy = a.y * scale, ex = a.endX * scale, ey = a.endY * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(ey - sy, ex - sx);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (a.type === "rect" && a.width !== undefined && a.height !== undefined) {
        ctx.strokeRect(a.x * scale, a.y * scale, a.width * scale, a.height * scale);
      } else if (a.type === "circle" && a.radius !== undefined) {
        ctx.beginPath();
        ctx.arc(a.x * scale, a.y * scale, a.radius * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw in-progress shape
    if (drawing && (tool === "arrow" || tool === "rect" || tool === "circle")) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (tool === "arrow") {
        ctx.beginPath();
        ctx.moveTo(startPos.x * scale, startPos.y * scale);
        ctx.lineTo(currentEnd.x * scale, currentEnd.y * scale);
        ctx.stroke();
      } else if (tool === "rect") {
        ctx.strokeRect(startPos.x * scale, startPos.y * scale, (currentEnd.x - startPos.x) * scale, (currentEnd.y - startPos.y) * scale);
      } else if (tool === "circle") {
        const r = Math.sqrt((currentEnd.x - startPos.x) ** 2 + (currentEnd.y - startPos.y) ** 2);
        ctx.beginPath();
        ctx.arc(startPos.x * scale, startPos.y * scale, r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [img, annotations, scale, drawing, tool, startPos, currentEnd, color]);

  useEffect(() => { redraw(); }, [redraw]);

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getPos(e);

    if (tool === "select") {
      // Check if clicking on an annotation to drag
      for (let i = annotations.length - 1; i >= 0; i--) {
        const a = annotations[i];
        const hitRange = 20;
        if (Math.abs(pos.x - a.x) < hitRange && Math.abs(pos.y - a.y) < hitRange) {
          setDragging(a.id);
          setDragOffset({ x: pos.x - a.x, y: pos.y - a.y });
          return;
        }
      }
      return;
    }

    if (tool === "text") {
      setTextPos(pos);
      setShowTextInput(true);
      return;
    }

    setDrawing(true);
    setStartPos(pos);
    setCurrentEnd(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const pos = getPos(e);
      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id !== dragging) return a;
          const dx = pos.x - dragOffset.x - a.x;
          const dy = pos.y - dragOffset.y - a.y;
          return {
            ...a,
            x: a.x + dx,
            y: a.y + dy,
            endX: a.endX !== undefined ? a.endX + dx : undefined,
            endY: a.endY !== undefined ? a.endY + dy : undefined,
          };
        })
      );
      setDragOffset({ x: pos.x - (annotations.find((a) => a.id === dragging)!.x + (pos.x - dragOffset.x - annotations.find((a) => a.id === dragging)!.x)), y: pos.y - (annotations.find((a) => a.id === dragging)!.y + (pos.y - dragOffset.y - annotations.find((a) => a.id === dragging)!.y)) });
      return;
    }
    if (!drawing) return;
    setCurrentEnd(getPos(e));
  };

  const handleMouseUp = () => {
    if (dragging) { setDragging(null); return; }
    if (!drawing) return;
    setDrawing(false);

    const id = crypto.randomUUID();
    if (tool === "arrow") {
      setAnnotations((p) => [...p, { id, type: "arrow", x: startPos.x, y: startPos.y, endX: currentEnd.x, endY: currentEnd.y, color }]);
    } else if (tool === "rect") {
      setAnnotations((p) => [...p, { id, type: "rect", x: startPos.x, y: startPos.y, width: currentEnd.x - startPos.x, height: currentEnd.y - startPos.y, color }]);
    } else if (tool === "circle") {
      const r = Math.sqrt((currentEnd.x - startPos.x) ** 2 + (currentEnd.y - startPos.y) ** 2);
      setAnnotations((p) => [...p, { id, type: "circle", x: startPos.x, y: startPos.y, radius: r, color }]);
    }
  };

  const addText = () => {
    if (!textInput.trim()) { setShowTextInput(false); return; }
    setAnnotations((p) => [...p, { id: crypto.randomUUID(), type: "text", x: textPos.x, y: textPos.y, text: textInput, color, fontSize }]);
    setTextInput("");
    setShowTextInput(false);
  };

  const exportCanvas = (format: "png" | "pdf") => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    // Re-render at full resolution for export
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;
    const ctx = exportCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    for (const a of annotations) {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = 2;
      if (a.type === "text" && a.text) {
        ctx.font = `${a.fontSize || 16}px sans-serif`;
        ctx.fillText(a.text, a.x, a.y);
      } else if (a.type === "arrow" && a.endX !== undefined && a.endY !== undefined) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.endX, a.endY); ctx.stroke();
        const angle = Math.atan2(a.endY - a.y, a.endX - a.x);
        ctx.beginPath();
        ctx.moveTo(a.endX, a.endY);
        ctx.lineTo(a.endX - 12 * Math.cos(angle - Math.PI / 6), a.endY - 12 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(a.endX, a.endY);
        ctx.lineTo(a.endX - 12 * Math.cos(angle + Math.PI / 6), a.endY - 12 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (a.type === "rect" && a.width !== undefined && a.height !== undefined) {
        ctx.strokeRect(a.x, a.y, a.width, a.height);
      } else if (a.type === "circle" && a.radius !== undefined) {
        ctx.beginPath(); ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2); ctx.stroke();
      }
    }

    if (format === "png") {
      const a = document.createElement("a");
      a.href = exportCanvas.toDataURL("image/png");
      a.download = "illustration-annotated.png";
      a.click();
    } else {
      const orientation = img.naturalWidth > img.naturalHeight ? "landscape" as const : "portrait" as const;
      const pdf = new jsPDF({ orientation, unit: "px", format: [img.naturalWidth, img.naturalHeight] });
      pdf.addImage(exportCanvas.toDataURL("image/png"), "PNG", 0, 0, img.naturalWidth, img.naturalHeight);
      pdf.save("illustration-annotated.pdf");
    }
    toast.success(pt ? "Exportado!" : "Exported!");
  };

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <Move className="h-4 w-4" />, label: pt ? "Mover" : "Move" },
    { id: "text", icon: <Type className="h-4 w-4" />, label: pt ? "Texto" : "Text" },
    { id: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: pt ? "Seta" : "Arrow" },
    { id: "rect", icon: <Square className="h-4 w-4" />, label: pt ? "Retângulo" : "Rectangle" },
    { id: "circle", icon: <Circle className="h-4 w-4" />, label: pt ? "Círculo" : "Circle" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle>{pt ? "Anotar Ilustração" : "Annotate Illustration"}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {tools.map((t) => (
            <Button
              key={t.id}
              variant={tool === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              {t.icon}
              <span className="ml-1 hidden sm:inline text-xs">{t.label}</span>
            </Button>
          ))}

          <div className="h-6 w-px bg-border mx-1" />

          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-8 rounded cursor-pointer border border-border"
            title={pt ? "Cor" : "Color"}
          />

          {tool === "text" && (
            <Input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-16 h-8"
              min={8}
              max={72}
              title="Font size"
            />
          )}

          <div className="h-6 w-px bg-border mx-1" />

          <Button variant="outline" size="sm" onClick={() => setAnnotations((p) => p.slice(0, -1))} disabled={annotations.length === 0}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnnotations([])} disabled={annotations.length === 0}>
            <Trash2 className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={() => exportCanvas("png")}>
            <Download className="h-4 w-4 mr-1" /> PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCanvas("pdf")}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="relative flex justify-center bg-muted/30 rounded-lg overflow-auto">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair"
            style={{ cursor: tool === "select" ? "grab" : "crosshair" }}
          />

          {/* Floating text input */}
          {showTextInput && (
            <div
              className="absolute flex gap-1"
              style={{ left: textPos.x * scale, top: textPos.y * scale }}
            >
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addText()}
                placeholder={pt ? "Digite o texto..." : "Type text..."}
                className="h-8 w-48 text-sm"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={addText}>OK</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowTextInput(false)}>✕</Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {pt
            ? `${annotations.length} anotações • Clique para adicionar, arraste para mover`
            : `${annotations.length} annotations • Click to add, drag to move`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
