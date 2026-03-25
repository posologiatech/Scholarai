import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, callEmbeddings } from "../_shared/ai-caller.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Anti-Hallucination Guard (Guarda Pretoriana) ─────────────────────
function validateCitations(text: string, maxValidId: number): string {
  const citationPattern = /\[(\d+)\]/g;
  let match;
  const invalidIds = new Set<number>();
  while ((match = citationPattern.exec(text)) !== null) {
    const id = parseInt(match[1]);
    if (id < 1 || id > maxValidId) invalidIds.add(id);
  }
  if (invalidIds.size === 0) return text;
  console.warn(`[writing-assist] HALLUCINATION DETECTED: Invalid citation IDs: ${[...invalidIds].join(', ')}. Max valid: ${maxValidId}`);
  let cleaned = text;
  for (const invalidId of invalidIds) {
    cleaned = cleaned.replace(new RegExp(`\\[${invalidId}\\]`, 'g'), '[?]');
  }
  return cleaned;
}

// ─── RAG: Semantic search on paper chunks ─────────────────────────────
async function fetchRAGContext(query: string, paperIds: string[]): Promise<string> {
  if (!query || paperIds.length === 0) return "";
  try {
    const embResponse = await callEmbeddings(query);
    if (!embResponse.ok) return "";
    const embData = await embResponse.json();
    const questionEmbedding = embData.data?.[0]?.embedding;
    if (!questionEmbedding) return "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const chunkPromises = paperIds.slice(0, 15).map((paperId: string) =>
      supabase.rpc("match_paper_chunks", {
        query_embedding: questionEmbedding,
        match_threshold: 0.3,
        match_count: 3,
        filter_paper_id: paperId,
      })
    );
    const chunkResults = await Promise.all(chunkPromises);
    const allChunks: any[] = [];
    chunkResults.forEach((result) => { if (result.data) allChunks.push(...result.data); });
    allChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    const topChunks = allChunks.slice(0, 10);

    if (topChunks.length > 0) {
      console.log(`[writing-assist] RAG: Found ${topChunks.length} relevant chunks`);
      return "\n\n--- TRECHOS REAIS DOS PAPERS (busca semântica RAG) ---\n\n" +
        topChunks.map((c: any, i: number) =>
          `[Trecho ${i + 1} de "${c.paper_title}" | relevância: ${(c.similarity * 100).toFixed(0)}%]\n${c.chunk_text}`
        ).join("\n\n");
    }
  } catch (err) {
    console.error("[writing-assist] RAG search failed:", err);
  }
  return "";
}

// ─── Shared Rigor & Style Rules ───────────────────────────────────────
const RIGOR_RULES = (lang: string) => `
[REGRAS INVIOLÁVEIS — PENA DE FALHA IMEDIATA SE DESCUMPRIDAS]
1. ZERO FABRICAÇÃO: Jamais invente dados, estatísticas, nomes de autores, títulos de artigos, resultados experimentais ou qualquer informação factual. Cada dado deve ser rastreável a uma fonte fornecida.
2. CITAÇÃO VERIFICÁVEL: Cada afirmação factual DEVE terminar com [N] referenciando APENAS os papers fornecidos (de [1] a [N_MAX]). NUNCA crie um ID novo. Se não há fonte para uma afirmação, escreva "[DADO NÃO DISPONÍVEL NAS FONTES]" em vez de inventar.
3. HEDGING CIENTÍFICO: Use linguagem probabilística ("suggests", "indicates", "was observed", "appears to", "the evidence points to") — NUNCA linguagem absolutista ("proves", "demonstrates conclusively", "it is certain"). A ciência opera com graus de evidência, não certezas.
4. DISTINÇÃO EVIDÊNCIA vs INTERPRETAÇÃO: Separe claramente o que os dados mostram ("The results showed...") do que o autor interpreta ("This may suggest..."). Use parágrafos ou frases distintas.
5. RESULTADOS NUMÉRICOS: Ao reportar resultados quantitativos, inclua SEMPRE: valor, intervalo de confiança ou desvio padrão, e tamanho amostral (n) quando disponíveis nos papers. Ex: "mean = 12.3 (SD = 2.1, n = 45) [3]".
6. CONFLITOS: Se papers divergem sobre um tema, MENCIONE a divergência explicitamente. Ex: "While [1] found X, [3] reported contradictory results showing Y."
7. LIMITAÇÕES: Quando relevante, mencione limitações metodológicas dos estudos citados (tamanho amostral pequeno, viés de seleção, etc.).
8. PRIORIDADE RAG: Quando trechos reais dos papers (RAG) estiverem disponíveis, PRIORIZE citá-los diretamente em vez de parafrasear apenas metadados.
`;

