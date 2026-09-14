/**
 * Reads an OpenAI-format SSE stream and reassembles the assistant's raw text.
 *
 * The edge function forwards the provider's stream untouched, so the delta format
 * here is the same one the other streaming features in this project consume.
 */

export interface StreamCallbacks {
  /** Called with the full raw text accumulated so far, on every delta. */
  onText?: (rawSoFar: string) => void;
}

const DATA_PREFIX = "data: ";
const DONE_TOKEN = "[DONE]";

/**
 * Consumes the stream to completion and returns the raw assistant text — still the
 * JSON envelope, which the caller parses with parseAssistantReply.
 */
export async function readAssistantStream(
  response: Response,
  callbacks: StreamCallbacks = {}
): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf(String.fromCharCode(10))) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith(String.fromCharCode(13))) line = line.slice(0, -1);

        // Comments and keep-alive blanks carry no payload.
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith(DATA_PREFIX)) continue;

        const payload = line.slice(DATA_PREFIX.length).trim();
        if (payload === DONE_TOKEN) continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            raw += delta;
            callbacks.onText?.(raw);
          }
        } catch {
          // A chunk can split a JSON payload across reads; put it back and wait
          // for the rest instead of dropping the delta.
          buffer = line + String.fromCharCode(10) + buffer;
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return raw;
}
