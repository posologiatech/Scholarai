import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { callAI, callEmbeddings } from "../_shared/ai-caller.ts";

type Section =
  | "introducao" | "objetivos" | "metodologia" | "fases"
  | "resultados_esperados" | "cronograma_textual" | "referencial_teorico"
  | "discussao" | "completo";

const SECTION_META: Record<Section, { title: string; query: string; instructions: string }> = {
  introducao: {
    title: "Introdução",
    query: "contexto, motivação, justificativa, problema de pesquisa, lacunas, importância",
    instructions: "Escreva a INTRODUÇÃO acadêmica (3–6 parágrafos): contextualize o tema, mostre o estado da arte com base nos trechos da biblioteca, evidencie a lacuna que o projeto preenche e termine com a pergunta de pesquisa.",
  },
  objetivos: {
    title: "Objetivos",
    query: "objetivos gerais específicos hipóteses",
    instructions: "Estruture os OBJETIVOS em 'Objetivo Geral' (1 parágrafo) e 'Objetivos Específicos' (3–6 bullets verbais começando com infinitivo).",
  },
  referencial_teorico: {
    title: "Referencial Teórico",
    query: "fundamentação teórica conceitos definições autores principais",
    instructions: "Escreva o REFERENCIAL TEÓRICO (4–8 parágrafos) baseando-se EXCLUSIVAMENTE nos trechos fornecidos da biblioteca. Cite inline como [Ref N].",
  },
  metodologia: {
    title: "Metodologia",
    query: "desenho do estudo amostra coleta análise instrumentos protocolo",
    instructions: "Detalhe a METODOLOGIA: tipo de estudo, população/amostra, instrumentos, procedimentos, análise estatística, aspectos éticos. Use subseções com ## .",
  },
  fases: {
    title: "Fases do Projeto",
    query: "etapas fases cronograma execução",
    instructions: "Liste as FASES DO PROJETO de forma numerada com 4–7 fases, cada uma com 1–2 frases de descrição.",
  },
  resultados_esperados: {
    title: "Resultados Esperados",
    query: "resultados esperados impactos contribuições produtos",
    instructions: "Descreva os RESULTADOS ESPERADOS em 2–4 parágrafos: produtos científicos, impactos teóricos e práticos, contribuições para a área.",
  },
  cronograma_textual: {
    title: "Cronograma",
    query: "cronograma prazos fases",
    instructions: "Descreva o CRONOGRAMA textualmente, com base nos itens reais do cronograma do projeto (se houver). Use uma tabela markdown | Fase | Período | Atividades |.",
  },
  discussao: {
    title: "Discussão preliminar",
    query: "discussão limitações implicações",
    instructions: "Esboce a DISCUSSÃO preliminar: possíveis interpretações dos resultados esperados, limitações antecipadas, implicações para futuras pesquisas.",
  },
  completo: {
    title: "Texto completo do projeto",
    query: "projeto completo introdução metodologia resultados",
    instructions: "Gere o TEXTO COMPLETO do projeto com as seções: Introdução, Objetivos (Geral e Específicos), Referencial Teórico, Metodologia, Fases do Projeto, Resultados Esperados, Cronograma e Referências citadas. Use headings markdown #, ## .",
  },
};

