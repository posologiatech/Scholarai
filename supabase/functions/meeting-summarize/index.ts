import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string" || transcript.length < 20) {
      return new Response(JSON.stringify({ error: "transcript required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const sys = `Você é um secretário acadêmico. A partir da transcrição da reunião, gere em pt-BR um JSON com:
{ "ata": "markdown com seções: Participantes, Pauta, Discussões, Decisões",
  "action_items": [ { "title": "...", "description": "...", "due_date": "YYYY-MM-DD ou null" } ] }
Responda APENAS com o JSON, sem cercas markdown.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: transcript }],
        response_format: { type: "json_object" },
      }),
    });
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