const STYLE_RULES = (lang: string) => `
[ESTILO DE ESCRITA — PESQUISADOR SÊNIOR]
- Escreva como um pesquisador sênior com 20+ anos de publicações em periódicos de alto impacto (Nature, Lancet, NEJM, Science).
- TRANSIÇÕES NATURAIS: Conecte parágrafos com transições lógicas orgânicas. PROIBIDO usar repetidamente "Além disso", "Adicionalmente", "Outrossim", "Furthermore", "Moreover". Use variações como: "Building on this evidence...", "A complementary perspective emerges from...", "These findings gain additional significance when considered alongside...", "In contrast to...".
- ESTRUTURA DE PARÁGRAFO: Cada parágrafo deve seguir: frase-tópico clara → evidência com citação [N] → análise/interpretação → transição para o próximo parágrafo.
- VARIAÇÃO SINTÁTICA: Alterne entre frases curtas incisivas e períodos compostos mais elaborados. Evite monotonia estrutural.
- VOZ: Use voz ativa ao descrever contribuições do estudo ("We observed", "The present study demonstrates") e voz passiva para procedimentos padronizados ("Samples were collected", "Data were analyzed").
- DISCUSSÃO: Na seção Discussão, SEMPRE confronte resultados com a literatura existente explicitamente. Não apenas cite — compare, contraste, e explique divergências.
- PRECISÃO TERMINOLÓGICA: Use termos técnicos precisos do campo. Não simplifique excessivamente nem use sinônimos vagos.
- COESÃO: Mantenha um fio condutor claro ao longo de toda a seção. O leitor deve perceber a progressão lógica do argumento.
${lang === "pt" ? "- Escreva em português acadêmico formal brasileiro." : "- Write in formal academic English."}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { action, content, papers, section, citationStyle, datamindAnalyses, uploadedPDFs, language } = await req.json();
    const lang = language || "pt";

    const paperContext = (papers || []).map((p: any, i: number) => {
      const authors = Array.isArray(p.authors) ? p.authors.join(", ") : (p.authors || "Unknown");
      return `[${i + 1}] ${authors} (${p.year || "n.d."}). ${p.title}. ${p.journal || ""}. DOI: ${p.doi || "N/A"}`;
    }).join("\n");
    const papersCount = (papers || []).length;

    const datamindContext = (datamindAnalyses || []).length > 0
      ? `\n\n--- ANÁLISES DATAMIND DISPONÍVEIS ---\n${datamindAnalyses.map((a: any, i: number) => `Análise ${i + 1}: ${a.title || "Sem título"}\n${a.content}`).join("\n\n")}`
      : "";

    const uploadedPDFContext = (uploadedPDFs || []).length > 0
      ? `\n\n--- DOCUMENTOS PDF DO PESQUISADOR ---\n${uploadedPDFs.map((p: any, i: number) => `Documento ${i + 1}: ${p.title || "Sem título"}\n${(p.content || "").slice(0, 15000)}`).join("\n\n")}`
      : "";

    const citationFormats: Record<string, string> = {
      APA: "APA 7th: Author, A. A. (Year). Use (Author, Year) for inline citations AND [N] for traceability.",
      Vancouver: "Vancouver: Number references in order of appearance. Use [N] for inline citations.",
      ABNT: "ABNT NBR 6023: SOBRENOME, Nome. Use (SOBRENOME, ano) for inline AND [N] for traceability.",
    };
    const styleGuide = citationFormats[citationStyle || "APA"] || citationFormats.APA;

    // RAG: Fetch real text chunks from papers
    const paperExternalIds = (papers || []).map((p: any) => p.doi || p.title || "").filter(Boolean);
    const ragQuery = content || section || "";
    const ragContext = await fetchRAGContext(ragQuery, paperExternalIds);

    const fullContext = `
