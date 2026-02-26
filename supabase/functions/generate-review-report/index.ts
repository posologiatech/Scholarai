import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, papers, includedPaperIds, totalPapers, screenedCount, criteria, screeningResults, extractionColumns, extractionResults, locale = "pt" } = await req.json();

    if (!question || !papers?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const includedPapers = papers.filter((p: any) => includedPaperIds?.includes(p.id));
    const excludedCount = screenedCount - includedPaperIds.length;

    // Build criteria summary
    const criteriaList = (criteria || [])
      .filter((c: any) => c.enabled !== false)
      .map((c: any) => `- **${c.name}**: ${c.description}`)
      .join("\n");

    // Build extraction data summary
    let extractionSummary = "";
    if (extractionColumns?.length > 0 && extractionResults) {
      const enabledCols = extractionColumns.filter((c: any) => c.enabled !== false);
      const rows: string[] = [];
      for (const paper of includedPapers) {
        const results = extractionResults[paper.id];
        if (!results) continue;
        const authorStr = paper.authors?.length > 0
          ? `${paper.authors[0].split(" ").pop() || paper.authors[0]} et al.`
          : "Unknown";
        const colValues = enabledCols.map((col: any) => `${col.name}: ${results[col.id] || "N/A"}`).join("; ");
        rows.push(`- ${authorStr}, ${paper.year || "n.d."}: ${colValues}`);
      }
      extractionSummary = rows.join("\n");
    }

    // Build paper abstracts for synthesis
    const papersSummary = includedPapers.slice(0, 30).map((p: any, i: number) => {
      const authorStr = (p.authors || []).slice(0, 4).join(", ") + (p.authors?.length > 4 ? " et al." : "");
      return `[${i + 1}] ${authorStr} (${p.year || "n.d."}). "${p.title}". ${p.abstract || "Sem resumo disponível."}`;
    }).join("\n\n");

    const systemPrompt = locale === "pt"
      ? `Você é um especialista em revisões sistemáticas. Gere um relatório COMPLETO e DETALHADO de revisão sistemática em português (pt-BR), seguindo rigorosamente a estrutura abaixo. O relatório deve ser extenso, acadêmico e com análise profunda.

ESTRUTURA OBRIGATÓRIA:

1. **RESUMO** (Abstract): Um parágrafo completo resumindo o objetivo, métodos, principais achados e conclusões da revisão.

2. **MÉTODOS**: 
   - Descrição da busca (pergunta de pesquisa, bases consultadas, número de artigos identificados)
   - Critérios de triagem utilizados
   - Processo de seleção (quantos artigos triados, incluídos, excluídos)
   - Campos de extração de dados

3. **RESULTADOS**:
   - **Características dos Estudos Incluídos**: Descreva os tipos de estudo, tamanhos amostrais, populações, etc. baseado nos dados de extração
   - **Principais Achados**: Agrupe os resultados por subtemas relevantes. Para cada subtema, discuta os achados de múltiplos estudos, citando-os por autor e ano.
   - Inclua análises quantitativas quando os dados permitirem (ranges, médias, etc.)
   - Identifique padrões, concordâncias e discordâncias entre os estudos

4. **DISCUSSÃO**:
   - Síntese dos achados principais
   - Comparação com literatura prévia
   - Limitações dos estudos e da revisão
   - Implicações para prática e pesquisa futura

5. **CONCLUSÃO**: Parágrafo conciso com as conclusões principais

6. **REFERÊNCIAS**: Liste TODAS as referências dos artigos incluídos no formato: Autores (Ano). Título. Journal.

IMPORTANTE:
- Cite os estudos pelo nome do primeiro autor e ano ao longo do texto, ex: "Silva et al. (2023)"
- Use marcadores * ao final de afirmações baseadas nos papers para indicar fonte
- Seja DETALHADO e EXTENSO - mínimo 2000 palavras
- Base tudo nos dados fornecidos, não invente informações`
      : `You are a systematic review expert. Generate a COMPLETE and DETAILED systematic review report following this structure...`; // English version abbreviated for space

    const userPrompt = `Pergunta de pesquisa: "${question}"

DADOS DO PRISMA:
- Artigos identificados: ${totalPapers}
- Artigos triados: ${screenedCount}
- Artigos incluídos: ${includedPaperIds.length}
- Artigos excluídos: ${excludedCount}

CRITÉRIOS DE TRIAGEM:
${criteriaList || "Não definidos"}

DADOS DE EXTRAÇÃO:
${extractionSummary || "Não disponíveis"}

ARTIGOS INCLUÍDOS (${includedPapers.length} total):
${papersSummary}

Gere o relatório completo de revisão sistemática.`;

    const response = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
