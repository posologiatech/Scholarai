import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'code and redirect_uri required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('ORCID_CLIENT_ID')!;
    const clientSecret = Deno.env.get('ORCID_CLIENT_SECRET')!;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange code for token
    const tokenRes = await fetch('https://orcid.org/oauth/token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    });

    const token = await tokenRes.json();
    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: 'ORCID token exchange failed', detail: token }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expires_at = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
      : null;

    const { error: upsertErr } = await supabase
      .from('orcid_connections')
      .upsert({
        user_id: user.id,
        orcid_id: token.orcid,
        name: token.name ?? null,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        scope: token.scope ?? null,
        expires_at,
      }, { onConflict: 'user_id' });

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({
      ok: true, orcid_id: token.orcid, name: token.name ?? null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
