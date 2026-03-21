import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashData(data: object): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token, answers, metadata } = await req.json();

    if (!token || !answers) {
      return new Response(
        JSON.stringify({ error: "Missing token or answers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the distribution by anonymous_token
    const { data: dist, error: distErr } = await supabase
      .from("survey_distributions")
      .select("survey_id")
      .eq("anonymous_token", token)
      .eq("type", "anonymous_link")
      .single();

    if (distErr || !dist) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired survey link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check survey is active
    const { data: survey, error: surveyErr } = await supabase
      .from("surveys")
      .select("id, status")
      .eq("id", dist.survey_id)
      .single();

    if (surveyErr || !survey) {
      return new Response(
        JSON.stringify({ error: "Survey not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (survey.status !== "active" && survey.status !== "draft") {
      return new Response(
        JSON.stringify({ error: "Survey is closed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create response (response_hash will be set after answers are inserted)
    const { data: response, error: resErr } = await supabase
      .from("survey_responses")
      .insert({
        survey_id: survey.id,
        respondent_id: metadata?.respondent_id || null,
        status: "complete",
        completed_at: new Date().toISOString(),
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
        duration_seconds: metadata?.duration_seconds || null,
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (resErr) {
      console.error("Failed to create response:", resErr);
      return new Response(
        JSON.stringify({ error: "Failed to save response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build answer rows with integrity hashes
    const answerHashes: string[] = [];
    const answerRows = await Promise.all(
      Object.entries(answers).map(async ([question_id, answer]: [string, any]) => {
        const answerData = {
          answer_text: typeof answer === "string" ? answer : null,
          answer_numeric: typeof answer === "number" ? answer : null,
          answer_choices: Array.isArray(answer) ? answer : typeof answer === "object" && answer !== null ? [] : [],
          matrix_answers: typeof answer === "object" && !Array.isArray(answer) && answer !== null
            ? Object.entries(answer).map(([row_id, col_id]) => ({ row_id, column_id: col_id }))
            : [],
        };

        // Generate SHA-256 hash of the answer content
        const hashPayload = { question_id, ...answerData };
        const integrity_hash = await hashData(hashPayload);
        answerHashes.push(integrity_hash);

        return {
          response_id: response.id,
          question_id,
          ...answerData,
          integrity_hash,
          version: 1,
          last_modified_at: new Date().toISOString(),
        };
      })
    );

    if (answerRows.length > 0) {
      const { error: ansErr } = await supabase.from("survey_answers").insert(answerRows);
      if (ansErr) {
        console.error("Failed to insert answers:", ansErr);
      }
    }

    // Calculate chained response hash from all answer hashes
    const sortedHashes = answerHashes.sort();
    const responseHash = await hashData({ hashes: sortedHashes });

    // Update the response with the chained hash
    await supabase
      .from("survey_responses")
      .update({ response_hash: responseHash })
      .eq("id", response.id);

    return new Response(
      JSON.stringify({ success: true, response_id: response.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("survey-respond error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
