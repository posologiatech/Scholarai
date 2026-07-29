import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashAnswerLink, hashResponseRollup } from "../_shared/survey-integrity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { answer_id, new_value, change_reason } = await req.json();

    if (!answer_id || !new_value || !change_reason) {
      return new Response(
        JSON.stringify({ error: "Missing answer_id, new_value, or change_reason" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current answer
    const { data: answer, error: ansErr } = await supabase
      .from("survey_answers")
      .select("*, survey_responses!inner(survey_id, id)")
      .eq("id", answer_id)
      .single();

    if (ansErr || !answer) {
      return new Response(
        JSON.stringify({ error: "Answer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user owns the survey
    const surveyId = (answer as any).survey_responses.survey_id;
    const responseId = (answer as any).survey_responses.id;

    const { data: survey } = await supabase
      .from("surveys")
      .select("user_id")
      .eq("id", surveyId)
      .single();

    if (!survey || survey.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: you do not own this survey" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save snapshot to audit table
    const previousValue = {
      answer_text: answer.answer_text,
      answer_numeric: answer.answer_numeric,
      answer_choices: answer.answer_choices,
      matrix_answers: answer.matrix_answers,
    };

    const previousHash = answer.integrity_hash || null;

    // Chain the new hash onto the previous one — this is the actual tamper-evidence
    // mechanism. An edit made any other way (direct DB write, replayed/edited audit row)
    // won't reproduce this link, so survey-verify-integrity's chain walk will catch it.
    const newAnswerContent = {
      answer_text: new_value.answer_text ?? null,
      answer_numeric: new_value.answer_numeric ?? null,
      answer_choices: new_value.answer_choices ?? [],
      matrix_answers: new_value.matrix_answers ?? [],
    };
    const newHash = await hashAnswerLink(answer.question_id, newAnswerContent, previousHash);

    // Insert audit record
    await supabase.from("survey_answer_audit").insert({
      answer_id,
      previous_value: previousValue,
      new_value,
      previous_hash: previousHash,
      new_hash: newHash,
      changed_by: userId,
      change_reason,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
    });

    // Update the answer
    const newVersion = (answer.version || 1) + 1;
    await supabase
      .from("survey_answers")
      .update({
        answer_text: new_value.answer_text ?? null,
        answer_numeric: new_value.answer_numeric ?? null,
        answer_choices: new_value.answer_choices ?? [],
        matrix_answers: new_value.matrix_answers ?? [],
        integrity_hash: newHash,
        version: newVersion,
        last_modified_at: new Date().toISOString(),
        last_modified_by: userId,
      })
      .eq("id", answer_id);

    // Recalculate response hash
    const { data: allAnswers } = await supabase
      .from("survey_answers")
      .select("integrity_hash")
      .eq("response_id", responseId)
      .order("question_id");

    if (allAnswers) {
      const hashes = allAnswers.map((a: any) => a.integrity_hash || "").filter(Boolean);
      const responseHash = await hashResponseRollup(hashes);
      await supabase
        .from("survey_responses")
        .update({ response_hash: responseHash })
        .eq("id", responseId);
    }

    // Register in study_audit_log
    await supabase.from("study_audit_log").insert({
      survey_id: surveyId,
      action: "answer_modified",
      actor_id: userId,
      ip_address: req.headers.get("x-forwarded-for") || null,
      details: {
        answer_id,
        question_id: answer.question_id,
        previous_value: previousValue,
        new_value,
        version: newVersion,
        change_reason,
      },
    });

    return new Response(
      JSON.stringify({ success: true, version: newVersion, integrity_hash: newHash }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("survey-edit-answer error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
