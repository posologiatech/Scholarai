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
