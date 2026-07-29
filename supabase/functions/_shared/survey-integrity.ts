// Shared by survey-respond, survey-edit-answer and survey-verify-integrity so all three
// compute the exact same hash for the exact same inputs — required for the chain below to
// be verifiable at all.
//
// Each answer's hash incorporates the hash of its own immediately-previous state
// (previous_hash: null at creation, the prior integrity_hash on every edit). That's what
// makes this a real tamper-evidence chain rather than a checksum: recomputing a link
// requires knowing the correct predecessor, so editing historical audit rows, or writing
// to survey_answers outside survey-edit-answer, breaks verification instead of silently
// producing a hash that still matches its own content.

export interface AnswerContent {
  answer_text: string | null;
  answer_numeric: number | null;
  answer_choices: unknown[];
  matrix_answers: unknown[];
}

export async function hashAnswerLink(
  question_id: string,
  content: AnswerContent,
  previousHash: string | null
): Promise<string> {
  const payload = {
    question_id,
    answer_text: content.answer_text ?? null,
    answer_numeric: content.answer_numeric ?? null,
    answer_choices: content.answer_choices ?? [],
    matrix_answers: content.matrix_answers ?? [],
    previous_hash: previousHash,
  };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashResponseRollup(answerHashes: string[]): Promise<string> {
  const sorted = [...answerHashes].sort();
  const encoded = new TextEncoder().encode(JSON.stringify({ hashes: sorted }));
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
