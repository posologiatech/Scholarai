import { Mark, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";

/** Tiptap mark for AI-inserted text pending author review — rendered as <ins data-suggestion-id>. */
export const SuggestionInsertion = Mark.create({
  name: "suggestionInsertion",
  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-suggestion-id"),
        renderHTML: (attrs) => (attrs.suggestionId ? { "data-suggestion-id": attrs.suggestionId } : {}),
      },
      author: {
        default: "ai",
        parseHTML: (el) => el.getAttribute("data-author"),
        renderHTML: (attrs) => (attrs.author ? { "data-author": attrs.author } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "ins[data-suggestion-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["ins", mergeAttributes({ class: "suggestion-insertion" }, HTMLAttributes), 0];
  },
});

let counter = 0;
export function generateSuggestionId(): string {
  counter += 1;
  return `sg-${Date.now()}-${counter}`;
}

/** Builds paragraph/text JSON content with every text run carrying the suggestion mark. */
export function suggestionContentFromText(text: string, suggestionId: string, author = "ai"): JSONContent[] {
  const mark = { type: "suggestionInsertion", attrs: { suggestionId, author } };
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.length > 0);
  return paragraphs.map((para) => {
    const lines = para.split("\n");
    const content: JSONContent[] = [];
    lines.forEach((line, i) => {
      if (line.length > 0) content.push({ type: "text", text: line, marks: [mark] });
      if (i < lines.length - 1) content.push({ type: "hardBreak" });
    });
    return { type: "paragraph", content: content.length > 0 ? content : undefined };
  });
}

export interface SuggestionInfo {
  suggestionId: string;
  author: string;
  text: string;
  from: number;
  to: number;
}

/** Lists pending suggestions in the doc, merging contiguous text runs that share an id. */
export function listSuggestions(editor: Editor): SuggestionInfo[] {
  const markType = editor.state.schema.marks.suggestionInsertion;
  if (!markType) return [];
  const byId = new Map<string, SuggestionInfo>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type === markType);
    if (!mark) return;
    const id = mark.attrs.suggestionId as string;
    const existing = byId.get(id);
    if (existing && existing.to === pos) {
      existing.to = pos + node.nodeSize;
      existing.text += node.text || "";
    } else {
      byId.set(id, {
        suggestionId: id,
        author: (mark.attrs.author as string) || "ai",
        text: node.text || "",
        from: pos,
        to: pos + node.nodeSize,
      });
    }
  });
  return Array.from(byId.values());
}

function suggestionRanges(editor: Editor, suggestionId: string): { from: number; to: number }[] {
  const markType = editor.state.schema.marks.suggestionInsertion;
  if (!markType) return [];
  const ranges: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type === markType && m.attrs.suggestionId === suggestionId)) {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  return ranges;
}

/** Accepts a suggestion: keeps the text, removes the pending mark. */
export function acceptSuggestion(editor: Editor, suggestionId: string) {
  const markType = editor.state.schema.marks.suggestionInsertion;
  if (!markType) return;
  let tr = editor.state.tr;
  for (const { from, to } of suggestionRanges(editor, suggestionId)) {
    tr = tr.removeMark(from, to, markType);
  }
  editor.view.dispatch(tr);
}

/** Rejects a suggestion: removes the suggested text entirely. */
export function rejectSuggestion(editor: Editor, suggestionId: string) {
  const ranges = suggestionRanges(editor, suggestionId);
  let tr = editor.state.tr;
  for (let i = ranges.length - 1; i >= 0; i--) {
    tr = tr.delete(ranges[i].from, ranges[i].to);
  }
  editor.view.dispatch(tr);
}

export function acceptAllSuggestions(editor: Editor) {
  for (const s of listSuggestions(editor)) acceptSuggestion(editor, s.suggestionId);
}

export function rejectAllSuggestions(editor: Editor) {
  for (const s of listSuggestions(editor)) rejectSuggestion(editor, s.suggestionId);
}
