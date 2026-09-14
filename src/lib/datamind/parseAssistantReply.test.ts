import { describe, it, expect } from "vitest";
import {
  extractExplanationPrefix,
  isLikelyComplete,
  parseAssistantReply,
} from "./parseAssistantReply";

const NL = String.fromCharCode(10);

describe("extractExplanationPrefix", () => {
  it("returns nothing until the key has arrived", () => {
    expect(extractExplanationPrefix('{"expl')).toBe("");
    expect(extractExplanationPrefix("{")).toBe("");
    expect(extractExplanationPrefix("")).toBe("");
  });

  it("reads the explanation while the string is still open", () => {
    expect(extractExplanationPrefix('{"explanation": "Vou comparar os gr')).toBe(
      "Vou comparar os gr"
    );
  });

  it("stops at the closing quote and ignores the code that follows", () => {
    const partial = '{"explanation": "Pronto.", "code": "import pandas';
    expect(extractExplanationPrefix(partial)).toBe("Pronto.");
  });

  it("decodes escapes as they arrive", () => {
    expect(extractExplanationPrefix('{"explanation": "linha1\\nlinha2')).toBe(
      `linha1${NL}linha2`
    );
    expect(extractExplanationPrefix('{"explanation": "diz \\"oi\\" agora')).toBe(
      'diz "oi" agora'
    );
  });

  it("does not emit a half-arrived escape", () => {
    // A lone trailing backslash is the start of an escape, not a character.
    expect(extractExplanationPrefix('{"explanation": "quebra\\')).toBe("quebra");
    expect(extractExplanationPrefix('{"explanation": "acento\\u00')).toBe("acento");
  });

  it("treats an escaped quote as part of the string, not its end", () => {
    const partial = '{"explanation": "ele disse \\"pare\\" e parou", "code": null}';
    expect(extractExplanationPrefix(partial)).toBe('ele disse "pare" e parou');
  });

  it("tolerates a markdown fence around the JSON", () => {
    expect(extractExplanationPrefix('```json\n{"explanation": "oi')).toBe("oi");
  });
});

describe("parseAssistantReply", () => {
  it("parses a complete reply", () => {
    const reply = parseAssistantReply('{"explanation": "## ANOVA", "code": "print(1)"}');
    expect(reply).toEqual({ explanation: "## ANOVA", code: "print(1)" });
  });

  it("parses a reply wrapped in a markdown fence", () => {
    const reply = parseAssistantReply('```json\n{"explanation": "oi", "code": null}\n```');
    expect(reply.explanation).toBe("oi");
    expect(reply.code).toBeNull();
  });

  it("recovers the explanation from a truncated response", () => {
    // The code string was cut off by a token limit, so strict JSON fails.
    const truncated = '{"explanation": "Analisando os dados.", "code": "import pandas as pd\\nprint(';
    const reply = parseAssistantReply(truncated);
    expect(reply.explanation).toBe("Analisando os dados.");
  });

  it("keeps multi-line code intact", () => {
    const reply = parseAssistantReply('{"explanation": "x", "code": "a = 1\\nb = 2"}');
    expect(reply.code).toBe(`a = 1${NL}b = 2`);
  });

  it("falls back to prose when nothing is JSON-shaped", () => {
    const reply = parseAssistantReply("Não consegui entender o pedido.");
    expect(reply.explanation).toBe("Não consegui entender o pedido.");
    expect(reply.code).toBeNull();
  });

  it("handles an empty body", () => {
    expect(parseAssistantReply("")).toEqual({ explanation: "", code: null });
  });
});

describe("isLikelyComplete", () => {
  it("is true only once the object closes", () => {
    expect(isLikelyComplete('{"explanation": "a", "code": null}')).toBe(true);
    expect(isLikelyComplete('{"explanation": "a", "code": "prin')).toBe(false);
    expect(isLikelyComplete("")).toBe(false);
  });
});
