// Called from GitHub Actions (.github/workflows/system-update-log.yml) after every
// push to main that touches src/** or supabase/**. Reads the commits/diff for that
// push, asks the AI whether it's a user-facing change worth announcing, and if so
// writes a dated entry to system_changelog — the same table /changelog and /docs
// (Novidades) and the Oráculo bot (recent-updates injection) all read from.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ci-secret",
};

interface CommitInfo {
  sha: string;
  message: string;
}

const SYSTEM_PROMPT = `Você é um redator técnico que transforma commits de código em uma entrada de changelog para usuários finais de uma plataforma acadêmica (ScholarAI).

REGRAS:
1. Analise os commits e o diff fornecidos. Decida se representam uma mudança PERCEPTÍVEL para o usuário final (nova funcionalidade, melhoria visível, correção de bug relevante, nova integração).
2. Se forem apenas mudanças internas SEM impacto perceptível (dependências, formatação, refactor interno, CI/build, comentários, testes, correções de erro de digitação em código), marque significant como false.
3. Se significant for true, escreva title (curto, até 60 caracteres) e description (1-2 frases, em português claro, sem jargão técnico como "refactor", "commit", "PR" — fale do que o usuário ganha/vê) em português brasileiro.
4. category deve ser uma de: "feature" (nova funcionalidade), "improvement" (melhoria), "bugfix" (correção), "integration" (integração externa).
5. module deve ser um nome curto e minúsculo do módulo afetado (ex: "busca", "datamind", "surveys", "pesquisa", "sistema", "admin") ou null se abrangente/indefinido.
6. priority deve ser "low", "medium" ou "high".

Responda APENAS em JSON: {"significant": boolean, "title": string, "description": string, "category": string, "module": string|null, "priority": string}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ciSecret = Deno.env.get("CI_UPDATE_SECRET");
  const providedSecret = req.headers.get("x-ci-secret");
  if (!ciSecret || providedSecret !== ciSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { commits, diffStat, diff } = (await req.json()) as {
      commits: CommitInfo[];
      diffStat?: string;
      diff?: string;
    };

    if (!commits || !Array.isArray(commits) || commits.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no commits" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const commitLines = commits.slice(0, 30).map((c) => `- ${c.sha?.slice(0, 7) ?? ""} ${c.message}`).join("\n");
    const userContent = [
      `COMMITS:\n${commitLines}`,
      diffStat ? `\nRESUMO DO DIFF:\n${diffStat.slice(0, 4000)}` : "",
      diff ? `\nDIFF (parcial):\n${diff.slice(0, 12000)}` : "",
    ].filter(Boolean).join("\n");

    const aiResponse = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    } as any);

    if (!aiResponse.ok) {
      const t = await aiResponse.text();
      console.error("log-system-update AI error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content: string = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!parsed.significant) {
      return new Response(JSON.stringify({ skipped: true, reason: "not significant" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("system_changelog")
      .insert({
        title: parsed.title,
        description: parsed.description,
        category: parsed.category || "improvement",
        status: "released",
        priority: parsed.priority || "medium",
        module: parsed.module || null,
        released_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("log-system-update insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ inserted: true, id: data.id, title: parsed.title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("log-system-update error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
