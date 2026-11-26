import { appraisalStage, flag, scopeStage, screeningStage, synthesisStage } from "./builders";
import { b, searchStage, strategyStage, writingStage } from "./common";
import type { ReviewTypeDef, StageDef } from "./schema";

const protocol: StageDef = {
  key: "protocol", title: b("Tema e perguntas", "Topic and questions"),
  description: b("Delimite o tema e as perguntas orientadoras e os critérios de busca e seleção. Não há protocolo oficial, mas fixar os critérios antes de buscar evita seleção enviesada pelo que você já espera encontrar.", "Delimit the topic, the guiding questions and the search and selection criteria. There is no official protocol, but fixing criteria before searching prevents selection biased by what you expect to find."),
  aiRole: b("Sugere critérios e refina as perguntas.", "Suggests criteria and refines the questions."),
  gate: [
    { kind: "field", field: "framework.topic", label: b("Descrever o tema", "Describe the topic") },
    { kind: "field", field: "question", label: b("Escrever as perguntas orientadoras", "Write the guiding questions") },
    { kind: "field", field: "eligibility", label: b("Definir critérios de seleção", "Define selection criteria") },
    { kind: "field", field: "protocol_locked_at", label: b("Congelar os critérios", "Lock the criteria") },
  ],
  uses: ["ProtocolPanel"],
};

export const narrative: ReviewTypeDef = {
  id: "narrative", version: "0.1.0",
  label: b("Revisão narrativa", "Narrative review"),
  summary: b("Panorama de um tema por quem o conhece. Não tem protocolo oficial único, então o assistente oferece um roteiro flexível e registra a busca para dar transparência.", "Overview of a topic by someone who knows it. There is no single official protocol, so the assistant offers a flexible path and logs the search for transparency."),
  framework: { name: "Tema", label: b("Tema e perguntas", "Topic and questions"), fields: [
    { key: "topic", label: b("Tema", "Topic"), hint: b("Sobre o que é a revisão e por que importa ao leitor", "What the review is about and why it matters to the reader"), required: true },
    { key: "audience", label: b("Público", "Audience"), hint: b("Para quem você escreve", "Who you are writing for"), required: false },
  ] },
  registry: null,
  reportingGuideline: { id: "sanra", name: "SANRA (autoavaliação de qualidade)" },
  appraisal: { required: false, tools: [] },
  screening: { dual: "optional", phases: ["title_abstract", "full_text"] },
  synthesis: b("Organização temática e discussão crítica, com as afirmações-chave apoiadas em referências.", "Thematic organisation and critical discussion, with key statements supported by references."),
  extractionFields: [
    { key: "authors_year", label: b("Autores e ano", "Authors and year"), kind: "text" },
    { key: "design", label: b("Tipo de estudo", "Study type"), kind: "text" },
    { key: "country", label: b("País", "Country"), kind: "text" },
    { key: "key_points", label: b("Pontos principais", "Key points"), kind: "list" },
    { key: "relevance", label: b("Relevância para a pergunta", "Relevance to the question"), kind: "text" },
  ],
  artifacts: [
    { kind: "synthesis_matrix", label: b("Tabela-síntese por tema", "Synthesis table by theme"), type: "table" },
    { kind: "theme_map", label: b("Estudos por tema", "Studies per theme"), type: "figure" },
    { kind: "distribution", label: b("Distribuição por ano", "Distribution by year"), type: "figure" },
    { kind: "search_appendix", label: b("Busca na literatura", "Literature search"), type: "table" },
  ],
  stages: [
    scopeStage(["Defina o tema e o leitor. Se a pergunta exige busca exaustiva e seleção por critérios rígidos, uma revisão sistemática ou de escopo é mais adequada.", "Define the topic and the reader. If the question needs an exhaustive search and strict selection, a systematic or scoping review fits better."]),
    protocol,
    strategyStage({ gate: [
      { kind: "count", metric: "sources_selected", min: 1, label: b("Selecionar ao menos uma base", "Select at least one source") },
      { kind: "flag", flag: "strategy_approved", label: b("Aprovar a estratégia de busca", "Approve the search strategy") },
    ] }),
    searchStage({ gate: [
      { kind: "count", metric: "searches_logged", min: 1, label: b("Registrar ao menos uma busca", "Log at least one search") },
      { kind: "count", metric: "records", min: 1, label: b("Ter registros importados", "Have imported records") },
      { kind: "flag", flag: "duplicates_reviewed", label: b("Conferir as duplicatas", "Review duplicates") },
    ] }),
    screeningStage({ requireTwo: false, desc: ["Seleção por um revisor é aceita nesse tipo; registre os motivos de exclusão para dar transparência.", "Selection by one reviewer is accepted for this type; record exclusion reasons for transparency."] }),
    appraisalStage({ title: ["Leitura e pontos principais", "Reading and key points"], desc: ["Leia os estudos selecionados e registre os pontos principais de cada um. A avaliação formal de qualidade não é exigida.", "Read the selected studies and record each one's key points. Formal quality appraisal is not required."], appraisal: false }),
    synthesisStage({
      title: ["Organização temática", "Thematic organisation"], desc: ["Agrupe os pontos em temas e marque em quais estudos cada um aparece, para sustentar cada afirmação com referências.", "Group the points into themes and mark which studies each appears in, so each statement is backed by references."],
      ai: ["Os temas são decisão sua.", "Themes are your decision."], gate: [flag("matrix_built", "Montar a tabela-síntese por tema", "Build the synthesis table by theme")],
    }),
    writingStage(),
  ],
  references: [
    { citation: "Baethge C, Goldbeck-Wood S, Mertens S. SANRA: a scale for the quality assessment of narrative review articles. Res Integr Peer Rev 2019;4:5.", role: "reporting" },
  ],
  review: { status: "pending-expert-review" },
};