function clip(s: string | null | undefined, max = 600): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if ("error" in auth) return auth.error;
    const { supabase } = auth;

    const { project_id, section, extra_instructions } = await req.json() as {
      project_id: string; section: Section; extra_instructions?: string;
    };
    if (!project_id || !section || !SECTION_META[section]) {
      return new Response(JSON.stringify({ error: "project_id and valid section required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = SECTION_META[section];

    // Gather project context
    const [{ data: project }, { data: refs }, { data: schedule }] = await Promise.all([
      supabase.from("research_projects").select("*").eq("id", project_id).single(),
      supabase.from("research_project_references").select("title,authors,year,doi,external_paper_id").eq("project_id", project_id).limit(60),
      supabase.from("research_schedule_items").select("title,phase,start_date,end_date,is_milestone").eq("project_id", project_id).order("start_date", { nullsFirst: false }),
    ]);

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found or no access" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RAG over linked library
    let ragBlock = "";
    const refCitations: { n: number; title: string; doi: string | null; year: number | null }[] = [];
    const linkedPapers = (refs ?? []).filter((r: any) => r.external_paper_id);
    if (linkedPapers.length > 0) {
      try {
        const emb = await callEmbeddings(
          `${project.title}. ${project.description ?? ""}. ${project.objectives ?? ""}. ${meta.query}`,
        );
        if (emb.ok) {
          const ej = await emb.json();
          const qv = ej.data?.[0]?.embedding;
          if (Array.isArray(qv)) {
            const { data: chunks } = await supabase.rpc("match_project_paper_chunks", {
              query_embedding: qv as any, _project_id: project_id, match_count: 10, match_threshold: 0.3,
            });
            if (chunks && chunks.length) {
              const lines = ["\n## TRECHOS DA BIBLIOTECA (use como base e cite como [Ref N])"];
              const seen = new Map<string, number>();
              chunks.forEach((c: any) => {
                let n = seen.get(c.paper_id);
                if (!n) {
                  n = seen.size + 1;
                  seen.set(c.paper_id, n);
                  const meta = linkedPapers.find((r: any) => r.external_paper_id === c.paper_id);
                  refCitations.push({
                    n,
                    title: c.paper_title || meta?.title || "Sem título",
                    doi: meta?.doi ?? null,
                    year: meta?.year ?? null,
                  });
                }
                lines.push(`\n[Ref ${n}: ${clip(c.paper_title, 140)}]\n${clip(c.chunk_text, 800)}`);
              });
              ragBlock = lines.join("\n");
            }
          }
        }
      } catch (e) { console.error("RAG failed:", e); }
    }

    const ctxLines: string[] = [];
    ctxLines.push(`# PROJETO: ${project.title}`);
    if (project.description) ctxLines.push(`Resumo: ${clip(project.description, 1000)}`);
    if (project.objectives) ctxLines.push(`Objetivos atuais: ${clip(project.objectives, 1000)}`);
    if (project.cnpq_area) ctxLines.push(`Área CNPq: ${project.cnpq_area}`);
    if (project.keywords?.length) ctxLines.push(`Palavras-chave: ${project.keywords.join(", ")}`);
    if (project.full_content) ctxLines.push(`\n## TEXTO ATUAL DO PROJETO (use como base, melhore, NÃO duplique)\n${clip(project.full_content, 4000)}`);
    if (schedule?.length) {
      ctxLines.push(`\n## CRONOGRAMA`);
      schedule.forEach((s: any) => ctxLines.push(`- ${s.title}${s.phase ? " (" + s.phase + ")" : ""} ${s.start_date ?? ""} → ${s.end_date ?? ""}${s.is_milestone ? " [MARCO]" : ""}`));
    }
    if (refs?.length) {
      ctxLines.push(`\n## REFERÊNCIAS REGISTRADAS (${refs.length})`);
      refs.slice(0, 30).forEach((r: any) => {
        const authors = Array.isArray(r.authors) ? r.authors.slice(0, 3).map((a: any) => a.name ?? a).join(", ") : "";
        ctxLines.push(`- ${r.title} (${authors}${r.year ? ", " + r.year : ""}${r.doi ? ", DOI " + r.doi : ""})`);
      });
    }
    if (ragBlock) ctxLines.push(ragBlock);

    const system = `Você é um redator científico sênior brasileiro. Gere texto acadêmico em pt-BR de alta qualidade, formal, claro e sem fabricar dados.

REGRAS OBRIGATÓRIAS:
- ZERO FABRICAÇÃO. Use apenas informação do CONTEXTO. Se faltar dado, escreva "[a definir pelo pesquisador]".
- Sempre que usar conteúdo dos TRECHOS DA BIBLIOTECA, cite inline como [Ref N].
- Saída SOMENTE em markdown limpo, com headings #, ##.
- Não inclua meta-comentários, introduções "aqui está" nem disclaimers.
- Tom acadêmico, preciso, sem floreios.
${extra_instructions ? `\nInstruções extras do pesquisador: ${extra_instructions}` : ""}

TAREFA: ${meta.instructions}

=== CONTEXTO ===
${ctxLines.join("\n")}
=== FIM DO CONTEXTO ===`;

    const res = await callAI({
      _userId: auth.userId,
      _promptType: "research_autowrite",
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Gere a seção: ${meta.title}` },
      ],
    } as any);

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: t }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";

    // Append references list when citations were used
    let citationsBlock = "";
    if (refCitations.length && text.includes("[Ref")) {
      citationsBlock = "\n\n## Referências citadas\n" + refCitations.map(c =>
        `- **[Ref ${c.n}]** ${c.title}${c.year ? ` (${c.year})` : ""}${c.doi ? ` — DOI: ${c.doi}` : ""}`
      ).join("\n");
    }

    return new Response(JSON.stringify({
      section: meta.title,
      text: text + citationsBlock,
      rag_used: refCitations.length > 0,
      rag_papers: refCitations.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
