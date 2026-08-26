import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BYTES = 20 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const form = await req.formData();
    const token = form.get("token");
    const file = form.get("file");

    if (!token || typeof token !== "string" || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "Missing token or file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (file.size > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "File too large (max 20MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Same anonymous_token → active-survey lookup as survey-respond, so an upload can never
    // land against a draft/closed survey or a made-up token.
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

    const { data: survey, error: surveyErr } = await supabase
      .from("surveys")
      .select("id, status")
      .eq("id", dist.survey_id)
      .single();

    if (surveyErr || !survey || survey.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Survey is not accepting uploads" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeName = file.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${survey.id}/${crypto.randomUUID()}-${safeName}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from("survey-uploads")
      .upload(path, bytes, { contentType: file.type || "application/octet-stream" });

    if (uploadErr) {
      console.error("Failed to upload survey file:", uploadErr);
      return new Response(
        JSON.stringify({ error: "Failed to upload file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("survey-upload error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
