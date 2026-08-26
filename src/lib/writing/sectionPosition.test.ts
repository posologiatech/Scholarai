import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SectionHeading } from "./sectionHeading";
import { ensureSectionHeading, resolveSectionInsertPos, listHeadings } from "./sectionPosition";
import { SECTIONS } from "./sections";

function makeEditor(content = "<p></p>") {
  return new Editor({
    extensions: [StarterKit.configure({ heading: false }), SectionHeading],
    content,
  });
}

describe("sectionPosition", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = makeEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  it("inserts a heading for a section that doesn't exist yet, at doc end", () => {
    ensureSectionHeading(editor, "methods", "Métodos");
    const headings = listHeadings(editor);
    expect(headings).toHaveLength(1);
    expect(headings[0]).toMatchObject({ sectionId: "methods", level: 2, text: "Métodos" });
  });

  it("is idempotent — calling twice for the same section doesn't duplicate", () => {
    ensureSectionHeading(editor, "methods", "Métodos");
    ensureSectionHeading(editor, "methods", "Métodos");
    expect(listHeadings(editor)).toHaveLength(1);
  });

  it("inserts new sections in canonical paper order, not just appended at the end", () => {
    ensureSectionHeading(editor, "results", "Resultados");
    ensureSectionHeading(editor, "introduction", "Introdução");
    ensureSectionHeading(editor, "methods", "Métodos");

    const order = listHeadings(editor).map((h) => h.sectionId);
    const canonicalOrder = SECTIONS.map((s) => s.id).filter((id) => order.includes(id));
    expect(order).toEqual(canonicalOrder);
  });

  it("resolveSectionInsertPos points before the next heading, not at doc end", () => {
    ensureSectionHeading(editor, "introduction", "Introdução");
    ensureSectionHeading(editor, "methods", "Métodos");

    const introHeading = listHeadings(editor).find((h) => h.sectionId === "introduction")!;
    const methodsHeading = listHeadings(editor).find((h) => h.sectionId === "methods")!;

    const pos = resolveSectionInsertPos(editor, "introduction", "Introdução");
    // Inserting exactly at the next heading's start position places content just before it (still in this section).
    expect(pos).toBe(methodsHeading.pos);
    expect(pos).toBeGreaterThan(introHeading.pos);
    expect(pos).toBeLessThan(editor.state.doc.content.size);
  });

  it("resolveSectionInsertPos falls back to doc end for the last existing section", () => {
    ensureSectionHeading(editor, "conclusion", "Conclusão");
    const pos = resolveSectionInsertPos(editor, "conclusion", "Conclusão");
    expect(pos).toBe(editor.state.doc.content.size);
  });
});
