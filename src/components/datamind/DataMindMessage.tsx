import { Message } from "@/pages/DataMind";
import { BrainCircuit, User, Copy, Check } from "lucide-react";
import { useState } from "react";
import DataMindCodeOutput from "./DataMindCodeOutput";

interface Props {
  message: Message;
}

// Simple markdown-like renderer to avoid react-markdown ESM issues
const SimpleMarkdown = ({ content }: { content: string }) => {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // Bold
        const processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Inline code
        const withCode = processed.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
        
        if (line.startsWith("# ")) return <h3 key={i} className="font-bold text-base">{line.slice(2)}</h3>;
        if (line.startsWith("## ")) return <h4 key={i} className="font-semibold text-sm">{line.slice(3)}</h4>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: withCode.slice(2) }} />;
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: withCode }} />;
      })}
    </div>
  );
};

const DataMindMessage = ({ message }: Props) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (message.code_block) {
      navigator.clipboard.writeText(message.code_block);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex items-start gap-3 py-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isUser ? "bg-secondary" : "bg-primary/10"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-secondary-foreground" />
        ) : (
          <BrainCircuit className="h-4 w-4 text-primary" />
        )}
      </div>

      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block text-left rounded-2xl px-4 py-3 max-w-full ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border/60"
          }`}
        >
          <div className="text-sm">
            <SimpleMarkdown content={message.content} />
          </div>
        </div>

        {message.code_block && (
          <div className="mt-3 rounded-xl border border-border/60 bg-muted/50 overflow-hidden text-left">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/80">
              <span className="text-xs font-mono text-muted-foreground">Python</span>
              <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs font-mono text-foreground/90">
              <code>{message.code_block}</code>
            </pre>
          </div>
        )}

        {message.output_type && message.output_content && (
          <div className="mt-3 text-left">
            <DataMindCodeOutput type={message.output_type} content={message.output_content} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataMindMessage;
