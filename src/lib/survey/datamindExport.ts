import { supabase } from "@/integrations/supabase/client";
import { linkResource, registerOutput } from "@/lib/research/integrations";
import { buildExportColumns, buildChoiceCodingMap, formatCodedValue, buildCodebookText } from "./codebook";

export interface ExportSurveyToDataMindInput {
  surveyId: string;
  surveyTitle: string;
  researchProjectId: string | null;
  userId: string;
  locale: "pt" | "en";
}

export interface ExportSurveyToDataMindResult {
  conversationId: string;
}

/**
 * Sends a survey's collected data to DataMind as a new, ready-to-analyze conversation:
 * a coded (numeric) CSV + a codebook message, optionally linked to the survey's research project.
 * Throws "NO_DATA" if the survey has no questions or no responses yet.
 */
export async function exportSurveyToDataMind(
  input: ExportSurveyToDataMindInput,
): Promise<ExportSurveyToDataMindResult> {
  const { surveyId, surveyTitle, researchProjectId, userId, locale } = input;

  const [questionsRes, responsesRes] = await Promise.all([
    supabase.from("survey_questions").select("*").eq("survey_id", surveyId).order("question_order"),
    supabase.from("survey_responses").select("*").eq("survey_id", surveyId),
  ]);
  const questions = questionsRes.data || [];
  const responses = responsesRes.data || [];
  if (!questions.length || !responses.length) throw new Error("NO_DATA");

  const responseIds = responses.map((r) => r.id);
  const { data: answersData } = await supabase.from("survey_answers").select("*").in("response_id", responseIds);
  const answers = answersData || [];

  const columns = buildExportColumns(questions);
  const codingMap = buildChoiceCodingMap(questions);

  const headers = ["respondent_id", ...columns.map((c) => c.varName)];
  const rows = responses.map((r) => {
    const responseAnswers = answers.filter((a) => a.response_id === r.id);
    const vals = columns.map((c) => {
      const ans = responseAnswers.find((a) => a.question_id === c.id);
      if (!ans) return "";
      let val = "";
      if (ans.answer_text) val = ans.answer_text;
      else if (ans.answer_numeric !== null) val = String(ans.answer_numeric);
      else if (Array.isArray(ans.answer_choices) && ans.answer_choices.length)
        val = (ans.answer_choices as string[]).join("; ");
      else if (Array.isArray(ans.matrix_answers) && ans.matrix_answers.length)
        val = (ans.matrix_answers as { row_id: string; column_id: string }[]).map((m) => `${m.row_id}:${m.column_id}`).join("; ");
      return formatCodedValue(val, c.id, codingMap);
    });
    const escape = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v);
    return [escape(r.respondent_id || r.id), ...vals.map(escape)].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });

  const fileName = `survey_${surveyId}_${Date.now()}.csv`;
  const filePath = `${userId}/${fileName}`;
  const { error: uploadErr } = await supabase.storage.from("datamind-files").upload(filePath, blob);
  if (uploadErr) throw uploadErr;

  const timestamp = new Date().toLocaleString(locale === "pt" ? "pt-BR" : "en-US");
  const title = locale === "pt"
    ? `Análise de Coleta — ${surveyTitle} (${timestamp})`
    : `Survey Analysis — ${surveyTitle} (${timestamp})`;

  const { data: conv, error: convErr } = await supabase
    .from("datamind_conversations")
    .insert({ user_id: userId, title, research_project_id: researchProjectId ?? null })
    .select("id")
    .single();
  if (convErr) throw convErr;

  await supabase.from("datamind_files").insert({
    user_id: userId,
    conversation_id: conv.id,
    file_name: fileName,
    file_path: filePath,
    file_size: blob.size,
  });

  const codebookText = buildCodebookText(columns, questions, codingMap, locale);
  const summary = locale === "pt"
    ? `Dados da coleta carregados: ${fileName} (${responses.length} respostas, ${questions.length} perguntas). Pronto para análise.`
    : `Survey data file loaded: ${fileName} (${responses.length} responses, ${questions.length} questions). Ready for analysis.`;
  await supabase.from("datamind_messages").insert({
    conversation_id: conv.id,
    role: "system",
    content: `${summary}\n\n${codebookText}`,
  });

  if (researchProjectId) {
    await linkResource({
      projectId: researchProjectId,
      resourceType: "datamind",
      resourceId: conv.id,
      label: title,
    });
    await registerOutput(researchProjectId, {
      title,
      type: "dataset",
      description: locale === "pt"
        ? `${responses.length} respostas / ${questions.length} perguntas`
        : `${responses.length} responses / ${questions.length} questions`,
      url: `/datamind/${conv.id}`,
    });
  }

  return { conversationId: conv.id };
}
