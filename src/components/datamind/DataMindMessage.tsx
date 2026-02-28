import { Message } from "@/pages/DataMind";
import { BrainCircuit, User, Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import DataMindCodeOutput from "./DataMindCodeOutput";

interface Props {
  message: Message;
}

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
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* Code block */}
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

        {/* Output */}
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
