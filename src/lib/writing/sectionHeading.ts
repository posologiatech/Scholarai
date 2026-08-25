import Heading from "@tiptap/extension-heading";

/** Heading node extended with a stable section identity, independent of the visible text/locale. */
export const SectionHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      sectionId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-section-id"),
        renderHTML: (attrs: { sectionId?: string | null }) =>
          attrs.sectionId ? { "data-section-id": attrs.sectionId } : {},
      },
    };
  },
});
