import { useState } from "react";
import { ImageIcon, FileText, Table as TableIcon, X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  type: string;
  content: string;
}

interface OutputCard {
  kind: "table" | "image" | "text";
  title: string;
  content: string;
  rows?: string[][];
  headers?: string[];
}

/** Check if a text line is just a separator/header with no real data */
function isSeparatorOrEmpty(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Lines like "--- Title ---" or just dashes
  if (/^-{2,}\s*.*\s*-{2,}$/.test(trimmed)) return true;
  if (/^-{3,}$/.test(trimmed)) return true;
  // Lines like "[5 rows x 7 columns]"
  if (/^\[\d+\s+rows?\s+x\s+\d+\s+columns?\]$/i.test(trimmed)) return true;
  return false;
}

/** Parse stdout + image markers into structured cards */
function parseOutputCards(type: string, content: string): OutputCard[] {
  const cards: OutputCard[] = [];

  if (type === "image") {
    cards.push({ kind: "image", title: "Gráfico", content });
    return cards;
  }

  const parts = content.split(/(\[IMG\].*?\[\/IMG\])/);
  let chartIndex = 0;

  for (const part of parts) {
    const imgMatch = part.match(/^\[IMG\](.*?)\[\/IMG\]$/);
    if (imgMatch) {
      const imgData = imgMatch[1];
      // Skip empty/tiny base64 images
      if (imgData && imgData.length > 100) {
        chartIndex++;
        cards.push({ kind: "image", title: `Gráfico ${chartIndex}`, content: imgData });
      }
      continue;
    }

    const text = part.trim();
    if (!text) continue;

    const lines = text.split("\n");
    let currentText: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip pure separator lines
      if (isSeparatorOrEmpty(line)) continue;

      // Detect pandas-style table output
      const isTableLine = (l: string) => {
        const trimmed = l.trim();
        return (trimmed.split(/\s{2,}/).length >= 2) && !trimmed.startsWith("Aviso") && !trimmed.startsWith("Erro");
      };

      if (isTableLine(line)) {
        let tableEnd = i;
        while (tableEnd < lines.length && (isTableLine(lines[tableEnd]) || lines[tableEnd].trim() === "")) {
          tableEnd++;
        }

        if (tableEnd - i >= 2) {
          // Flush current text
          if (currentText.length > 0) {
            const txt = currentText.join("\n").trim();
            if (txt && !isSeparatorOrEmpty(txt)) {
              cards.push({ kind: "text", title: extractTitle(txt), content: txt });
            }
            currentText = [];
          }

          const tableLines = lines.slice(i, tableEnd).filter(l => l.trim() !== "");
          if (tableLines.length >= 1) {
            const headerParts = tableLines[0].trim().split(/\s{2,}/);
            const rows = tableLines.slice(1).map(l => l.trim().split(/\s{2,}/));

            const title = headerParts.length <= 3
              ? headerParts.join(", ")
              : `${headerParts.slice(0, 2).join(", ")}... (${headerParts.length} cols)`;

            cards.push({
              kind: "table",
              title,
              content: tableLines.join("\n"),
              headers: headerParts,
              rows,
            });
          }

          i = tableEnd - 1;
          continue;
        }
      }

      currentText.push(line);
    }

    if (currentText.length > 0) {
      const txt = currentText.join("\n").trim();
      if (txt && !isSeparatorOrEmpty(txt)) {
        cards.push({ kind: "text", title: extractTitle(txt), content: txt });
      }
    }
  }

  // Merge consecutive small text cards into one "Interpretação" card
  const merged: OutputCard[] = [];
  let textBuffer: string[] = [];

  for (const card of cards) {
    if (card.kind === "text" && card.content.length < 200) {
      textBuffer.push(card.content);
    } else {
      if (textBuffer.length > 0) {
        merged.push({ kind: "text", title: "Interpretação", content: textBuffer.join("\n\n") });
        textBuffer = [];
      }
      merged.push(card);
    }
  }
  if (textBuffer.length > 0) {
    merged.push({ kind: "text", title: "Interpretação", content: textBuffer.join("\n\n") });
  }

  return merged;
}

