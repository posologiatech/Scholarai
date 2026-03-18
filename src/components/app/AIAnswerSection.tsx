import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Sparkles, Loader2, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Paper {
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
}

interface AIAnswerSectionProps {
  query: string;
  papers: Paper[];
  loading: boolean;
}

const SYNTHESIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/synthesize-papers`;

const AIAnswerSection = ({ query, papers, loading: papersLoading }: AIAnswerSectionProps) => {
  const { locale } = useLanguage();
  const [synthesis, setSynthesis] = useState("");
  const [synthLoading, setSynthLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (papersLoading || papers.length === 0 || hasRun.current) return;
    hasRun.current = true;
    streamSynthesis();
  }, [papersLoading, papers]);

  const streamSynthesis = async () => {
    setSynthLoading(true);
    setSynthesis("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess?.session?.access_token;
      if (!tk) return;

      const resp = await fetch(SYNTHESIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ query, papers: papers.slice(0, 15), locale }),
      });

      if (!resp.ok || !resp.body) throw new Error("Synthesis failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setSynthesis(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error("Synthesis error:", err);
    } finally {
      setSynthLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(synthesis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (papersLoading || papers.length === 0) return null;

  // Extract first paragraph as the bold summary
  const paragraphs = synthesis.split("\n\n").filter(Boolean);
  const previewText = paragraphs.slice(0, 2).join("\n\n");
  const hasMore = paragraphs.length > 2;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {locale === "pt" ? "Análise da Pesquisa" : "Research Analysis"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {locale === "pt"
                ? `Baseado em ${Math.min(papers.length, 15)} artigos analisados`
                : `Based on ${Math.min(papers.length, 15)} papers analyzed`}
            </p>
          </div>
        </div>
        {synthesis && !synthLoading && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? (locale === "pt" ? "Copiado" : "Copied") : (locale === "pt" ? "Copiar" : "Copy")}
          </button>
        )}
      </div>

      {/* Question */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-base font-medium text-foreground leading-relaxed">{query}</p>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        {synthLoading && !synthesis && (
          <div className="flex items-center gap-2.5 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{locale === "pt" ? "Analisando artigos e sintetizando resposta..." : "Analyzing papers and synthesizing answer..."}</span>
          </div>
        )}

        {synthesis && (
          <div className="space-y-3">
            {/* Summary content */}
            <div className="prose prose-sm max-w-none text-foreground/85 leading-relaxed [&_strong]:text-foreground [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-foreground [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2">
              <ReactMarkdown>
                {expanded || !hasMore ? synthesis : previewText}
              </ReactMarkdown>
              {synthLoading && <span className="inline-block h-4 w-1 animate-pulse bg-primary ml-0.5 rounded" />}
            </div>

            {/* Expand/collapse */}
            {hasMore && !synthLoading && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    {locale === "pt" ? "Ver menos" : "Show less"}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    {locale === "pt" ? "Ver análise completa" : "Show full analysis"}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {synthesis && !synthLoading && (
        <div className="flex items-center gap-4 border-t border-border/50 bg-muted/20 px-5 py-2.5">
          <span className="text-[11px] text-muted-foreground">
            {locale === "pt" ? `${Math.min(papers.length, 15)} fontes analisadas` : `${Math.min(papers.length, 15)} sources analyzed`}
          </span>
          <span className="text-[11px] text-muted-foreground">•</span>
          <span className="text-[11px] text-muted-foreground">
            {locale === "pt" ? "Gerado por IA — verifique as fontes" : "AI-generated — verify sources"}
          </span>
        </div>
      )}
    </div>
  );
};

export default AIAnswerSection;
