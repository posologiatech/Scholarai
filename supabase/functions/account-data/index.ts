import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
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
    const user = userData.user;

    const { action, confirm } = await req.json().catch(() => ({}));

    if (action === "export") {
      const { data, error } = await supabaseAdmin.rpc("export_user_data", { target_user_id: user.id });
      if (error) throw error;
      return json({
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, created_at: user.created_at },
        data,
      });
    }

    if (action === "delete") {
      if (confirm !== "DELETE") {
        return json({ error: "Confirmation text does not match" }, 400);
      }

      // Block deletion while a paid subscription is still active — cancelling
      // it is a separate, reversible step the user should take deliberately
      // via the billing portal before the irreversible account erasure.
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (sub && sub.plan !== "free" && sub.status === "active") {
        return json(
          { error: "active_subscription", message: "Cancel your subscription before deleting your account." },
          409
        );
      }

      const { data: report, error: deleteErr } = await supabaseAdmin.rpc("delete_user_account_data", {
        target_user_id: user.id,
      });
      if (deleteErr) throw deleteErr;

      const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (authDeleteErr) throw authDeleteErr;

      return json({ success: true, report });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("account-data error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
