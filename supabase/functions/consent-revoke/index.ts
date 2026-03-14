import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signatureId, action, reason } = await req.json();

    if (!signatureId) {
      return new Response(
        JSON.stringify({ error: "signatureId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the signature
    const { data: sig, error: sigErr } = await supabaseAdmin
      .from("consent_signatures")
      .select("id, respondent_name, revoked_at, consent_id")
      .eq("id", signatureId)
      .single();

    if (sigErr || !sig) {
      return new Response(
        JSON.stringify({ error: "Signature not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK action — just return status
    if (action === "check") {
      return new Response(
        JSON.stringify({
          participantName: sig.respondent_name,
          alreadyRevoked: !!sig.revoked_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REVOKE action
    if (action === "revoke") {
      if (sig.revoked_at) {
        return new Response(
          JSON.stringify({ error: "Already revoked", alreadyRevoked: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ipAddress =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";

      // Mark as revoked
      await supabaseAdmin
        .from("consent_signatures")
        .update({
          revoked_at: new Date().toISOString(),
          revocation_reason: reason || "Solicitação do participante via link de auto-revogação",
        })
        .eq("id", signatureId);

      // Get consent -> survey_id to update participant and audit
      const { data: consentData } = await supabaseAdmin
        .from("study_consents")
        .select("survey_id")
        .eq("id", sig.consent_id)
        .single();

      const surveyId = consentData?.survey_id;

      if (surveyId) {
        // Update participant status to withdrawn
        await supabaseAdmin
          .from("study_participants")
          .update({ status: "withdrawn" })
          .eq("consent_signature_id", signatureId);

        // Audit log
        await supabaseAdmin.from("study_audit_log").insert({
          survey_id: surveyId,
          action: "consent_self_revoked",
          details: {
            signature_id: signatureId,
            respondent_name: sig.respondent_name,
            reason: reason || "Auto-revogação pelo participante",
            method: "self_service_link",
          },
          ip_address: ipAddress,
        });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("consent-revoke error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
