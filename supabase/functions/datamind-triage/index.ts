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

/** Beyond this the triage is summarising noise, not prioritising findings. */
const MAX_FINDINGS = 25;

interface IncomingFinding {
  key: string;
  kind: string;
  title: string;
  detail: string;
  significant: boolean;
  columns?: string[];
}

/**
 * Deliberately not streamed.
 *
 * `callAI` only writes to ai_usage_log when it can read a complete response body,
 * so a streamed call spends against the per-user ceiling invisibly. This response
 * is short enough that streaming would buy nothing and cost the cost record.
 */
function buildPrompt(): string {
  return `Você prioriza achados estatísticos para um pesquisador.

Os achados abaixo JÁ foram testados por um motor determinístico: o teste foi escolhido por regra a partir dos pressupostos medidos nos dados reais, e todo p-valor já passou por correção de Benjamini-Hochberg (o q). Seu trabalho NÃO é refazer a estatística.

Responda SEMPRE em JSON válido:
{"summary": "<2 a 3 frases sobre o conjunto>", "items": [{"key": "<a key exata do achado>", "headline": "<o achado em uma frase, em linguagem de pesquisador>", "why": "<por que isso importa para a pesquisa, 1 frase>", "caution": "<ressalva, ou string vazia>"}]}

REGRAS:
- NUNCA troque o teste, o p, o q ou o tamanho de efeito. Não recalcule nada. Não invente números que não estejam no achado.
- Devolva os itens em ordem de RELEVÂNCIA PARA A PESQUISA, não de p-valor. Um efeito grande e confirmado vem antes de um pequeno; problemas de qualidade dos dados vêm antes de qualquer resultado calculado sobre eles.
- Um achado marcado como "Pista" (não confirmado após a correção) precisa ser descrito como hipótese a investigar, nunca como resultado. Use palavras como "sugere", "pode indicar".
- Um achado de correlação NÃO é causal. Se a redação natural insinuar causa, escreva a ressalva em "caution".
- Use "key" exatamente como recebida, sem alterar nada. Não crie itens novos nem omita nenhum.
- Escreva em português do Brasil, direto, sem jargão desnecessário e sem adjetivos de entusiasmo.`;
}

function describeFindings(findings: IncomingFinding[]): string {
  return findings
    .map((f, i) => {
      const status = f.kind === "quality"
        ? "PROBLEMA NOS DADOS"
        : f.significant ? "CONFIRMADO após correção" : "PISTA (não confirmado após correção)";
      const columns = f.columns?.length ? ` | colunas: ${f.columns.join(", ")}` : "";
      return `${i + 1}. key: ${f.key}\n   status: ${status}${columns}\n   achado: ${f.title}\n   evidência: ${f.detail}`;
    })
    .join("\n\n");
}

function extractJson(text: string): { summary: string; items: unknown[] } {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { summary: parsed.summary || "", items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    // A truncated reply still carries usable items before the cut.
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) {
      try {
        const parsed = JSON.parse(`${cleaned.slice(0, lastBrace + 1)}]}`);
        return { summary: parsed.summary || "", items: Array.isArray(parsed.items) ? parsed.items : [] };
      } catch { /* give up below */ }
    }
    return { summary: "", items: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { findings, provider, model } = await req.json();
    const list: IncomingFinding[] = Array.isArray(findings) ? findings.slice(0, MAX_FINDINGS) : [];

    if (list.length === 0) {
      return new Response(JSON.stringify({ summary: "", items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await callAI({
      _userId: auth.userId,
      _promptType: "datamind_triage",
      messages: [
        { role: "system", content: buildPrompt() },
        { role: "user", content: `ACHADOS DA VARREDURA:\n\n${describeFindings(list)}\n\nPriorize e explique.` },
      ],
      // The wording may vary; the ordering should not.
      temperature: 0.2,
      ...(provider && model ? { model, _forceProvider: provider } : { model: STRONG_MODEL }),
    } as Record<string, unknown>);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[datamind-triage] AI error:", response.status, errText.slice(0, 300));
      throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json();
    const result = extractJson(data.choices?.[0]?.message?.content || "");

    trackUsage(auth.userId, "datamind_chat").catch((e) =>
      console.error("[datamind-triage] usage tracking error:", e)
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[datamind-triage] error:", err);
    return new Response(JSON.stringify({ summary: "", items: [], error: "Não foi possível interpretar os achados." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
