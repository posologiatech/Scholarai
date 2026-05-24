import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id, project_title, messages, locale } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const sys = locale === "en"
      ? `You are a senior research advisor brainstorming with a PI on the project "${project_title}". Suggest novel derivations, hypotheses, methods, follow-up experiments and identify gaps. Be concrete, cite evidence-based reasoning. Use markdown.`
      : `Você é um pesquisador sênior em brainstorm com o PI no projeto "${project_title}". Sugira derivações inéditas, hipóteses, métodos, experimentos derivados e identifique lacunas. Seja concreto e baseado em evidências. Use markdown.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: t }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    return new Response(JSON.stringify({ reply: data.choices[0].message.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
