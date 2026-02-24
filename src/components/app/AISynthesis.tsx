import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Paper {
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
}

interface AISynthesisProps {
  query: string;
  papers: Paper[];
  loading: boolean;
}

const SYNTHESIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/synthesize-papers`;

const AISynthesis = ({ query, papers, loading: papersLoading }: AISynthesisProps) => {
  const { t, locale } = useLanguage();
  const [synthesis, setSynthesis] = useState("");
  const [synthLoading, setSynthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (papersLoading || papers.length === 0 || hasRun.current) return;
    hasRun.current = true;
    streamSynthesis();
  }, [papersLoading, papers]);

  const streamSynthesis = async () => {
    setSynthLoading(true);
    setError(null);
    setSynthesis("");

    try {
      const resp = await fetch(SYNTHESIZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, papers, locale }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to synthesize");
      }

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
    } catch (err: any) {
      setError(err.message || "Synthesis failed");
    } finally {
      setSynthLoading(false);
    }
  };

  if (papersLoading || papers.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" />
        {t("search.aiSynthesis")}
      </div>

      {synthLoading && !synthesis && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("search.synthesizing")}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {synthesis && (
        <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {synthesis}
          {synthLoading && <span className="inline-block h-4 w-1 animate-pulse bg-primary ml-0.5" />}
        </div>
      )}
    </div>
  );
};

export default AISynthesis;