/** Extract a meaningful title from text content */
function extractTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  // If it looks like a header/title line
  if (firstLine.length < 60 && firstLine.length > 0) return firstLine;
  return "Interpretação";
}

/** Side panel for detailed view */
const DetailPanel = ({
  card,
  allCards,
  onClose,
  onNavigate,
}: {
  card: OutputCard;
  allCards: OutputCard[];
  onClose: () => void;
  onNavigate: (card: OutputCard) => void;
}) => {
  const tableCards = allCards.filter(c => c.kind === "table");
  const isTable = card.kind === "table";

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-background border-l border-border/60 shadow-2xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card">
        <div className="flex items-center gap-2">
          {card.kind === "table" ? (
            <TableIcon className="h-4 w-4 text-primary" />
          ) : card.kind === "image" ? (
            <ImageIcon className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-medium text-foreground truncate max-w-[300px]">{card.title}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {isTable && tableCards.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/40 overflow-x-auto bg-muted/30">
          {tableCards.map((tc, i) => (
            <button
              key={i}
              onClick={() => onNavigate(tc)}
              className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tc === card
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/40"
              }`}
            >
              {tc.title.length > 20 ? tc.title.slice(0, 18) + "…" : tc.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {card.kind === "image" && (
          <img src={card.content} alt={card.title} className="w-full rounded-lg" onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }} />
        )}
        {card.kind === "table" && card.headers && (
          <div className="overflow-x-auto">
            <div className="text-xs text-muted-foreground mb-2">
              {card.headers.length} cols, {card.rows?.length || 0} rows
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium w-8">#</th>
                  {card.headers.map((h, i) => (
                    <th key={i} className="text-left py-2 px-3 font-semibold text-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.rows?.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/20 hover:bg-muted/30">
                    <td className="py-2 px-3 text-muted-foreground">{ri + 1}</td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-2 px-3 text-foreground whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {card.kind === "text" && (
          <pre className="text-sm font-mono text-foreground/90 whitespace-pre-wrap leading-relaxed">{card.content}</pre>
        )}
      </div>
    </motion.div>
  );
};

const DataMindCodeOutput = ({ type, content }: Props) => {
  const [selectedCard, setSelectedCard] = useState<OutputCard | null>(null);
  const cards = parseOutputCards(type, content);

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/80">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Output</span>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto">
          {content}
        </pre>
      </div>
    );
  }

  // Single text card — render inline without card grid
  if (cards.length === 1 && cards[0].kind === "text") {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/80">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Output</span>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto">
          {cards[0].content}
        </pre>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cards.map((card, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelectedCard(card)}
            className="rounded-xl border border-border/60 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all p-3 text-left group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              {card.kind === "table" ? (
                <TableIcon className="h-3.5 w-3.5 text-primary" />
              ) : card.kind === "image" ? (
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-primary" />
              )}
              <span className="text-[10px] text-muted-foreground capitalize">
                {card.kind === "table" ? "Table" : card.kind === "image" ? "Chart" : "Text"}
              </span>
            </div>
            <p className="text-xs font-medium text-foreground truncate">{card.title}</p>

            {card.kind === "image" && (
              <div className="mt-2 rounded-md overflow-hidden h-20 bg-muted/30">
                <img
                  src={card.content}
                  alt={card.title}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).closest('.rounded-xl')?.classList.add('hidden'); }}
                />
              </div>
            )}
            {card.kind === "table" && card.rows && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                {card.rows.length} rows × {card.headers?.length || 0} cols
              </div>
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selectedCard && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedCard(null)}
            />
            <DetailPanel
              card={selectedCard}
              allCards={cards}
              onClose={() => setSelectedCard(null)}
              onNavigate={setSelectedCard}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default DataMindCodeOutput;
