import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;
  try {
    const { project_id, project_title, messages, locale } = await req.json();
    const sys = locale === "en"
      ? `You are a senior research advisor brainstorming with a PI on the project "${project_title}". Suggest novel derivations, hypotheses, methods, follow-up experiments and identify gaps. Be concrete, cite evidence-based reasoning. Use markdown.`
      : `Você é um pesquisador sênior em brainstorm com o PI no projeto "${project_title}". Sugira derivações inéditas, hipóteses, métodos, experimentos derivados e identifique lacunas. Seja concreto e baseado em evidências. Use markdown.`;
    const res = await callAI({
      _userId: auth.userId,
      _promptType: "research_brainstorm",
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, ...messages],
    } as any);
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
