import { Message } from "@/pages/DataMind";
import { BrainCircuit, User, Copy, Check, ChevronDown, ChevronUp, Code2 } from "lucide-react";
import { useState } from "react";
import DataMindCodeOutput from "./DataMindCodeOutput";

interface Props {
  message: Message;
  onSuggestionClick?: (q: string) => void;
}

const SimpleMarkdown = ({ content }: { content: string }) => {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const withCode = processed.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');

        if (line.startsWith("### ")) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={i} className="font-bold text-base mt-4 mb-2">{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>;
        if (line.match(/^\d+\.\s/)) return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: withCode.replace(/^\d+\.\s/, '') }} />;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: withCode.slice(2) }} />;
        if (line.startsWith("  - ") || line.startsWith("  * ")) return <li key={i} className="ml-8 list-disc text-muted-foreground" dangerouslySetInnerHTML={{ __html: withCode.slice(4) }} />;
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: withCode }} />;
      })}
    </div>
  );
};

const DataMindMessage = ({ message, onSuggestionClick }: Props) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [codeExpanded, setCodeExpanded] = useState(false);

  const copyCode = () => {
    if (message.code_block) {
      navigator.clipboard.writeText(message.code_block);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Extract suggestions from content (lines starting with specific patterns)
  const extractSuggestions = (content: string): string[] => {
    // Look for questions at the end of the message
    const lines = content.split("\n");
    const suggestions: string[] = [];
    let foundSuggestionSection = false;

    for (const line of lines) {
      if (line.toLowerCase().includes("gostaria que eu") || line.toLowerCase().includes("deseja que eu") || line.toLowerCase().includes("sugestões")) {
        foundSuggestionSection = true;
      }
    }

    return suggestions;
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
          <div className="text-sm leading-relaxed">
            <SimpleMarkdown content={message.content} />
          </div>
        </div>

        {/* Collapsible code block - Julius style */}
        {message.code_block && (
          <div className="mt-3 rounded-xl border border-border/60 bg-card overflow-hidden text-left">
            <button
              onClick={() => setCodeExpanded(!codeExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {message.output_content ? "Code" : "Generating Code"}
                </span>
              </div>
              {codeExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {codeExpanded && (
              <div className="border-t border-border/40">
                <div className="flex items-center justify-between px-4 py-1.5 bg-muted/30">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    🐍 <span className="font-medium">Python</span>
                  </span>
                  <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-xs font-mono text-foreground/90 bg-muted/20">
                  <code>{message.code_block}</code>
                </pre>
              </div>
            )}
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
