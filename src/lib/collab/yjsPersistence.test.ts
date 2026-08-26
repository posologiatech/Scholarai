import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { seedYDocFromHtml } from "./yjsPersistence";

describe("seedYDocFromHtml", () => {
  it("preserves a heading's data-section-id when seeding an existing document into a fresh Y.Doc", () => {
    const html = '<h2 data-section-id="methods">Métodos</h2><p>Texto de métodos.</p>';
    const ydoc = new Y.Doc();
    seedYDocFromHtml(ydoc, html);

    const xml = ydoc.getXmlFragment("default").toString();
    expect(xml).toContain('sectionId="methods"');
  });

  it("preserves a pending suggestion mark when seeding", () => {
    const html = '<p><ins data-suggestion-id="sg-1" data-author="ai">Texto sugerido.</ins></p>';
    const ydoc = new Y.Doc();
    seedYDocFromHtml(ydoc, html);

    const xml = ydoc.getXmlFragment("default").toString();
    expect(xml).toContain('suggestionId="sg-1"');
  });
});
