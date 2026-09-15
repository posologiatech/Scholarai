/**
 * Parses the assistant's JSON reply, including while it is still arriving.
 *
 * The model answers with {"explanation": "...", "code": "..."} or, when the question
 * needs several chained analyses, {"explanation": "...", "plan": [...], "code": null}.
 * When streaming, the explanation has to be shown before the object is closed, so
 * this module can read a partial string; when the stream ends (or when a plain JSON
 * body comes back) the same text is parsed properly, tolerating fences and truncation.
 */

import { AnalysisStep, extractPlanArray, normalizePlan } from "./analysisPlan";

export interface AssistantReply {
  explanation: string;
  code: string | null;
  /** Empty unless the model answered with a multi-step plan. */
  plan: AnalysisStep[];
}

/** Strips markdown fences and anything before the opening brace. */
function stripToJson(text: string): string {
  let cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  if (start !== -1) cleaned = cleaned.slice(start);
  return cleaned;
}

const ESCAPES: Record<string, string> = {
  n: String.fromCharCode(10),
  r: String.fromCharCode(13),
  t: String.fromCharCode(9),
  b: String.fromCharCode(8),
  f: String.fromCharCode(12),
  '"': '"',
  "\\": "\\",
  "/": "/",
};

/**
 * Decodes a JSON string body that may stop mid-escape. An incomplete trailing
 * escape is dropped rather than rendered as a stray backslash, so the streamed
 * text never flickers with garbage.
 */
function decodeJsonStringBody(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) break; // trailing lone backslash: escape not complete yet
    if (next === "u") {
      const hex = body.slice(i + 2, i + 6);
      if (hex.length < 4) break; // unicode escape still arriving
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    out += ESCAPES[next] ?? next;
    i += 1;
  }
  return out;
}

/** Finds the end of the JSON string that starts at `from`, or -1 while it is open. */
function findStringEnd(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] !== '"') continue;
    // Count the backslashes immediately before: an odd number escapes the quote.
    let backslashes = 0;
    for (let j = i - 1; j >= from && text[j] === "\\"; j--) backslashes++;
    if (backslashes % 2 === 0) return i;
  }
  return -1;
}

const EXPLANATION_KEY = /"explanation"\s*:\s*"/;

/**
 * Pulls whatever of `explanation` has arrived so far. Returns "" until the key
 * itself shows up, which is why the prompt asks for explanation before code.
 */
export function extractExplanationPrefix(partial: string): string {
  const text = stripToJson(partial);
  const match = EXPLANATION_KEY.exec(text);
  if (!match) return "";

  const bodyStart = match.index + match[0].length;
  const end = findStringEnd(text, bodyStart);
  const body = end === -1 ? text.slice(bodyStart) : text.slice(bodyStart, end);
  return decodeJsonStringBody(body);
}

function fromRegex(text: string): AssistantReply {
  const explMatch = text.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const codeMatch = text.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return {
    explanation: explMatch ? decodeJsonStringBody(explMatch[1]) : "",
    code: codeMatch ? decodeJsonStringBody(codeMatch[1]) : null,
    // A plan is JSON inside the JSON, so it survives a truncated tail that the
    // string regexes above would miss entirely.
    plan: normalizePlan(extractPlanArray(text)),
  };
}

/**
 * Final parse. Tries strict JSON, then the same text cut at its last closing brace
 * (the usual shape of a response truncated by a token limit), then a regex sweep.
 */
export function parseAssistantReply(raw: string): AssistantReply {
  const text = stripToJson(raw);
  if (!text) return { explanation: "", code: null, plan: [] };

  const fromObject = (parsed: any): AssistantReply => ({
    explanation: parsed.explanation || "",
    code: parsed.code || null,
    plan: normalizePlan(parsed.plan),
  });

  try {
    return fromObject(JSON.parse(text));
  } catch { /* fall through */ }

  const lastBrace = text.lastIndexOf("}");
  if (lastBrace !== -1) {
    try {
      return fromObject(JSON.parse(text.slice(0, lastBrace + 1)));
    } catch { /* fall through */ }
  }

  const viaRegex = fromRegex(text);
  if (viaRegex.explanation || viaRegex.code || viaRegex.plan.length > 0) return viaRegex;

  // Nothing JSON-shaped survived: show the prose rather than an empty bubble.
  const prose = raw.replace(/```[\s\S]*?```/g, "").replace(/[{}]/g, "").trim();
  return { explanation: prose, code: null, plan: [] };
}

/**
 * A partial reply may have a complete explanation but an unfinished code string.
 * Used to decide whether the streamed text is safe to show as the final answer.
 */
export function isLikelyComplete(raw: string): boolean {
  const text = stripToJson(raw);
  if (!text) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