[PAPERS FORNECIDOS PARA CITAÇÃO]
${paperContext}
${ragContext}
${datamindContext}
${uploadedPDFContext}

Citation format: ${styleGuide}
Valid citation range: [1] to [${papersCount}]. Do NOT use any ID outside this range.
`;

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "draft_section": {
        systemPrompt = `You are an elite academic writing assistant producing text indistinguishable from a senior researcher's work.
${RIGOR_RULES(lang)}
${STYLE_RULES(lang)}
${fullContext}`;

        userPrompt = `Generate a complete, publication-ready draft for the "${section}" section of a scientific paper.

Requirements:
- Every factual claim MUST have a citation [N] from the provided papers.
- Use RAG text excerpts when available for precise citations.
- Structure: clear topic sentences → evidence → analysis → transitions.
- If DataMind analyses are available, integrate statistics naturally with proper attribution.
- If researcher PDF documents are provided, use their content as additional reference material.

${content ? `Author's specific instructions:\n${content}` : ""}

Write the "${section}" section now.`;
        break;
      }

      case "insert_citation": {
        systemPrompt = `You are a citation formatting expert with zero tolerance for fabrication.
${RIGOR_RULES(lang)}
Citation format: ${styleGuide}`;
        userPrompt = `Format the following papers as inline citations and reference list entries in ${citationStyle || "APA"} style:
${paperContext}

For each paper, provide:
1. The full reference list entry
2. How to cite it inline within a sentence
3. A contextual example sentence using the citation

ONLY format papers that exist in the list above. Do NOT invent any papers.`;
        break;
      }

      case "rephrase": {
        systemPrompt = `You are an academic writing editor at a top-tier journal. Your task is to elevate text to senior-researcher quality.
${RIGOR_RULES(lang)}
${STYLE_RULES(lang)}
KEEP ALL EXISTING CITATIONS [N] INTACT. Do not add, remove, or change citation numbers.`;
        userPrompt = `Rephrase and elevate the following text to senior-researcher academic quality. Specifically:
1. Improve clarity, precision, and flow
2. Fix hedging (replace absolutist language with probabilistic)
3. Improve transitions between sentences/paragraphs
4. Enhance vocabulary precision
5. Keep ALL citations [N] exactly as they are

Provide the improved version, then briefly explain the key changes.

Text to improve:
"${content}"`;
        break;
      }

      case "check_consistency": {
        systemPrompt = `You are a rigorous scientific peer reviewer checking factual consistency. You are meticulous and constructive.
${RIGOR_RULES(lang)}
${fullContext}`;
        userPrompt = `Perform a thorough consistency review of this text. Check for:

1. **Unsupported Claims**: Claims without citations [N] or with citations that don't match the paper's actual content
2. **Citation Accuracy**: Verify each [N] matches what the cited paper actually reports (use RAG excerpts when available)
3. **Logical Gaps**: Missing logical steps, non-sequiturs, or unjustified conclusions
4. **Overgeneralizations**: Claims broader than the evidence supports (missing hedging)
5. **Numerical Consistency**: Check if reported numbers match across the text
6. **Missing Qualifiers**: Places where "may", "suggests", "in some cases" should be added

For each issue found, provide:
- The problematic sentence
- The type of issue
- A specific suggestion for correction

Text to review:
"${content}"`;
        break;
      }

      case "continue_writing": {
        systemPrompt = `You are an elite academic writing assistant. Continue the text seamlessly as if the same senior researcher is writing.
${RIGOR_RULES(lang)}
${STYLE_RULES(lang)}
${fullContext}`;
        userPrompt = `Continue writing this scientific text seamlessly. Match the existing tone, style, vocabulary level, and citation density. Use the available papers for new citations.

Important:
- Maintain the same argumentative thread
- Add citations [N] for every new factual claim
- Use natural transitions from the last paragraph
- Do NOT repeat what was already written

Current text:
"${content}"`;
        break;
      }

      case "format_for_journal": {
        systemPrompt = `You are an expert academic formatting assistant specializing in journal submission preparation.
