import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { SectionHeading } from "./sectionHeading";
import { resolveSectionInsertPos, listHeadings } from "./sectionPosition";
import { SuggestionInsertion, generateSuggestionId, suggestionContentFromText, listSuggestions } from "./suggestionMarks";

const editors: Editor[] = [];

function makeEditor() {
  const editor = new Editor({
    extensions: [StarterKit.configure({ heading: false }), SectionHeading, Placeholder, SuggestionInsertion],
    content: "<p></p>",
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors.length = 0;
});

function insertSuggestionInSection(editor: Editor, sectionId: string, sectionLabel: string, text: string) {
  const pos = resolveSectionInsertPos(editor, sectionId as any, sectionLabel);
  const content = suggestionContentFromText(text, generateSuggestionId(), "ai");
  editor.chain().insertContentAt(pos, content).run();
}

describe("full section insert flow (mirrors RichTextEditorHandle.insertSuggestionInSection)", () => {
  it("inserts into methods, then discussion, without throwing, and both texts land in the right place", () => {
    const editor = makeEditor();

    expect(() => insertSuggestionInSection(editor, "methods", "Métodos", "Texto de métodos gerado pela IA.")).not.toThrow();
    expect(editor.getHTML()).toContain("Texto de métodos gerado pela IA.");
    expect(listSuggestions(editor)).toHaveLength(1);

    expect(() => insertSuggestionInSection(editor, "discussion", "Discussão", "Texto de discussão gerado pela IA.")).not.toThrow();
    expect(editor.getHTML()).toContain("Texto de discussão gerado pela IA.");
    expect(listSuggestions(editor)).toHaveLength(2);

    const headings = listHeadings(editor);
    expect(headings.map((h) => h.sectionId)).toEqual(["methods", "discussion"]);

    // Discussion's text must come after the discussion heading, not mixed into methods.
    const html = editor.getHTML();
    const discussionHeadingIdx = html.indexOf("Discussão");
    const discussionTextIdx = html.indexOf("Texto de discussão");
    const methodsTextIdx = html.indexOf("Texto de métodos");
    expect(discussionTextIdx).toBeGreaterThan(discussionHeadingIdx);
    expect(discussionTextIdx).toBeGreaterThan(methodsTextIdx);
  });

  it("repeated insert calls for the same section (double-click / re-insert) don't throw", () => {
    const editor = makeEditor();
    insertSuggestionInSection(editor, "methods", "Métodos", "Primeiro texto.");
    expect(() => insertSuggestionInSection(editor, "methods", "Métodos", "Segundo texto.")).not.toThrow();
    expect(editor.getHTML()).toContain("Primeiro texto.");
    expect(editor.getHTML()).toContain("Segundo texto.");
  });
});
