import type { Json } from "@/integrations/supabase/types";

export interface ExportColumn {
  id: string;
  varName: string;
  questionText: string;
}

export type CodebookChoice = string | { text?: string; value?: string };

export interface CodebookQuestion {
  id: string;
  question_type: string;
  question_text: string;
  choices?: Json;
}

export function buildExportColumns(questions: CodebookQuestion[]): ExportColumn[] {
  return questions.map((q, i) => ({
    id: q.id,
    varName: `Q${i + 1}_${q.question_type}`,
    questionText: q.question_text || `Question ${i + 1}`,
  }));
}

/** Choice coding map: question id -> { choice label -> numeric code as string }. */
export function buildChoiceCodingMap(questions: CodebookQuestion[]): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  questions.forEach((q) => {
    if (q.question_type === "multiple_choice" && Array.isArray(q.choices)) {
      const coding: Record<string, string> = {};
      (q.choices as CodebookChoice[]).forEach((c, idx) => {
        const label = typeof c === "string" ? c : (c.text ?? String(c));
        coding[label] = String(idx);
      });
      map[q.id] = coding;
    }
  });
  return map;
}

/** Applies the coding map to a (possibly "; "-joined multi-value) answer string. */
export function formatCodedValue(
  value: string,
  questionId: string,
  codingMap: Record<string, Record<string, string>>,
): string {
  if (!value) return value;
  const coding = codingMap[questionId];
  if (!coding) return value;
  const parts = value.split("; ");
  return parts.map((p) => (coding[p] !== undefined ? coding[p] : p)).join("; ");
}

/** Variable / Question / Type / Value Labels, one row per question (+ header row). */
export function buildCodebookRows(
  columns: ExportColumn[],
  questions: CodebookQuestion[],
  codingMap: Record<string, Record<string, string>>,
): string[][] {
  const header = ["Variable", "Question", "Type", "Value Labels"];
  const body = columns.map((c) => {
    const q = questions.find((qq) => qq.id === c.id);
    const coding = codingMap[c.id];
    const labels = coding
      ? Object.entries(coding).map(([label, code]) => `${code} = ${label}`).join(" | ")
      : "";
    return [c.varName, c.questionText, q?.question_type || "", labels];
  });
  return [header, ...body];
}

/** Plain-text rendering of the codebook, for the DataMind system message. */
export function buildCodebookText(
  columns: ExportColumn[],
  questions: CodebookQuestion[],
  codingMap: Record<string, Record<string, string>>,
  locale: "pt" | "en",
): string {
  const title = locale === "pt" ? "Codebook (variáveis e códigos)" : "Codebook (variables and codes)";
  const lines = columns.map((c) => {
    const q = questions.find((qq) => qq.id === c.id);
    const coding = codingMap[c.id];
    const labels = coding
      ? Object.entries(coding).map(([label, code]) => `${code} = ${label}`).join(", ")
      : "";
    return `- ${c.varName} (${q?.question_type || ""}): ${c.questionText}${labels ? `\n    ${labels}` : ""}`;
  });
  return [title, ...lines].join("\n");
}
