import { b, ref, searchStage, strategyStage, writingStage } from "./common";
import type { ReviewTypeDef } from "./schema";

export const integrative: ReviewTypeDef = {
  id: "integrative",
  version: "0.1.0",
  label: b("Revisão integrativa", "Integrative review"),
  summary: b(
    "Combina estudos de métodos diferentes (experimentais, não experimentais, qualitativos, teóricos) para uma compreensão ampla de um fenômeno, seguindo as etapas de Whittemore e Knafl.",
    "Combines studies of different methods (experimental, non-experimental, qualitative, theoretical) for a broad understanding of a phenomenon, following Whittemore and Knafl's stages.",
  ),
  framework: {
    name: "Problem / population / variables",
    fields: [
      { key: "problem", label: b("Problema de revisão", "Review problem"), hint: b("Que questão a revisão responde e por que importa?", "What question does the review answer and why does it matter?"), required: true },
      { key: "population", label: b("População ou fenômeno", "Population or phenomenon"), hint: b("Foco do estudo", "Focus of study"), required: true },
      { key: "variables", label: b("Variáveis de interesse", "Variables of interest"), hint: b("Conceitos, intervenções, desfechos", "Concepts, interventions, outcomes"), required: false },
    ],
  },
  registry: { name: "OSF Registries", url: "https://osf.io/registries", required: false },
  reportingGuideline: { id: "prisma-adapted", name: "Etapas de Whittemore e Knafl + fluxograma PRISMA adaptado" },
  appraisal: {
    required: true,
    tools: [
      { id: "mmat", label: "MMAT 2018", appliesTo: b("Estudos qualitativos, quantitativos e de métodos mistos", "Qualitative, quantitative and mixed-methods studies"), required: false },
      { id: "casp", label: "CASP", appliesTo: b("Alternativa por desenho", "Alternative by design"), required: false },
    ],
  },
  screening: { dual: "recommended", phases: ["title_abstract", "full_text"] },
  synthesis: b(
    "Redução dos dados, exibição em matriz, comparação constante, conclusão e verificação.",
    "Data reduction, matrix display, constant comparison, conclusion drawing and verification.",
  ),
  extractionFields: [
    { key: "authors_year", label: b("Autores e ano", "Authors and year"), kind: "text" },
    { key: "method", label: b("Método (quantitativo, qualitativo, misto, teórico)", "Method (quantitative, qualitative, mixed, theoretical)"), kind: "choice", choices: ["quantitative", "qualitative", "mixed", "theoretical", "other"] },
    { key: "aims", label: b("Objetivo", "Aims"), kind: "text" },
    { key: "sample", label: b("Amostra e cenário", "Sample and setting"), kind: "text" },
    { key: "findings", label: b("Principais achados", "Main findings"), kind: "list" },
    { key: "evidence_level", label: b("Nível de evidência", "Level of evidence"), kind: "text" },
    { key: "theme_codes", label: b("Códigos temáticos", "Thematic codes"), kind: "list" },
  ],
  artifacts: [
    { kind: "prisma_flow", label: b("Fluxograma de seleção", "Selection flow diagram"), type: "figure" },
    { kind: "theme_map", label: b("Mapa temático", "Thematic map"), type: "figure" },
    { kind: "distribution", label: b("Distribuição por método e ano", "Distribution by method and year"), type: "figure" },
    { kind: "search_appendix", label: b("Estratégia de busca por base", "Search strategy by source"), type: "table" },
    { kind: "synthesis_matrix", label: b("Matriz de síntese dos estudos", "Study synthesis matrix"), type: "table" },
    { kind: "method_evidence", label: b("Classificação por método e nível de evidência", "Classification by method and level of evidence"), type: "table" },
  ],
  stages: [
    {
      key: "scope", title: b("Identificação do problema", "Problem identification"),
      description: b("Delimite o problema, o propósito da revisão e as variáveis de interesse.", "Delimit the problem, the purpose of the review and the variables of interest."),
      aiRole: b("Ajuda a delimitar o problema e verifica se uma revisão integrativa é adequada.", "Helps delimit the problem and checks whether an integrative review fits."),
      gate: [
        { kind: "field", field: "title", label: b("Dar um título de trabalho", "Give a working title") },
        { kind: "field", field: "framework.problem", label: b("Descrever o problema de revisão", "Describe the review problem") },
        { kind: "field", field: "area", label: b("Informar a área", "Set the area") },
      ],
      uses: ["QuestionEvaluator"],
    },
    {
      key: "protocol", title: b("Pergunta e critérios", "Question and criteria"),
      description: b("Escreva a pergunta norteadora e critérios amplos o bastante para incluir métodos diversos. Congele o protocolo.", "Write the guiding question and criteria broad enough to include diverse methods. Lock the protocol."),
      aiRole: b("Sugere critérios; você decide.", "Suggests criteria; you decide."),
      gate: [
        { kind: "field", field: "question", label: b("Escrever a pergunta norteadora", "Write the guiding question") },
        { kind: "field", field: "eligibility", label: b("Definir critérios de inclusão e exclusão", "Define inclusion and exclusion criteria") },
        { kind: "field", field: "protocol_locked_at", label: b("Congelar o protocolo", "Lock the protocol") },
      ],
      uses: ["ProtocolPanel", "generate-screening-criteria"],
    },
    strategyStage(),
    searchStage(),
    {
      key: "screening", title: b("Triagem", "Screening"),
      description: b("Selecione estudos de qualquer método que atendam aos critérios; registre os motivos de exclusão.", "Select studies of any method meeting the criteria; record exclusion reasons."),
      aiRole: b("Apoio rotulado; não conta como voto.", "Labelled aid; it does not count as a vote."),
      gate: [
        { kind: "count", metric: "title_abstract_done_pct", min: 100, label: b("Concluir a triagem por título e resumo", "Finish title/abstract screening") },
        { kind: "count", metric: "full_text_done_pct", min: 100, label: b("Concluir o texto completo, com motivo de exclusão", "Finish full text, with exclusion reasons") },
      ],
      uses: ["StepScreening", "PrismaFlowDiagram"],
    },
    {
      key: "appraisal", title: b("Avaliação dos dados", "Data evaluation"),
      description: b("Avalie a qualidade de cada estudo conforme seu método (MMAT) e classifique o nível de evidência.", "Appraise each study by its method (MMAT) and classify the level of evidence."),
      aiRole: b("Propõe a avaliação com o trecho de origem; você confere.", "Proposes the appraisal with the source passage; you verify."),
      gate: [
        { kind: "count", metric: "extraction_verified_pct", min: 100, label: b("Verificar a extração de todos os incluídos", "Verify extraction for all included studies") },
        { kind: "count", metric: "appraisal_done_pct", min: 100, label: b("Avaliar a qualidade de todos os incluídos", "Appraise all included studies") },
      ],
      uses: ["StepExtraction", "StepQuality"],
    },
    {
      key: "synthesis", title: b("Análise dos dados", "Data analysis"),
      description: b("Reduza os achados a códigos, exiba em matriz, compare de forma constante e extraia conclusões.", "Reduce findings to codes, display them in a matrix, compare constantly and draw conclusions."),
      aiRole: b("Propõe agrupamentos de códigos; os temas finais são sua decisão e ficam registrados.", "Proposes code groupings; final themes are your call and are recorded."),
      gate: [
        { kind: "flag", flag: "matrix_built", label: b("Montar a matriz de síntese", "Build the synthesis matrix") },
        { kind: "flag", flag: "themes_confirmed", label: b("Confirmar os temas e conclusões", "Confirm themes and conclusions") },
      ],
      uses: ["Review artifacts (new)"],
    },
    writingStage({ title: b("Apresentação", "Presentation") }),
  ],
  references: [
    { citation: ref.whittemore, role: "method" },
    { citation: ref.mmat, role: "appraisal" },
    { citation: ref.prisma2020, role: "reporting" },
  ],
  review: { status: "verified", verifiedBy: "Sergio (proprietário do sistema)", verifiedAt: "2026-11-25" },
};
