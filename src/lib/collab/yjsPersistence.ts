import * as Y from "yjs";
import { generateJSON, getSchema } from "@tiptap/core";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import StarterKit from "@tiptap/starter-kit";

const SEED_EXTENSIONS = [StarterKit.configure({ history: false })];

/** Seeds an empty Y.Doc's default xml fragment from existing HTML — used the first time a
 * legacy (non-collaborative) document is opened in a collaborative session. */
export function seedYDocFromHtml(ydoc: Y.Doc, html: string) {
  const schema = getSchema(SEED_EXTENSIONS);
  const json = generateJSON(html && html.trim() ? html : "<p></p>", SEED_EXTENSIONS);
  prosemirrorJSONToYXmlFragment(schema, json, ydoc.getXmlFragment("default"));
}

/** PostgREST represents `bytea` columns as Postgres hex-escaped strings ("\\x0a1b..."). */
export function bytesToPgHex(bytes: Uint8Array): string {
  let hex = "\\x";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export function pgHexToBytes(hex: string | null | undefined): Uint8Array | null {
  if (!hex) return null;
  const clean = hex.startsWith("\\x") ? hex.slice(2) : hex;
  if (!clean) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return bytes;
}
