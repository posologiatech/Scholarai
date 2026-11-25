import { b, ref, searchStage, strategyStage, writingStage } from "./common";
import type { ReviewTypeDef } from "./schema";

export const scoping: ReviewTypeDef = {
  id: "scoping",
  version: "0.1.0",
  label: b("Revisão de escopo", "Scoping review"),
  summary: b(
    "Mapeia a extensão e a natureza da evidência sobre um tema amplo e identifica conceitos e lacunas. Em geral não avalia a qualidade dos estudos nem faz meta-análise.",
    "Maps the extent and nature of evidence on a broad topic and identifies concepts and gaps. Usually does not appraise study quality or run a meta-analysis.",
  ),
  framework: {
    name: "PCC",
    fields: [
      { key: "population", label: b("População", "Population"), hint: b("Quem é o foco? Pode ser ampla.", "Who is the focus? May be broad."), required: true },
      { key: "concept", label: b("Conceito", "Concept"), hint: b("O fenômeno, intervenção ou tema central", "The central phenomenon, intervention or topic"), required: true },
      { key: "context", label: b("Contexto", "Context"), hint: b("Cenário, país, nível de atenção", "Setting, country, level of care"), required: true },
    ],
  },
  registry: { name: "OSF Registries", url: "https://osf.io/registries", required: false },
  reportingGuideline: { id: "prisma-scr", name: "PRISMA-ScR" },
  appraisal: {
    required: false,
    tools: [{ id: "mmat", label: "MMAT / ferramenta por desenho", appliesTo: b("Opcional, se a equipe decidir avaliar", "Optional, if the team decides to appraise"), required: false }],
  },
  screening: { dual: "recommended", phases: ["title_abstract", "full_text"] },
  synthesis: b(
    "Extração (charting) com formulário refinado em piloto, mapeamento descritivo e temático; consulta a partes interessadas como etapa opcional.",
    "Charting with a form refined in a pilot, descriptive and thematic mapping; stakeholder consultation as an optional stage.",
  ),
  extractionFields: [
    { key: "authors_year", label: b("Autores e ano", "Authors and year"), kind: "text" },
    { key: "country", label: b("País", "Country"), kind: "text" },
    { key: "aims", label: b("Objetivo do estudo", "Study aims"), kind: "text" },
    { key: "design", label: b("Desenho / tipo de fonte", "Design / source type"), kind: "text" },
    { key: "population", label: b("População e amostra", "Population and sample"), kind: "text" },
    { key: "concept", label: b("Conceito ou intervenção", "Concept or intervention"), kind: "text" },
    { key: "context", label: b("Contexto", "Context"), kind: "text" },
    { key: "key_findings", label: b("Principais achados relacionados à pergunta", "Key findings related to the question"), kind: "list" },
  ],
  artifacts: [
    { kind: "prisma_flow_scr", label: b("Fluxograma PRISMA-ScR", "PRISMA-ScR flow diagram"), type: "figure" },
    { kind: "evidence_map", label: b("Mapa de evidências em bolhas", "Evidence bubble map"), type: "figure" },
    { kind: "distribution", label: b("Distribuição por ano, país e desenho", "Distribution by year, country and design"), type: "figure" },
    { kind: "concept_map", label: b("Mapa de conceitos", "Concept map"), type: "figure" },
    { kind: "search_appendix", label: b("Estratégia de busca por base", "Search strategy by source"), type: "table" },
    { kind: "charting", label: b("Tabela de extração (charting)", "Charting table"), type: "table" },
  ],
  stages: [
    {
      key: "scope", title: b("Tipo e escopo", "Type and scope"),
      description: b("Confirme que o objetivo é mapear a evidência (e não responder a uma pergunta de efetividade).", "Confirm the aim is to map evidence, not to answer an effectiveness question."),
      aiRole: b("Indica se a pergunta pede escopo ou outro tipo de revisão.", "Indicates whether the question calls for a scoping or another review type."),
      gate: [
        { kind: "field", field: "title", label: b("Dar um título de trabalho", "Give a working title") },
        { kind: "field", field: "area", label: b("Informar a área", "Set the area") },
      ],
      uses: ["QuestionEvaluator"],
    },
    {
      key: "protocol", title: b("Pergunta e protocolo", "Question and protocol"),
      description: b("Defina a pergunta em PCC, critérios de elegibilidade e o plano de extração. Registre o protocolo (OSF) e congele.", "Define the question in PCC, eligibility criteria and the charting plan. Register the protocol (OSF) and lock it."),
      aiRole: b("Sugere critérios e refina o PCC.", "Suggests criteria and refines the PCC."),
      gate: [
        { kind: "field", field: "framework.population", label: b("Preencher a população (P)", "Fill in the population (P)") },
        { kind: "field", field: "framework.concept", label: b("Preencher o conceito (C)", "Fill in the concept (C)") },
        { kind: "field", field: "framework.context", label: b("Preencher o contexto (C)", "Fill in the context (C)") },
        { kind: "field", field: "eligibility", label: b("Definir critérios de elegibilidade", "Define eligibility criteria") },
        { kind: "field", field: "protocol_locked_at", label: b("Congelar o protocolo", "Lock the protocol") },
      ],
      uses: ["ProtocolPanel", "generate-screening-criteria"],
    },
    strategyStage({
      description: b("Escolha as bases e inclua literatura cinzenta; revise a string de cada base.", "Choose sources, include grey literature, and review each source's string."),
    }),
    searchStage(),
    {
      key: "screening", title: b("Triagem", "Screening"),
      description: b("Comece com um piloto para calibrar os critérios entre os revisores; depois título e resumo e texto completo.", "Start with a pilot to calibrate criteria between reviewers; then title/abstract and full text."),
      aiRole: b("Apoio rotulado; não conta como voto.", "Labelled aid; it does not count as a vote."),
      gate: [
        { kind: "flag", flag: "pilot_done", label: b("Fazer o piloto de calibração dos critérios", "Run the criteria calibration pilot") },
        { kind: "count", metric: "title_abstract_done_pct", min: 100, label: b("Concluir a triagem por título e resumo", "Finish title/abstract screening") },
        { kind: "count", metric: "full_text_done_pct", min: 100, label: b("Concluir o texto completo, com motivo de exclusão", "Finish full text, with exclusion reasons") },
      ],
      uses: ["StepScreening", "DualScreeningPanel", "PrismaFlowDiagram"],
    },
    {
      key: "appraisal", title: b("Extração (charting)", "Charting"),
      description: b("Extraia os dados com o formulário do protocolo. A avaliação crítica é opcional e, se dispensada, a decisão fica registrada.", "Chart data with the protocol's form. Critical appraisal is optional; if skipped, the decision is recorded."),
      aiRole: b("Propõe valores com o trecho de origem; você confere.", "Proposes values with the source passage; you verify."),
      gate: [{ kind: "count", metric: "extraction_verified_pct", min: 100, label: b("Verificar a extração de todos os incluídos", "Verify extraction for all included studies") }],
      uses: ["StepExtraction", "extract-column"],
    },
    {
      key: "synthesis", title: b("Mapeamento e resumo", "Mapping and summary"),
      description: b("Resuma os achados de forma descritiva e temática, aponte lacunas e, se previsto, consulte partes interessadas.", "Summarise findings descriptively and thematically, point out gaps and, if planned, consult stakeholders."),
      aiRole: b("Descreve contagens e temas já calculados; os temas são sua decisão.", "Describes counts and themes already computed; themes are your call."),
      gate: [{ kind: "flag", flag: "gaps_identified", label: b("Registrar conceitos e lacunas identificados", "Record identified concepts and gaps") }],
      uses: ["Review artifacts (new)"],
    },
    writingStage(),
  ],
  references: [
    { citation: ref.arksey, role: "method" },
    { citation: ref.levac, role: "method" },
    { citation: ref.jbi, role: "method" },
    { citation: ref.prismaScr, role: "reporting" },
    { citation: ref.prismaS, role: "reporting" },
  ],
  review: { status: "verified", verifiedBy: "Sergio (proprietário do sistema)", verifiedAt: "2026-11-25" },
};
