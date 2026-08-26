import { supabase } from "@/integrations/supabase/client";

export type VersionTrigger = "manual" | "publish" | "close" | "pre_restore";

export interface SurveyVersion {
  id: string;
  survey_id: string;
  created_at: string;
  created_by: string | null;
  label: string | null;
  trigger_type: VersionTrigger;
  snapshot: {
    survey: { title: string; description: string | null; settings: Record<string, any> };
    blocks: any[];
    questions: any[];
    logic_rules: any[];
  };
}

/**
 * Snapshots a survey's current DB state (not the possibly-unsaved local builder store) into
 * survey_versions. Callers that just changed the local store must save() first — see
 * SurveyBuilder.tsx's manual "Salvar versão" action and its publish/close hook.
 */
export async function createSurveyVersion(
  surveyId: string,
  trigger: VersionTrigger,
  label?: string
): Promise<void> {
  const [surveyRes, blocksRes, questionsRes, rulesRes] = await Promise.all([
    supabase.from("surveys").select("title, description, settings").eq("id", surveyId).single(),
    supabase.from("survey_blocks").select("*").eq("survey_id", surveyId).order("block_order"),
    supabase.from("survey_questions").select("*").eq("survey_id", surveyId).order("question_order"),
    supabase.from("survey_logic_rules").select("*").eq("survey_id", surveyId).order("rule_order"),
  ]);
  if (surveyRes.error) throw surveyRes.error;

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("survey_versions").insert({
    survey_id: surveyId,
    created_by: user?.id ?? null,
    label: label || null,
    trigger_type: trigger,
    snapshot: {
      survey: surveyRes.data,
      blocks: blocksRes.data || [],
      questions: questionsRes.data || [],
      logic_rules: rulesRes.data || [],
    },
  });
  if (error) throw error;
}

export async function listSurveyVersions(surveyId: string): Promise<SurveyVersion[]> {
  const { data, error } = await supabase
    .from("survey_versions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as SurveyVersion[];
}

export interface RestoreResult {
  deleted_blocks: number;
  deleted_questions: number;
  kept_protected_questions: number;
}

export async function restoreSurveyVersion(versionId: string): Promise<RestoreResult> {
  const { data, error } = await supabase.rpc("restore_survey_version", { _version_id: versionId });
  if (error) throw error;
  return data as unknown as RestoreResult;
}
