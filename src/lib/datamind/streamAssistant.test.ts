import { describe, it, expect } from "vitest";
import { readAssistantStream } from "./streamAssistant";

const NL = String.fromCharCode(10);

/** Builds a Response whose body streams the given chunks, as the network would. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream);
}

function delta(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}${NL}`;
}

describe("readAssistantStream", () => {
  it("reassembles the deltas into the raw reply", async () => {
    const raw = await readAssistantStream(
      sseResponse([delta('{"explanation": "'), delta("Olá"), delta('", "code": null}'), `data: [DONE]${NL}`])
    );
    expect(raw).toBe('{"explanation": "Olá", "code": null}');
  });

  it("reports progress on every delta", async () => {
    const seen: string[] = [];
    await readAssistantStream(sseResponse([delta("a"), delta("b"), delta("c")]), {
      onText: (t) => seen.push(t),
    });
    expect(seen).toEqual(["a", "ab", "abc"]);
  });

  it("handles a payload split across two network chunks", async () => {
    const line = delta("texto completo");
    const cut = Math.floor(line.length / 2);
    const raw = await readAssistantStream(sseResponse([line.slice(0, cut), line.slice(cut)]));
    expect(raw).toBe("texto completo");
  });

  it("ignores comments, blank lines and the done token", async () => {
    const raw = await readAssistantStream(
      sseResponse([`: keep-alive${NL}${NL}`, delta("x"), `data: [DONE]${NL}`])
    );
    expect(raw).toBe("x");
  });

  it("tolerates CRLF line endings", async () => {
    const CR = String.fromCharCode(13);
    const line = `data: ${JSON.stringify({ choices: [{ delta: { content: "y" } }] })}${CR}${NL}`;
    expect(await readAssistantStream(sseResponse([line]))).toBe("y");
  });

  it("skips deltas that carry no content", async () => {
    const empty = `data: ${JSON.stringify({ choices: [{ delta: {} }] })}${NL}`;
    const raw = await readAssistantStream(sseResponse([empty, delta("z")]));
    expect(raw).toBe("z");
  });

  it("returns empty for a body-less response", async () => {
    expect(await readAssistantStream(new Response(null))).toBe("");
  });
});
