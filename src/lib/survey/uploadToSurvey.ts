export const SURVEY_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Uploads a respondent-provided file (or signature blob) via the survey-upload edge function,
 * which re-validates the anonymous_token and the survey's active status server-side before
 * writing to the private `survey-uploads` bucket — mirrors how survey-respond gates submissions,
 * see supabase/functions/survey-upload/index.ts. Returns the storage path to store as the answer.
 */
export async function uploadSurveyFile(token: string, file: File | Blob, fileName?: string): Promise<string> {
  if (file.size > SURVEY_UPLOAD_MAX_BYTES) {
    throw new Error("Arquivo muito grande (máx. 20MB)");
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/survey-upload`;

  const form = new FormData();
  form.append("token", token);
  form.append("file", file, fileName || (file instanceof File ? file.name : "upload"));

  const res = await fetch(url, { method: "POST", body: form });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Falha no envio do arquivo");
  return result.path as string;
}
