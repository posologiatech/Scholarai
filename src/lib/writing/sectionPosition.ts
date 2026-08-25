import type { Editor } from "@tiptap/core";
import { SECTIONS, type SectionId } from "./sections";

export interface SectionHeadingInfo {
  pos: number;
  nodeSize: number;
  level: number;
  sectionId: SectionId | null;
  text: string;
}

/** All heading nodes in the live doc, in document order. */
export function listHeadings(editor: Editor): SectionHeadingInfo[] {
  const headings: SectionHeadingInfo[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    headings.push({
      pos,
      nodeSize: node.nodeSize,
      level: node.attrs.level as number,
      sectionId: (node.attrs.sectionId as SectionId | null) ?? null,
      text: node.textContent,
    });
  });
  return headings;
}

function findSectionHeading(editor: Editor, sectionId: SectionId): SectionHeadingInfo | undefined {
  return listHeadings(editor).find((h) => h.sectionId === sectionId);
}

/** End of `heading`'s content block: the next heading of same-or-shallower level, or doc end. */
function sectionEndPos(editor: Editor, heading: SectionHeadingInfo): number {
  const headings = listHeadings(editor);
  const idx = headings.findIndex((h) => h.pos === heading.pos);
  const next = headings.slice(idx + 1).find((h) => h.level <= heading.level);
  return next ? next.pos : editor.state.doc.content.size;
}

/**
 * Creates the H2 heading for `sectionId` if it doesn't exist yet, positioned in
 * canonical paper order: right before the first later canonical section that
 * already has a heading, or at the document end if none of the later sections
 * exist yet (this doubles as the append-at-end fallback for a document with no
 * structure at all — same code path, not a special case).
 */
export function ensureSectionHeading(editor: Editor, sectionId: SectionId, label: string): void {
  if (findSectionHeading(editor, sectionId)) return;
  const canonicalIdx = SECTIONS.findIndex((s) => s.id === sectionId);
  const headings = listHeadings(editor);
  let insertPos = editor.state.doc.content.size;
  for (const later of SECTIONS.slice(canonicalIdx + 1)) {
    const h = headings.find((hh) => hh.sectionId === later.id);
    if (h) {
      insertPos = h.pos;
      break;
    }
  }
  editor
    .chain()
    .insertContentAt(insertPos, [
      { type: "heading", attrs: { level: 2, sectionId }, content: [{ type: "text", text: label }] },
      { type: "paragraph" },
    ])
    .run();
}

/** Ensures the heading exists, then returns the position at the end of its content block. */
export function resolveSectionInsertPos(editor: Editor, sectionId: SectionId, label: string): number {
  ensureSectionHeading(editor, sectionId, label);
  const heading = findSectionHeading(editor, sectionId)!;
  return sectionEndPos(editor, heading);
}