${RIGOR_RULES(lang)}
${STYLE_RULES(lang)}
${fullContext}`;

        userPrompt = `Reformat the following article according to the target journal/publisher submission guidelines.

Adjustments to make:
- Section structure and ordering per journal requirements
- Citation formatting per the selected style (${citationStyle || "APA"})
- Abstract format (structured vs unstructured as required)
- Word limits and section requirements
- Required elements (conflict of interest, funding, data availability)
- Maintain ALL original content and citations

${content}

Reformat maintaining all content but adjusting structure, formatting, and citations.`;
        break;
      }

      case "generate_abstract": {
        systemPrompt = `You are an expert at writing structured scientific abstracts for high-impact journals.
${RIGOR_RULES(lang)}
${STYLE_RULES(lang)}`;
        userPrompt = `Generate a structured abstract from the following article text. The abstract MUST follow this structure:

**Objective/Background**: What is the research question or aim? (1-2 sentences)
**Methods**: What was done? Study design, population, key methods. (2-3 sentences)
**Results**: What were the main findings? Include key numerical results with statistics. (2-4 sentences)
**Conclusion**: What do the findings mean? Clinical/practical implications. (1-2 sentences)

Requirements:
- Maximum 350 words
- Every result mentioned must appear in the article text below
- Do NOT invent any results or statistics not present in the text
- If the article text is insufficient for a section, write "[SEÇÃO INCOMPLETA - dados insuficientes no texto]"
- Use precise, quantitative language

Article text:
"${content}"`;
        break;
      }

      case "peer_review": {
        systemPrompt = `You are simulating a rigorous peer reviewer from a top-tier journal (Reviewer #2 — the thorough one). You are constructive but demanding.
${RIGOR_RULES(lang)}
${fullContext}`;
        userPrompt = `Perform a simulated peer review of the following manuscript section. Evaluate:

## Structure of Your Review:

### Major Issues (must be addressed for publication):
- Methodological concerns
- Unsupported conclusions
- Missing critical information
- Logical flaws in argumentation

### Minor Issues (should be improved):
- Writing clarity
- Missing references for claims
- Incomplete statistical reporting
- Terminology imprecision

### Strengths:
- What the author does well

### Specific Suggestions:
- Numbered, actionable suggestions for improvement
- For each suggestion, explain WHY it matters for publication

Be thorough but constructive. A good review helps the author improve.

Manuscript text:
"${content}"`;
        break;
      }

      case "improve_hedging": {
        systemPrompt = `You are a scientific language specialist focused on epistemic precision. Your job is to fix absolutist language.
${RIGOR_RULES(lang)}
${STYLE_RULES(lang)}`;
        userPrompt = `Analyze the following text and fix ALL instances of absolutist or overly certain language. Replace with appropriate scientific hedging.

Common fixes:
- "proves" → "provides evidence for" / "suggests"
- "demonstrates" → "indicates" / "is consistent with"
- "shows that X causes Y" → "suggests an association between X and Y"
- "is" (when stating uncertain facts) → "appears to be" / "has been reported as"
- "always" → "in most cases" / "consistently"
- "never" → "has not been observed" / "rarely"
- "significant" (without p-value) → add "(p < 0.05)" or specify effect size

Provide:
1. The corrected text with all hedging improvements applied
2. A numbered list of every change made, with the original and corrected phrase

Text to analyze:
"${content}"`;
        break;
      }

      case "generate_highlights": {
        systemPrompt = `You are an expert at distilling research into concise key findings for journal submission.
${RIGOR_RULES(lang)}`;
        userPrompt = `Generate "Highlights" / "Key Findings" from the following article text. Many journals (e.g., Elsevier) require this.

Requirements:
- 3-5 bullet points
- Each bullet: ONE key finding in ONE sentence (max 85 characters)
- Start each with an action verb or key noun
- Must be factual — every highlight must be traceable to the article text
- Do NOT include findings not present in the text
- Include the most impactful and novel results

Format:
• Highlight 1
• Highlight 2
• Highlight 3
• Highlight 4
• Highlight 5

Article text:
"${content}"`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const aiResponse = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("writing-assist error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
