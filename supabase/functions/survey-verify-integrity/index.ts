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

    const { response_id } = await req.json();

    if (!response_id) {
      return new Response(
        JSON.stringify({ error: "Missing response_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check ownership
    const { data: resp, error: respErr } = await supabase
      .from("survey_responses")
      .select("*, surveys!inner(user_id)")
      .eq("id", response_id)
      .single();

    if (respErr || !resp) {
      return new Response(
        JSON.stringify({ error: "Response not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((resp as any).surveys.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all answers for this response
    const { data: answers } = await supabase
      .from("survey_answers")
      .select("*")
      .eq("response_id", response_id)
      .order("question_id");

    if (!answers || answers.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_answers", answers: [], response_valid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify each answer hash
    const results = await Promise.all(
      answers.map(async (a: any) => {
        const hashPayload = {
          question_id: a.question_id,
          answer_text: a.answer_text,
          answer_numeric: a.answer_numeric,
          answer_choices: a.answer_choices,
          matrix_answers: a.matrix_answers,
        };
        const recalculated = await hashData(hashPayload);
        const storedHash = a.integrity_hash || "";
        const valid = storedHash === "" || recalculated === storedHash;

        return {
          answer_id: a.id,
          question_id: a.question_id,
          version: a.version || 1,
          stored_hash: storedHash,
          recalculated_hash: recalculated,
          valid,
          has_hash: storedHash !== "",
        };
      })
    );

    // Verify response-level hash
    const recalcHashes = results
      .map((r) => r.recalculated_hash)
      .sort();
    const recalcResponseHash = await hashData({ hashes: recalcHashes });
    const storedResponseHash = resp.response_hash || "";
    const responseValid =
      storedResponseHash === "" || recalcResponseHash === storedResponseHash;

    const allValid = results.every((r) => r.valid) && responseValid;

    // Log verification in audit
    await supabase.from("study_audit_log").insert({
      survey_id: resp.survey_id,
      action: allValid ? "integrity_verified" : "integrity_violation",
      actor_id: userId,
      details: {
        response_id,
        all_valid: allValid,
        response_hash_valid: responseValid,
        violations: results.filter((r) => !r.valid).map((r) => r.answer_id),
      },
    });

    return new Response(
      JSON.stringify({
        status: allValid ? "intact" : "violation",
        response_hash_valid: responseValid,
        stored_response_hash: storedResponseHash,
        recalculated_response_hash: recalcResponseHash,
        answers: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("survey-verify-integrity error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
