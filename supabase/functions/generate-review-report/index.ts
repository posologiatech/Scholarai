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
      .map((c: any) => `- ${c.name}: ${c.description}`)
      .join("\n");

    // Build extraction data summary per paper
    let extractionSummary = "";
    if (extractionColumns?.length > 0 && extractionResults) {
      const enabledCols = extractionColumns.filter((c: any) => c.enabled !== false);
      const rows: string[] = [];
      for (const paper of includedPapers) {
        const results = extractionResults[paper.id];
        if (!results) continue;
        const authorStr = paper.authors?.length > 0
          ? `${paper.authors[0].split(" ").pop() || paper.authors[0]}${paper.authors.length > 1 ? " et al." : ""}`
          : "Unknown";
        const colValues = enabledCols.map((col: any) => `  - ${col.name}: ${results[col.id] || "N/A"}`).join("\n");
        rows.push(`${authorStr} (${paper.year || "n.d."}):\n${colValues}`);
      }
      extractionSummary = rows.join("\n\n");
    }

    // Build detailed paper summaries
    const papersSummary = includedPapers.map((p: any, i: number) => {
      const authorStr = (p.authors || []).slice(0, 6).join(", ") + (p.authors?.length > 6 ? " et al." : "");
      return `[${i + 1}] ${authorStr} (${p.year || "n.d."}). "${p.title}".${p.journal ? ` ${p.journal}.` : ""}${p.doi ? ` DOI: ${p.doi}` : ""}\nResumo: ${p.abstract || "Sem resumo disponível."}`;
    }).join("\n\n");

    const systemPrompt = locale === "pt"
      ? `Você é um pesquisador acadêmico experiente especializado em revisões sistemáticas. Seu trabalho é redigir relatórios de revisão sistemática de alta qualidade acadêmica, no nível de publicação em periódicos científicos indexados.

INSTRUÇÕES DE FORMATAÇÃO:
- Escreva em português acadêmico formal (pt-BR)
- Use markdown: ## para seções principais, ### para subseções
- Cite os estudos no corpo do texto como (Sobrenome et al., Ano) ou (Sobrenome, Ano) para autor único
- NÃO inclua seção de referências no texto - ela será gerada automaticamente pelo sistema
- Seja extenso e detalhado - mínimo 3000 palavras
- Use parágrafos longos e bem desenvolvidos, como em artigos científicos reais
- Tabelas em markdown são permitidas quando relevantes

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

## Resumo
Parágrafo estruturado contendo: Introdução/Contexto, Objetivo, Métodos (bases consultadas, critérios, número de estudos), Resultados principais e Conclusão. Deve ter entre 200-300 palavras.

## Palavras-chave
Liste 5-7 palavras-chave relevantes separadas por ponto e vírgula.

## Introdução
- Contextualize o tema com profundidade (estado da arte, relevância clínica/científica, lacunas no conhecimento)
- Cite estudos relevantes da lista fornecida para embasar a contextualização
- Apresente a justificativa para a revisão
- Declare claramente o objetivo da revisão no último parágrafo
- Mínimo 3 parágrafos longos

## Materiais e Métodos
- Estratégia de busca: descreva as bases de dados consultadas, termos de busca, período
- Critérios de elegibilidade: liste os critérios de inclusão e exclusão utilizados
- Processo de seleção: descreva o fluxo PRISMA (identificados → triados → incluídos/excluídos)
- Extração de dados: descreva os campos extraídos de cada estudo
- Avaliação de qualidade: mencione como a qualidade foi avaliada

## Resultados
### Seleção dos estudos
Descreva o processo de seleção com números exatos.

### Características dos estudos incluídos
Descreva detalhadamente as características gerais dos estudos (tipos de estudo, populações, tamanhos amostrais, intervenções, durações). Use os dados de extração fornecidos.

### Principais achados
Organize os resultados por subtemas relevantes à pergunta de pesquisa. Para cada subtema:
- Apresente os achados de cada estudo individual, citando autor e ano
- Compare resultados entre estudos
- Identifique padrões, concordâncias e discordâncias
- Inclua dados quantitativos quando disponíveis (valores, intervalos, percentuais)
- Mínimo 3 subtemas com 2+ parágrafos cada

## Discussão
- Sintetize os achados principais em relação à pergunta de pesquisa
- Compare com a literatura prévia e diretrizes atuais
- Discuta as implicações clínicas/práticas dos achados
- Analise as limitações dos estudos incluídos (viés, heterogeneidade, tamanho amostral)
- Discuta as limitações desta revisão
- Sugira direções para pesquisas futuras
- Mínimo 4 parágrafos longos

## Conclusão
Parágrafo conclusivo sintetizando os principais achados, suas implicações e recomendações. Deve ser conciso mas abrangente.

IMPORTANTE:
- Base TUDO nos dados fornecidos - não invente informações
- Se não houver dados suficientes sobre um aspecto, indique isso explicitamente
- Mantenha tom acadêmico impessoal (terceira pessoa ou "nós")
- Cada afirmação substantiva deve citar a fonte entre parênteses`
      : `You are an expert academic researcher specialized in systematic reviews. Write a publication-quality systematic review report following standard academic structure with Abstract, Introduction, Methods, Results, Discussion, and Conclusion. Minimum 3000 words. Cite studies as (Author et al., Year). Do NOT include a References section - it will be auto-generated.`;

    const userPrompt = `Pergunta de pesquisa: "${question}"

DADOS DO FLUXO PRISMA:
- Artigos identificados nas bases de dados: ${totalPapers}
- Artigos triados por critérios de elegibilidade: ${screenedCount}
- Artigos incluídos na síntese: ${includedPaperIds.length}
- Artigos excluídos após triagem: ${excludedCount}

CRITÉRIOS DE ELEGIBILIDADE UTILIZADOS:
${criteriaList || "Não especificados"}

DADOS DE EXTRAÇÃO POR ESTUDO:
${extractionSummary || "Dados de extração não disponíveis"}

ARTIGOS INCLUÍDOS NA REVISÃO (${includedPapers.length} estudos):
${papersSummary}

Com base nos dados acima, redija o relatório completo de revisão sistemática seguindo rigorosamente a estrutura solicitada. Seja detalhado, analítico e acadêmico.`;

    const response = await callAI({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 12000,
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
