import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseYjsProvider } from "@/lib/collab/supabaseYjsProvider";
import { seedYDocFromHtml } from "@/lib/collab/yjsPersistence";
import { SuggestionInsertion, generateSuggestionId, suggestionContentFromText, listSuggestions, type SuggestionInfo } from "@/lib/writing/suggestionMarks";
import { SectionHeading } from "@/lib/writing/sectionHeading";
import { listHeadings, resolveSectionInsertPos, ensureSectionHeading, type SectionHeadingInfo } from "@/lib/writing/sectionPosition";
import type { SectionId } from "@/lib/writing/sections";

export interface RichTextEditorHandle {
  insertHtml: (html: string) => void;
  /** Inserts AI-generated text wrapped as a pending suggestion (accept/reject in the editor). */
  insertSuggestion: (text: string, author?: string) => void;
  /** Ensures the section's heading exists, then inserts as a pending suggestion at the end of that section's block. */
  insertSuggestionInSection: (sectionId: SectionId, sectionLabel: string, text: string, author?: string) => void;
  /** Idempotent — inserts only the canonical section headings that don't already exist. */
  insertSectionSkeleton: (sections: { id: SectionId; label: string }[]) => void;
  /** Moves the cursor/viewport to a document position (used by outline click-to-navigate). */
  focusAt: (pos: number) => void;
  getEditor: () => Editor | null;
}

export interface CollaborationUser {
  name: string;
  color: string;
}

export interface CollaborationConfig {
  supabase: SupabaseClient;
  documentId: string;
  user: CollaborationUser;
  /** Persisted Yjs state from a previous session, if any (see writing_documents.yjs_state). */
  initialYjsState?: Uint8Array | null;
  onReady?: (info: { ydoc: Y.Doc; provider: SupabaseYjsProvider }) => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  collaboration?: CollaborationConfig;
  onSuggestionsChange?: (suggestions: SuggestionInfo[]) => void;
  onHeadingsChange?: (headings: SectionHeadingInfo[]) => void;
}

function renderCaret(user: Record<string, unknown>): HTMLElement {
  const color = (user.color as string) || "#888";
  const cursor = document.createElement("span");
  cursor.classList.add("collaboration-caret");
  cursor.style.cssText = `border-left: 2px solid ${color}; margin-left: -1px; margin-right: -1px; position: relative; word-break: normal;`;

  const label = document.createElement("div");
  label.classList.add("collaboration-caret-label");
  label.style.cssText = `position: absolute; top: -1.35em; left: -1px; font-size: 10px; line-height: 1.4; background: ${color}; color: #fff; padding: 0 4px; border-radius: 3px; white-space: nowrap; pointer-events: none; z-index: 20;`;
  label.textContent = (user.name as string) || "?";
  cursor.appendChild(label);
  return cursor;
}

function renderSelection(user: Record<string, unknown>) {
  const color = (user.color as string) || "#888";
  return { style: `background-color: ${color}33;` };
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ value, onChange, placeholder, className, editable = true, collaboration, onSuggestionsChange, onHeadingsChange }, ref) => {
    const [ydoc] = useState(() => {
      const doc = new Y.Doc();
      if (collaboration) {
        if (collaboration.initialYjsState && collaboration.initialYjsState.length > 0) {
          Y.applyUpdate(doc, collaboration.initialYjsState);
        } else {
          seedYDocFromHtml(doc, value);
        }
      }
      return doc;
    });

    const [provider] = useState(() => {
      if (!collaboration) return null;
      return new SupabaseYjsProvider({
        supabase: collaboration.supabase,
        roomName: collaboration.documentId,
        doc: ydoc,
        userInfo: collaboration.user,
      });
    });

    useEffect(() => {
      if (provider) collaboration?.onReady?.({ ydoc, provider });
      return () => provider?.destroy();
      // Provider/ydoc are created once per mount (parent remounts via `key` on document switch).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const editor = useEditor({
      extensions: collaboration
        ? [
            StarterKit.configure({ heading: false, history: false }),
            SectionHeading,
            Placeholder.configure({ placeholder: placeholder || "" }),
            SuggestionInsertion,
            Collaboration.configure({ document: ydoc }),
            CollaborationCaret.configure({
              provider,
              user: collaboration.user,
              render: renderCaret,
              selectionRender: renderSelection,
            }),
          ]
        : [
            StarterKit.configure({ heading: false }),
            SectionHeading,
            Placeholder.configure({ placeholder: placeholder || "" }),
            SuggestionInsertion,
          ],
      content: collaboration ? undefined : value,
      editable,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
        onSuggestionsChange?.(listSuggestions(editor));
        onHeadingsChange?.(listHeadings(editor));
      },
      onCreate: ({ editor }) => {
        onSuggestionsChange?.(listSuggestions(editor));
        onHeadingsChange?.(listHeadings(editor));
      },
      editorProps: {
        attributes: {
          class: className || "",
        },
      },
    });

    // Sync external, non-collaborative changes (loading a document, restoring a version)
    // without disrupting active typing. In collaboration mode the Y.Doc is the source of
    // truth instead — forcing setContent here would fight the CRDT sync for every peer.
    useEffect(() => {
      if (!editor || collaboration) return;
      if (editor.getHTML() !== value) {
        editor.commands.setContent(value || "", false);
      }
    }, [value, editor, collaboration]);

    useEffect(() => {
      editor?.setEditable(editable);
    }, [editable, editor]);

    useImperativeHandle(
      ref,
      () => ({
        insertHtml: (html: string) => {
          if (!editor) return;
          editor.chain().focus("end").insertContent(html).run();
        },
        insertSuggestion: (text: string, author = "ai") => {
          if (!editor) return;
          const content = suggestionContentFromText(text, generateSuggestionId(), author);
          editor.chain().focus("end").insertContent(content).run();
          onSuggestionsChange?.(listSuggestions(editor));
        },
        insertSuggestionInSection: (sectionId, sectionLabel, text, author = "ai") => {
          if (!editor) return;
          const pos = resolveSectionInsertPos(editor, sectionId, sectionLabel);
          const content = suggestionContentFromText(text, generateSuggestionId(), author);
          editor.chain().insertContentAt(pos, content).run();
          onSuggestionsChange?.(listSuggestions(editor));
          onHeadingsChange?.(listHeadings(editor));
        },
        insertSectionSkeleton: (sections) => {
          if (!editor) return;
          sections.forEach(({ id, label }) => ensureSectionHeading(editor, id, label));
          onHeadingsChange?.(listHeadings(editor));
        },
        focusAt: (pos: number) => {
          if (!editor) return;
          editor.chain().focus(pos).scrollIntoView().run();
        },
        getEditor: () => editor,
      }),
      [editor, onSuggestionsChange, onHeadingsChange],
    );

    useEffect(() => () => editor?.destroy(), [editor]);

    return <EditorContent editor={editor} />;
  },
);

RichTextEditor.displayName = "RichTextEditor";

export default RichTextEditor;
