import { ImageIcon, FileText } from "lucide-react";

interface Props {
  type: string;
  content: string;
}

const DataMindCodeOutput = ({ type, content }: Props) => {
  if (type === "image") {
    return (
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Gráfico gerado</span>
        </div>
        <div className="p-4 flex justify-center">
          <img
            src={content}
            alt="Gráfico gerado pela análise"
            className="max-w-full rounded-lg"
          />
        </div>
      </div>
    );
  }

  // Mixed output: text + images with [IMG]...[/IMG] markers
  if (type === "mixed") {
    const parts = content.split(/(\[IMG\].*?\[\/IMG\])/);
    return (
      <div className="space-y-3">
        {parts.map((part, i) => {
          const imgMatch = part.match(/^\[IMG\](.*?)\[\/IMG\]$/);
          if (imgMatch) {
            return (
              <div key={i} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Gráfico {Math.ceil((i + 1) / 2)}</span>
                </div>
                <div className="p-4 flex justify-center">
                  <img
                    src={imgMatch[1]}
                    alt={`Gráfico ${Math.ceil((i + 1) / 2)}`}
                    className="max-w-full rounded-lg"
                  />
                </div>
              </div>
            );
          }
          const text = part.trim();
          if (!text) return null;
          return (
            <div key={i} className="rounded-xl border border-border/60 bg-muted/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/80">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Output</span>
              </div>
              <pre className="p-4 text-xs font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto">
                {text}
              </pre>
            </div>
          );
        })}
      </div>
    );
  }

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
};

export default DataMindCodeOutput;
