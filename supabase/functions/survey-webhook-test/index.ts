import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendSurveyWebhook } from "../_shared/survey-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);

    const { surveyId, url, secret } = await req.json().catch(() => ({}));
    if (!surveyId || !url) return json({ error: "Missing surveyId or url" }, 400);

    // Service role bypasses RLS, so ownership has to be checked by hand — a test send should
    // only be triggerable by someone who can actually see/edit this survey's settings.
    const { data: survey, error: surveyErr } = await supabaseAdmin
      .from("surveys")
      .select("id, user_id, workspace_id")
      .eq("id", surveyId)
      .single();
    if (surveyErr || !survey) return json({ error: "Survey not found" }, 404);

    let authorized = survey.user_id === userData.user.id;
    if (!authorized && survey.workspace_id) {
      const { data: isMember } = await supabaseAdmin.rpc("is_workspace_member", {
        _user_id: userData.user.id,
        _workspace_id: survey.workspace_id,
      });
      authorized = !!isMember;
    }
    if (!authorized) return json({ error: "Not authorized for this survey" }, 403);

    const result = await sendSurveyWebhook(
      { enabled: true, url, secret },
      {
        event: "survey.webhook.test",
        survey_id: surveyId,
        sent_at: new Date().toISOString(),
      }
    );

    return json(result);
  } catch (err) {
    console.error("survey-webhook-test error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
