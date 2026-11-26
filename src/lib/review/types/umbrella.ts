import { appraisalStage, flag, protocolStage, scopeStage, screeningStage, synthesisStage } from "./builders";
import { b, pico, ref, searchStage, strategyStage, writingStage } from "./common";
import type { ReviewTypeDef } from "./schema";

export const umbrella: ReviewTypeDef = {
  id: "umbrella", version: "0.1.0",
  label: b("Revisão guarda-chuva", "Umbrella review"),
  summary: b("Revisão de revisões sistemáticas. O ponto crítico é a sobreposição de estudos primários entre as revisões incluídas, que o sistema mede.", "Review of systematic reviews. The critical point is the overlap of primary studies between the included reviews, which the system measures."),
  framework: {
    name: "PICO", fields: [
      ...pico.filter((f) => f.key !== "design"),
      { key: "review_types", label: b("Tipos de revisão elegíveis", "Eligible review types"), hint: b("Ex.: revisões sistemáticas com ou sem meta-análise", "E.g. systematic reviews with or without meta-analysis"), required: false },
    ],
  },
  registry: { name: "PROSPERO / OSF", url: "https://www.crd.york.ac.uk/prospero/", required: false },
  reportingGuideline: { id: "prior", name: "PRIOR" },
  appraisal: { required: true, tools: [{ id: "amstar2", label: "AMSTAR 2", appliesTo: b("Revisões sistemáticas", "Systematic reviews"), required: true }] },
  screening: { dual: "required", phases: ["title_abstract", "full_text"] },
  synthesis: b("Síntese estruturada em tabelas e narrativa, com a sobreposição de estudos primários medida (área coberta corrigida).", "Structured synthesis in tables and narrative, with overlap of primary studies measured (corrected covered area)."),
  extractionFields: [
    { key: "review_design", label: b("Tipo da revisão (com ou sem meta-análise)", "Review type (with or without meta-analysis)"), kind: "text" },
    { key: "search_date", label: b("Data da última busca da revisão", "Date of the review's last search"), kind: "text" },
    { key: "databases", label: b("Bases pesquisadas", "Databases searched"), kind: "text" },
    { key: "n_primary", label: b("Nº de estudos primários incluídos", "No. of primary studies included"), kind: "number" },
    { key: "n_participants", label: b("Nº de participantes", "No. of participants"), kind: "number" },
    { key: "population", label: b("População", "Population"), kind: "text" },
    { key: "intervention", label: b("Intervenção / exposição", "Intervention / exposure"), kind: "text" },
    { key: "outcomes", label: b("Desfechos avaliados", "Outcomes assessed"), kind: "list" },
    { key: "appraisal_used", label: b("Ferramenta de qualidade usada na revisão", "Quality tool used in the review"), kind: "text" },
    { key: "main_results", label: b("Principais resultados (efeito, IC95%)", "Main results (effect, 95% CI)"), kind: "list" },
    { key: "heterogeneity", label: b("Heterogeneidade relatada", "Heterogeneity reported"), kind: "text" },
    { key: "primary_studies", label: b("Estudos primários incluídos (um DOI, PMID ou título por linha)", "Primary studies included (one DOI, PMID or title per line)"), kind: "list" },
  ],
  artifacts: [
    { kind: "prisma_flow", label: b("Fluxograma de seleção", "Selection flow diagram"), type: "figure" },
    { kind: "overlap_matrix", label: b("Matriz de sobreposição de estudos primários", "Overlap matrix of primary studies"), type: "table" },
    { kind: "amstar_summary", label: b("Qualidade das revisões (AMSTAR 2)", "Quality of the reviews (AMSTAR 2)"), type: "table" },
    { kind: "characteristics", label: b("Características das revisões incluídas", "Characteristics of included reviews"), type: "table" },
    { kind: "search_appendix", label: b("Estratégia de busca por base", "Search strategy by source"), type: "table" },
    { kind: "excluded_fulltext", label: b("Excluídas no texto completo, com motivo", "Excluded at full text, with reason"), type: "table" },
  ],
  stages: [
    scopeStage(),
    protocolStage({
      fields: [{ key: "population", pt: "população (P)", en: "population (P)" }, { key: "intervention", pt: "intervenção (I)", en: "intervention (I)" }, { key: "outcome", pt: "desfecho (O)", en: "outcome (O)" }],
      desc: ["PICO aplicado a revisões, critérios de elegibilidade das revisões e plano para tratar a sobreposição. Congele o protocolo.", "PICO applied to reviews, eligibility criteria for reviews and a plan to handle overlap. Lock the protocol."],
    }),
    strategyStage(),
    searchStage(),
    screeningStage({ requireTwo: true, desc: ["Triagem de revisões por dois revisores independentes, com resolução de desacordos.", "Screening of reviews by two independent reviewers, with disagreements resolved."] }),
    appraisalStage({ title: ["Extração e AMSTAR 2", "Extraction and AMSTAR 2"], desc: ["Extraia os dados de cada revisão, inclusive a lista de estudos primários, e avalie com o AMSTAR 2.", "Extract data from each review, including its list of primary studies, and appraise with AMSTAR 2."], appraisal: true }),
    synthesisStage({
      title: ["Sobreposição e síntese", "Overlap and synthesis"], desc: ["Meça a sobreposição de estudos primários entre as revisões e sintetize os resultados de forma estruturada.", "Measure the overlap of primary studies between reviews and synthesise results in a structured way."],
      ai: ["Descreve os números já calculados; a decisão sobre como tratar a sobreposição é sua.", "Describes the numbers already computed; how to handle overlap is your decision."],
      gate: [flag("synthesis_method_chosen", "Escolher e justificar o método de síntese", "Choose and justify the synthesis method"), flag("overlap_reviewed", "Revisar a sobreposição entre as revisões", "Review the overlap between reviews")],
    }),
    writingStage(),
  ],
  references: [
    { citation: ref.jbi, role: "method" },
    { citation: "Gates M, et al. Reporting guideline for overviews of reviews of healthcare interventions (PRIOR). BMJ 2022;378:e070849.", role: "reporting" },
    { citation: "Shea BJ, et al. AMSTAR 2. BMJ 2017;358:j4008.", role: "appraisal" },
    { citation: "Pieper D, et al. Systematic review finds overlapping reviews were not mentioned in every other overview. J Clin Epidemiol 2014;67:368-375.", role: "synthesis" },
  ],
  review: { status: "pending-expert-review" },
};
