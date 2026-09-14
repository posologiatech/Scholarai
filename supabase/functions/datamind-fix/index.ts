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

/** Tracebacks can be long; only the tail names the actual failure. */
const MAX_ERROR_CHARS = 2000;

function trimError(error: string): string {
  const text = (error || "").trim();
  return text.length > MAX_ERROR_CHARS ? `...${text.slice(-MAX_ERROR_CHARS)}` : text;
}

function buildPrompt(codeLanguage: string, schemaText: string): string {
  const lang = codeLanguage === "r" ? "R" : "Python";
  return `Você é um depurador de código ${lang} para análise de dados. Um código falhou ao executar e você deve corrigi-lo.

Responda SEMPRE em JSON válido: {"code": "<código corrigido completo>", "note": "<uma frase, em português, dizendo o que estava errado>"}

REGRAS:
- Devolva o código COMPLETO corrigido, não um trecho nem um diff.
- NÃO carregue arquivos: os dataframes JÁ existem no ambiente (ver variáveis abaixo).
- A causa mais comum é nome de coluna errado. Confira cada nome contra a lista de colunas reais abaixo e corrija para o nome exato, respeitando maiúsculas, acentos e espaços.
- Outras causas comuns: tipo errado (texto onde se espera número), valores ausentes não tratados, grupo vazio após filtro, pacote inexistente no ambiente.
- Mantenha a MESMA intenção analítica do código original. Não troque o teste estatístico nem simplifique a análise para "fazer passar".
- Se o erro indicar que a análise é impossível com estes dados (ex: grupo com n=0, variável constante), devolva "code": null e explique em "note" o motivo, em linguagem para pesquisador.
- Não invente dados nem resultados.
${codeLanguage === "r" ? "" : `- Use f-strings, nunca .format().
- Use show_table(df, "título") para tabelas e plt.show() para gráficos.`}

DADOS DISPONÍVEIS:
${schemaText}`;
}

interface CompactColumn {
  name: string;
  type: string;
  missingPct: number;
  role?: string;
  levels?: { value: string; count: number }[];
}

interface FileSchema {
  file_name: string;
  columns: string[];
  rows?: number;
  profile?: { columns: CompactColumn[] };
}

/**
 * Deliberately narrower than the chat prompt's profile rendering: a fixer needs
 * exact column names and types, not distributions and correlations.
 */
function describeSchemasForFix(schemas: FileSchema[]): string {
  if (schemas.length === 0) return "Nenhum arquivo carregado.";

  return schemas
    .map((f, i) => {
      const varName =
        schemas.length === 1
          ? "df"
          : `df_${f.file_name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || `file_${i}`}`;

      const cols = f.profile?.columns?.length
        ? f.profile.columns
            .map((c) => {
              const bits = [c.type];
              if (c.role) bits.push(c.role === "id" ? "identificador" : "constante");
              if (c.missingPct > 0) bits.push(`${c.missingPct}% ausentes`);
              if (c.levels?.length) bits.push(`valores: ${c.levels.map((l) => l.value).join(", ")}`);
              return `  - ${c.name} (${bits.join("; ")})`;
            })
            .join(String.fromCharCode(10))
        : f.columns.map((c) => `  - ${c}`).join(String.fromCharCode(10));

      return `Variável ${varName} (arquivo "${f.file_name}"${f.rows != null ? `, ${f.rows} linhas` : ""}), colunas reais:\n${cols}`;
    })
    .join(String.fromCharCode(10) + String.fromCharCode(10));
}

function extractJson(text: string): { code: string | null; note: string } {
  let cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  if (start !== -1) cleaned = cleaned.slice(start);

  try {
    const parsed = JSON.parse(cleaned);
    return { code: parsed.code ?? null, note: parsed.note || "" };
  } catch {
    // Truncated JSON: retry against the last closing brace before falling back.
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) {
      try {
        const parsed = JSON.parse(cleaned.slice(0, lastBrace + 1));
        return { code: parsed.code ?? null, note: parsed.note || "" };
      } catch { /* fall through to regex */ }
    }
    const codeMatch = cleaned.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    const noteMatch = cleaned.match(/"note"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    const unescape = (v: string) =>
      v.replace(/\\n/g, String.fromCharCode(10)).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    return {
      code: codeMatch ? unescape(codeMatch[1]) : null,
      note: noteMatch ? unescape(noteMatch[1]) : "",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  // No plan-limit check on purpose: this repairs a request the user already spent
  // their quota on, and refusing here would leave them with a broken analysis and
  // nothing to show for the call. Usage is still tracked so the cost is recorded.

  try {
    const { code, error, codeLanguage, schemas, provider, model } = await req.json();

    if (!code || !error) {
      return new Response(JSON.stringify({ code: null, note: "Requisição incompleta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileSchemas: FileSchema[] = Array.isArray(schemas) ? schemas : [];
    const systemPrompt = buildPrompt(codeLanguage, describeSchemasForFix(fileSchemas));

    const userPrompt = `CÓDIGO QUE FALHOU:
\`\`\`
${code}
\`\`\`

ERRO RETORNADO PELA EXECUÇÃO:
\`\`\`
${trimError(error)}
\`\`\`

Corrija o código.`;

    const response = await callAI({
      _userId: auth.userId,
      _promptType: "datamind_fix",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Deterministic: a repair should not wander away from the original intent.
      temperature: 0,
      ...(provider && model
        ? { model, _forceProvider: provider }
        : { model: STRONG_MODEL }),
    } as Record<string, unknown>);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[datamind-fix] AI error:", response.status, errText.slice(0, 300));
      throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const result = extractJson(text);

    trackUsage(auth.userId, "datamind_chat").catch((e) =>
      console.error("[datamind-fix] usage tracking error:", e)
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[datamind-fix] error:", err);
    return new Response(JSON.stringify({ code: null, note: "Não foi possível corrigir o código." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
