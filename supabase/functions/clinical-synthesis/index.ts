import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { participantId, surveyId } = await req.json();
    if (!participantId || !surveyId) throw new Error("participantId and surveyId are required");

    // Fetch participant
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: participant } = await serviceClient
      .from("study_participants")
      .select("*")
      .eq("id", participantId)
      .eq("user_id", user.id)
      .single();

    if (!participant) throw new Error("Participant not found");

    // Fetch questions
    const { data: questions } = await serviceClient
      .from("survey_questions")
      .select("*")
      .eq("survey_id", surveyId)
      .order("question_order");

    // Fetch visits
    const { data: visits } = await serviceClient
      .from("study_visits")
      .select("*")
      .eq("survey_id", surveyId)
      .order("visit_order");

    // Fetch responses for this survey
    const { data: responses } = await serviceClient
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId);

    // Fetch answers
    const responseIds = responses?.map(r => r.id) || [];
    let answers: any[] = [];
    if (responseIds.length) {
      const { data } = await serviceClient
        .from("survey_answers")
        .select("*")
        .in("response_id", responseIds);
      answers = data || [];
    }

    // Build data summary for the AI
    const questionMap = new Map((questions || []).map((q: any) => [q.id, q]));
    const dataSummary = (responses || []).map((r: any) => {
      const rAnswers = answers.filter(a => a.response_id === r.id);
      const qas = rAnswers.map(a => {
        const q = questionMap.get(a.question_id);
        const qText = q?.question_text || "Unknown";
        let val = a.answer_text || "";
        if (a.answer_numeric !== null) val = String(a.answer_numeric);
        if (Array.isArray(a.answer_choices) && a.answer_choices.length) val = a.answer_choices.join(", ");
        const rules = q?.validation_rules as any;
        const unit = rules?.unit || "";
        return `- ${qText}: ${val}${unit ? ` ${unit}` : ""}`;
      });
      return `### Resposta (${r.status}, ${new Date(r.started_at).toLocaleDateString()})\n${qas.join("\n")}`;
    }).join("\n\n");

    const visitLabels = (visits || []).map((v: any) => `T${v.visit_order}: ${v.label}`).join(", ");

    const systemPrompt = `Você é um assistente médico-científico especializado em pesquisa clínica. 
Sua tarefa é gerar uma síntese clínica descritiva do caso de um participante de pesquisa, com base nos dados coletados.

Gere um texto em formato de evolução clínica / sumário de caso contendo:
1. Dados demográficos e antecedentes relevantes
2. Achados clínicos por visita/timepoint
3. Resultados de exames relevantes
4. Evolução temporal do caso
5. Observações importantes ou discrepâncias

Use linguagem técnica médica apropriada. Seja objetivo e baseado nos dados.
Se dados estiverem faltando, mencione como "sem registro" ou "dado não coletado".`;

    const userPrompt = `Participante: ${participant.participant_code}
Status: ${participant.status}
Visitas configuradas: ${visitLabels || "Nenhuma"}
Metadados: ${JSON.stringify(participant.metadata || {})}

--- DADOS COLETADOS ---
${dataSummary || "Nenhum dado coletado ainda."}

Gere a síntese clínica deste participante.`;

    const aiResponse = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      _userId: user.id,
      _promptType: "clinical-synthesis",
    } as any);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      throw new Error("AI synthesis failed");
    }

    const aiData = await aiResponse.json();
    const synthesis = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a síntese.";

    return new Response(JSON.stringify({ synthesis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("clinical-synthesis error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
