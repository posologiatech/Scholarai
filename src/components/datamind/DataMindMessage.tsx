import { Message } from "@/pages/DataMind";
import { BrainCircuit, User, Copy, Check, ChevronDown, ChevronUp, Code2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import DataMindCodeOutput from "./DataMindCodeOutput";
import DataMindComments from "./DataMindComments";

interface Props {
  message: Message;
  conversationId?: string;
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

// Distinguishes results backed by real code execution from unvalidated AI prose, so
// researchers don't mistake a narrated answer for a computed one.
type Verification = "verified" | "failed" | "pending" | "unverified";

function getVerification(message: Message): Verification {
  if (!message.code_block) return "unverified";
  if (!message.output_content) return "pending";
  if (message.output_content.trim().toLowerCase().startsWith("erro")) return "failed";
  return "verified";
}

const VERIFICATION_BADGE: Record<Verification, { icon: typeof CheckCircle2; label: string; className: string }> = {
  verified: { icon: CheckCircle2, label: "Calculado (código executado)", className: "text-emerald-600 dark:text-emerald-400" },
  failed: { icon: AlertTriangle, label: "Execução falhou", className: "text-destructive" },
  pending: { icon: AlertTriangle, label: "Código gerado, não executado", className: "text-amber-600 dark:text-amber-400" },
  unverified: { icon: AlertTriangle, label: "Resposta da IA, sem execução de código", className: "text-amber-600 dark:text-amber-400" },
};

const DataMindMessage = ({ message, conversationId, onSuggestionClick }: Props) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [codeExpanded, setCodeExpanded] = useState(false);
  const verification = isUser ? null : getVerification(message);
  const badge = verification ? VERIFICATION_BADGE[verification] : null;

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

      <div className={`min-w-0 ${isUser ? "max-w-[75%] ml-auto text-right" : "flex-1"}`}>
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

        {badge && (
          <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${badge.className}`}>
            <badge.icon className="h-3 w-3" />
            <span>{badge.label}</span>
          </div>
        )}

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

        {/* Comments button for assistant messages */}
        {!isUser && conversationId && (
          <div className="mt-1 flex items-center gap-1 text-left">
            <DataMindComments conversationId={conversationId} messageId={message.id} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataMindMessage;
