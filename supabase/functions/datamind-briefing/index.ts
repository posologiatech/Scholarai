import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";
import { trackUsage } from "../_shared/usage-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Resolved per provider by ai-caller to that provider's strongest model. */
const STRONG_MODEL = "gemini-2.5-pro";

/** The facts are already compact; anything longer is a client bug, not a dataset. */
const MAX_FACTS_CHARS = 12000;

/**
 * Deliberately not streamed, for the same reason as datamind-triage: `callAI`
 * only writes to ai_usage_log when it can read a complete response body, so a
 * streamed call spends against the per-user ceiling invisibly. The briefing is a
 * few paragraphs — streaming would buy nothing and cost the cost record.
 */
function buildPrompt(): string {
  return `Você escreve o briefing inicial de um conjunto de dados para um pesquisador.

Você recebe FATOS já apurados: o perfil do arquivo (calculado na ingestão) e os achados de uma varredura estatística determinística, em que o teste foi escolhido por regra a partir dos pressupostos medidos nos dados reais e os p-valores já passaram por correção de Benjamini-Hochberg (o q). Seu trabalho é redigir, não medir.

REGRAS:
- Não invente nenhum número. Use apenas os valores que aparecem nos fatos, exatamente como estão.
- Não calcule nada, não estime nada, não sugira que um resultado é maior ou menor do que os fatos dizem.
- Um achado marcado como "Pista" (não confirmado após a correção) só pode ser descrito como hipótese a investigar. Use "sugere", "pode indicar". Nunca como resultado.
- Correlação não é causa. Se a frase natural insinuar causa, escreva a ressalva.
- Problemas de qualidade dos dados vêm antes de qualquer resultado calculado sobre eles.
- Português do Brasil, direto, sem entusiasmo e sem jargão desnecessário.

FORMATO: 3 a 5 parágrafos curtos em texto corrido, sem títulos, sem listas e sem markdown. O primeiro parágrafo diz o que é o arquivo e seu tamanho; depois os cuidados; depois o que já foi encontrado; por fim, por onde começar.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { facts, fileName, provider, model } = await req.json();
    const text = typeof facts === "string" ? facts.slice(0, MAX_FACTS_CHARS) : "";

    if (!text.trim()) {
      return new Response(JSON.stringify({ text: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await callAI({
      _userId: auth.userId,
      _promptType: "datamind_briefing",
      messages: [
        { role: "system", content: buildPrompt() },
        {
          role: "user",
          content: `FATOS APURADOS${fileName ? ` SOBRE "${fileName}"` : ""}:\n\n${text}\n\nEscreva o briefing.`,
        },
      ],
      // The wording may vary; the facts behind it must not.
      temperature: 0.2,
      ...(provider && model ? { model, _forceProvider: provider } : { model: STRONG_MODEL }),
    } as Record<string, unknown>);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[datamind-briefing] AI error:", response.status, errText.slice(0, 300));
      throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json();
    const written = (data.choices?.[0]?.message?.content || "").trim();

    trackUsage(auth.userId, "datamind_chat").catch((e) =>
      console.error("[datamind-briefing] usage tracking error:", e)
    );

    return new Response(JSON.stringify({ text: written }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[datamind-briefing] error:", err);
    return new Response(JSON.stringify({ text: "", error: "Não foi possível redigir o briefing." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
