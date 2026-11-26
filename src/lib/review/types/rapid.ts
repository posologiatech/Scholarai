import { appraisalStage, flag, protocolStage, scopeStage, screeningStage, synthesisStage } from "./builders";
import { b, pico, ref, searchStage, strategyStage, writingStage } from "./common";
import { systematic } from "./systematic";
import type { ReviewTypeDef } from "./schema";

/** Shortcuts a rapid review may take. They must be declared up front and reported in the manuscript. */
export const RAPID_SHORTCUTS: { key: string; pt: string; en: string }[] = [
  { key: "limited_databases", pt: "Menos bases de dados do que uma revisão sistemática completa", en: "Fewer databases than a full systematic review" },
  { key: "limited_dates", pt: "Período de publicação restrito", en: "Restricted publication period" },
  { key: "limited_language", pt: "Idiomas restritos", en: "Restricted languages" },
  { key: "no_grey", pt: "Sem literatura cinzenta", en: "No grey literature" },
  { key: "single_screening", pt: "Triagem por um revisor, com conferência de uma amostra por um segundo", en: "Screening by one reviewer, with a sample checked by a second" },
  { key: "single_extraction", pt: "Extração por um revisor, com conferência por um segundo", en: "Extraction by one reviewer, checked by a second" },
  { key: "single_appraisal", pt: "Avaliação de qualidade por um revisor, com conferência por um segundo", en: "Quality appraisal by one reviewer, checked by a second" },
  { key: "narrative_only", pt: "Síntese narrativa, sem meta-análise", en: "Narrative synthesis, no meta-analysis" },
  { key: "none", pt: "Nenhum atalho: o processo segue a revisão sistemática completa", en: "No shortcuts: the process follows a full systematic review" },
];

export const rapid: ReviewTypeDef = {
  id: "rapid", version: "0.1.0",
  label: b("Revisão rápida", "Rapid review"),
  summary: b("Versão acelerada da sistemática para decisões com prazo curto, com atalhos metodológicos assumidos, declarados antes de começar e relatados no manuscrito.",
    "Accelerated version of a systematic review for decisions on a short timeline, with methodological shortcuts that are chosen and declared up front and reported in the manuscript."),
  framework: { name: "PICO", fields: pico },
  registry: { name: "PROSPERO / OSF", url: "https://www.crd.york.ac.uk/prospero/", required: false },
  reportingGuideline: { id: "prisma2020", name: "PRISMA 2020, com os atalhos declarados" },
  appraisal: { required: true, tools: systematic.appraisal.tools },
  screening: { dual: "optional", phases: ["title_abstract", "full_text"] },
  synthesis: b("Síntese narrativa estruturada; meta-análise quando couber. Certeza da evidência opcional.", "Structured narrative synthesis; meta-analysis when feasible. Certainty of evidence optional."),
  extractionFields: systematic.extractionFields,
  artifacts: [
    { kind: "prisma_flow", label: b("Fluxograma PRISMA 2020", "PRISMA 2020 flow diagram"), type: "figure" },
    { kind: "rob_traffic_light", label: b("Semáforo de risco de viés", "Risk-of-bias traffic light"), type: "figure" },
    { kind: "shortcuts_table", label: b("Atalhos metodológicos declarados", "Declared methodological shortcuts"), type: "table" },
    { kind: "search_appendix", label: b("Estratégia de busca por base", "Search strategy by source"), type: "table" },
    { kind: "characteristics", label: b("Características dos estudos incluídos", "Characteristics of included studies"), type: "table" },
    { kind: "excluded_fulltext", label: b("Excluídos no texto completo, com motivo", "Excluded at full text, with reason"), type: "table" },
    { kind: "sof_grade", label: b("Resumo dos achados (GRADE)", "Summary of findings (GRADE)"), type: "table" },
  ],
  stages: [
    scopeStage(["Confirme que o prazo exige uma revisão rápida e que os atalhos são aceitáveis para quem vai usar o resultado.", "Confirm the timeline calls for a rapid review and that the shortcuts are acceptable to those who will use the result."]),
    protocolStage({
      fields: [{ key: "population", pt: "população (P)", en: "population (P)" }, { key: "intervention", pt: "intervenção (I)", en: "intervention (I)" }, { key: "outcome", pt: "desfecho (O)", en: "outcome (O)" }],
      desc: ["Escreva a pergunta em PICO e os critérios, e declare os atalhos que vai tomar. Congele o protocolo.", "Write the question in PICO and the criteria, and declare the shortcuts you will take. Lock the protocol."],
      extra: [{ kind: "field", field: "shortcuts", label: b("Declarar os atalhos metodológicos", "Declare the methodological shortcuts") }],
    }),
    strategyStage(),
    searchStage(),
    screeningStage({ requireTwo: false, desc: ["Pode ser feita por um revisor, com conferência de uma amostra por um segundo; a escolha fica registrada.", "May be done by one reviewer with a sample checked by a second; the choice is recorded."] }),
    appraisalStage({ title: ["Extração e risco de viés", "Extraction and risk of bias"], desc: ["Extração e avaliação de qualidade, que podem ser simplificadas conforme os atalhos declarados.", "Extraction and quality appraisal, which may be simplified according to the declared shortcuts."], appraisal: true }),
    synthesisStage({
      title: ["Síntese", "Synthesis"], desc: ["Síntese narrativa estruturada ou meta-análise, com a escolha justificada.", "Structured narrative synthesis or meta-analysis, with the choice justified."],
      ai: ["Descreve resultados já calculados; não calcula efeitos.", "Describes already-computed results; it does not compute effects."],
      gate: [flag("synthesis_method_chosen", "Escolher e justificar o método de síntese", "Choose and justify the synthesis method")],
    }),
    writingStage(),
  ],
  references: [
    { citation: "Garritty C, et al. Cochrane Rapid Reviews Methods Group offers evidence-informed guidance to conduct rapid reviews. J Clin Epidemiol 2021;130:13-22.", role: "method" },
    { citation: ref.prisma2020, role: "reporting" },
    { citation: ref.prismaS, role: "reporting" },
  ],
  review: { status: "pending-expert-review" },
};
