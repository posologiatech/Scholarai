import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface SupabaseYjsProviderOptions {
  supabase: SupabaseClient;
  /** Unique room id — one Yjs "session" per writing_documents.id. */
  roomName: string;
  doc: Y.Doc;
  userInfo?: Record<string, unknown>;
}

/**
 * Minimal Yjs provider on top of Supabase Realtime broadcast + presence — there is no
 * dedicated websocket server in this infra (Cloudflare Pages/Workers + Supabase), so this
 * relays Yjs doc updates and awareness (cursor/presence) state as broadcast messages on a
 * per-document channel instead of using y-websocket/y-webrtc.
 *
 * Sync strategy: on join, broadcast a sync-request; any already-connected peer replies with
 * its full document state (encodeStateAsUpdate), which Yjs merges idempotently. From then on,
 * only incremental updates are broadcast.
 */
export class SupabaseYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  private channel: RealtimeChannel;
  private destroyed = false;

  constructor({ supabase, roomName, doc, userInfo }: SupabaseYjsProviderOptions) {
    this.doc = doc;
    this.awareness = new Awareness(doc);
    if (userInfo) this.awareness.setLocalStateField("user", userInfo);

    this.channel = supabase.channel(`writing-doc-${roomName}`, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on("broadcast", { event: "yjs-update" }, ({ payload }) => {
        try {
          Y.applyUpdate(this.doc, base64ToUint8Array(payload.update), this);
        } catch (e) {
          console.error("[SupabaseYjsProvider] failed to apply remote update", e);
        }
      })
      .on("broadcast", { event: "yjs-sync-request" }, ({ payload }) => {
        if (payload?.from === this.doc.clientID) return;
        this.channel.send({
          type: "broadcast",
          event: "yjs-sync-response",
          payload: { to: payload.from, update: uint8ArrayToBase64(Y.encodeStateAsUpdate(this.doc)) },
        });
      })
      .on("broadcast", { event: "yjs-sync-response" }, ({ payload }) => {
        if (payload?.to !== this.doc.clientID) return;
        try {
          Y.applyUpdate(this.doc, base64ToUint8Array(payload.update), this);
        } catch (e) {
          console.error("[SupabaseYjsProvider] failed to apply sync response", e);
        }
      })
      .on("broadcast", { event: "awareness" }, ({ payload }) => {
        try {
          applyAwarenessUpdate(this.awareness, base64ToUint8Array(payload.update), this);
        } catch (e) {
          console.error("[SupabaseYjsProvider] failed to apply awareness update", e);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !this.destroyed) {
          this.channel.send({
            type: "broadcast",
            event: "yjs-sync-request",
            payload: { from: this.doc.clientID },
          });
        }
      });

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || this.destroyed) return;
    this.channel.send({
      type: "broadcast",
      event: "yjs-update",
      payload: { update: uint8ArrayToBase64(update) },
    });
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === this || this.destroyed) return;
    const changedClients = added.concat(updated).concat(removed);
    this.channel.send({
      type: "broadcast",
      event: "awareness",
      payload: { update: uint8ArrayToBase64(encodeAwarenessUpdate(this.awareness, changedClients)) },
    });
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    removeAwarenessStates(this.awareness, [this.doc.clientID], "provider destroyed");
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.channel.unsubscribe();
  }
}
