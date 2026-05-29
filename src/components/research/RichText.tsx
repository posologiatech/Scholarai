import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Premium markdown renderer with GitHub-flavored markdown:
 * tables, task lists, strikethrough, autolinks + images.
 * Used across the research module (overview, schedule, meeting notes).
 */
export const RichText = ({ content, className }: { content?: string | null; className?: string }) => {
  if (!content || !content.trim()) {
    return <p className="text-sm text-muted-foreground italic">—</p>;
  }
  return (
    <div className={cn("rich-text prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
            <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-3" {...props} />
          ),
          code: ({ node, className: c, ...props }: any) => (
            <code className={cn("rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono", c)} {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default RichText;
