import { appraisalStage, flag, protocolStage, scopeStage, screeningStage, synthesisStage } from "./builders";
import { b, ref, searchStage, strategyStage, writingStage } from "./common";
import type { ReviewTypeDef } from "./schema";

export const qualitative: ReviewTypeDef = {
  id: "qualitative", version: "0.1.0",
  label: b("Síntese qualitativa", "Qualitative synthesis"),
  summary: b("Integra achados de estudos qualitativos (temas e conceitos) em uma interpretação mais ampla, por síntese temática ou meta-etnografia.", "Integrates findings of qualitative studies (themes and concepts) into a broader interpretation, by thematic synthesis or meta-ethnography."),
  framework: { name: "SPIDER", fields: [
    { key: "sample", label: b("Amostra (S)", "Sample (S)"), hint: b("Quem foi estudado", "Who was studied"), required: true },
    { key: "phenomenon", label: b("Fenômeno de interesse (PI)", "Phenomenon of interest (PI)"), hint: b("Experiência, comportamento ou decisão estudada", "Experience, behaviour or decision studied"), required: true },
    { key: "design", label: b("Desenho (D)", "Design (D)"), hint: b("Ex.: entrevistas, grupos focais, etnografia", "E.g. interviews, focus groups, ethnography"), required: false },
    { key: "evaluation", label: b("Avaliação (E)", "Evaluation (E)"), hint: b("Resultados avaliados: vivências, percepções, atitudes", "Outcomes evaluated: experiences, perceptions, attitudes"), required: false },
    { key: "research_type", label: b("Tipo de pesquisa (R)", "Research type (R)"), hint: b("Qualitativa ou de métodos mistos", "Qualitative or mixed methods"), required: false },
  ] },
  registry: { name: "PROSPERO / OSF", url: "https://www.crd.york.ac.uk/prospero/", required: false },
  reportingGuideline: { id: "entreq", name: "ENTREQ" },
  appraisal: { required: true, tools: [{ id: "casp", label: "CASP (qualitativo)", appliesTo: b("Estudos qualitativos", "Qualitative studies"), required: true }, { id: "mmat", label: "MMAT 2018", appliesTo: b("Alternativa, inclusive métodos mistos", "Alternative, including mixed methods"), required: false }] },
  screening: { dual: "required", phases: ["title_abstract", "full_text"] },
  synthesis: b("Síntese temática ou meta-etnografia, com codificação do texto dos estudos e comparação entre eles.", "Thematic synthesis or meta-ethnography, coding the studies' text and comparing across them."),
  extractionFields: [
    { key: "authors_year", label: b("Autores e ano", "Authors and year"), kind: "text" },
    { key: "country", label: b("País", "Country"), kind: "text" },
    { key: "aims", label: b("Objetivo do estudo", "Study aims"), kind: "text" },
    { key: "setting", label: b("Cenário", "Setting"), kind: "text" },
    { key: "sample", label: b("Participantes", "Participants"), kind: "text" },
    { key: "data_collection", label: b("Coleta de dados", "Data collection"), kind: "text" },
    { key: "analysis_approach", label: b("Abordagem de análise dos autores", "Authors analysis approach"), kind: "text" },
    { key: "findings", label: b("Temas e achados dos autores", "Authors themes and findings"), kind: "list" },
    { key: "quotes", label: b("Citações de participantes que ilustram os temas", "Participant quotes illustrating the themes"), kind: "list" },
  ],
  artifacts: [
    { kind: "prisma_flow", label: b("Fluxograma de seleção", "Selection flow diagram"), type: "figure" },
    { kind: "synthesis_matrix", label: b("Tabela de temas por estudo", "Themes by study table"), type: "table" },
    { kind: "theme_map", label: b("Estudos por tema", "Studies per theme"), type: "figure" },
    { kind: "characteristics", label: b("Características dos estudos", "Study characteristics"), type: "table" },
    { kind: "search_appendix", label: b("Estratégia de busca por base", "Search strategy by source"), type: "table" },
    { kind: "excluded_fulltext", label: b("Excluídos no texto completo, com motivo", "Excluded at full text, with reason"), type: "table" },
  ],
  stages: [
    scopeStage(),
    protocolStage({
      fields: [{ key: "sample", pt: "amostra (S)", en: "sample (S)" }, { key: "phenomenon", pt: "fenômeno de interesse (PI)", en: "phenomenon of interest (PI)" }],
      desc: ["Defina a pergunta em SPIDER, os critérios de elegibilidade e o método de síntese. Congele o protocolo.", "Define the question in SPIDER, the eligibility criteria and the synthesis method. Lock the protocol."],
    }),
    strategyStage(),
    searchStage(),
    screeningStage({ requireTwo: true, desc: ["Triagem por dois revisores independentes. Busca de pesquisa qualitativa é menos sensível; registre isso como limitação.", "Screening by two independent reviewers. Qualitative research searches are less sensitive; record this as a limitation."] }),
    appraisalStage({ title: ["Extração e CASP", "Extraction and CASP"], desc: ["Extraia temas e citações de cada estudo e avalie a qualidade com o CASP.", "Extract themes and quotes from each study and appraise quality with CASP."], appraisal: true }),
    synthesisStage({
      title: ["Síntese temática", "Thematic synthesis"], desc: ["Codifique os achados, agrupe em temas e compare entre os estudos. Registre se os temas foram derivados de forma indutiva ou dedutiva.", "Code the findings, group them into themes and compare across studies. Record whether themes were derived inductively or deductively."],
      ai: ["Os temas e a interpretação são decisão sua.", "Themes and interpretation are your decision."],
      gate: [flag("matrix_built", "Montar a matriz de temas por estudo", "Build the themes-by-study matrix"), flag("themes_confirmed", "Confirmar os temas e as conclusões", "Confirm the themes and conclusions")],
    }),
    writingStage(),
  ],
  references: [
    { citation: "Thomas J, Harden A. Methods for the thematic synthesis of qualitative research in systematic reviews. BMC Med Res Methodol 2008;8:45.", role: "synthesis" },
    { citation: "Tong A, et al. Enhancing transparency in reporting the synthesis of qualitative research: ENTREQ. BMC Med Res Methodol 2012;12:181.", role: "reporting" },
    { citation: ref.prismaS, role: "reporting" },
  ],
  review: { status: "pending-expert-review" },
};
