import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";

const isPipeRow = (line: string) => {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.length > 1;
};

const isSeparatorRow = (line: string) =>
  /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");

const countCols = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length;

/**
 * Normalizes loose pipe-delimited blocks (rows without the GFM header separator)
 * into valid markdown tables so they render with premium formatting instead of
 * showing raw "| a | b |" text.
 */
const normalizePipeTables = (raw: string): string => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isPipeRow(lines[i])) {
      const block: string[] = [];
      while (i < lines.length && isPipeRow(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      // Already a proper table (second row is a separator) → leave untouched.
      if (block.length >= 2 && isSeparatorRow(block[1])) {
        out.push(...block);
      } else if (block.length >= 1) {
        const cols = countCols(block[0]);
        const sep = "| " + Array(cols).fill("---").join(" | ") + " |";
        out.push(block[0], sep, ...block.slice(1));
      }
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
};

/**
 * Markdown intentionally collapses empty lines. In research notes the editor is
 * used like a notebook, so blank lines typed by the user must remain visible in
 * preview and presentation modes.
 */
const preserveVisualBlankLines = (raw: string): string => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) inFence = !inFence;
      if (!inFence && line.trim() === "") return "\u00A0";
      return line;
    })
    .join("\n");
};

/**
 * Premium markdown renderer with GitHub-flavored markdown:
 * tables, task lists, strikethrough, autolinks + images.
 * Used across the research module (overview, schedule, meeting notes).
 */
export const RichText = ({ content, className }: { content?: string | null; className?: string }) => {
  if (!content || !content.trim()) {
    return <p className="text-sm text-muted-foreground italic">—</p>;
  }
  const normalized = preserveVisualBlankLines(normalizePipeTables(content));
  return (
    <div className={cn("rich-text max-w-none text-sm leading-relaxed text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ node, ...props }) => (
            <p className="my-4 whitespace-pre-wrap leading-relaxed first:mt-0 last:mb-0" {...props} />
          ),
          br: ({ node, ...props }) => (
            <br className="block content-['']" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="mb-5 mt-7 text-2xl font-semibold tracking-normal text-foreground first:mt-0" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="mb-4 mt-6 text-xl font-semibold tracking-normal text-foreground first:mt-0" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="mb-3 mt-5 text-lg font-semibold tracking-normal text-foreground first:mt-0" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-4 list-disc space-y-2 pl-6 first:mt-0 last:mb-0" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6 first:mt-0 last:mb-0" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="pl-1 leading-relaxed [&>p]:my-1" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-border/70 shadow-sm">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted/60" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border-b border-border/70 px-3 py-2 text-left font-semibold text-foreground" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-b border-border/40 px-3 py-2 align-top" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="even:bg-muted/20 transition-colors hover:bg-muted/30" {...props} />
          ),
          img: ({ node, ...props }) => (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img className="my-3 rounded-xl border border-border/60 shadow-sm max-w-full" loading="lazy" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-primary underline underline-offset-2 hover:text-primary/80" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="my-4 border-l-4 border-primary/40 pl-4 italic text-muted-foreground [&>p]:my-2" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-border/70" {...props} />
          ),
          code: ({ node, className: c, ...props }: any) => (
            <code className={cn("rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono", c)} {...props} />
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};

export default RichText;
