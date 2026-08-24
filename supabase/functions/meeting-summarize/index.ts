import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;
  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string" || transcript.length < 20) {
      return new Response(JSON.stringify({ error: "transcript required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sys = `Você é um secretário acadêmico. A partir da transcrição da reunião, gere em pt-BR um JSON com:
{ "ata": "markdown com seções: Participantes, Pauta, Discussões, Decisões",
  "action_items": [ { "title": "...", "description": "...", "due_date": "YYYY-MM-DD ou null" } ] }
Responda APENAS com o JSON, sem cercas markdown.`;
    const res = await callAI({
      _userId: auth.userId,
      _promptType: "meeting_summarize",
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: transcript }],
      response_format: { type: "json_object" },
    } as any);
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: t }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data.choices[0].message.content); } catch { parsed = { ata: data.choices[0].message.content, action_items: [] }; }
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
