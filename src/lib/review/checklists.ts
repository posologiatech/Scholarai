import type { Bilingual } from "./types";

export interface ChecklistItem {
  key: string;
  /** Manuscript part the guideline places the item in. */
  part: "title" | "abstract" | "introduction" | "methods" | "results" | "discussion" | "other";
  text: Bilingual;
  /** PRISMA-ScR marks critical appraisal items as optional. */
  optional?: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  /** True when this is the official statement; false when the project adapted it. */
  official: boolean;
  source: string;
  items: ChecklistItem[];
}

const i = (key: string, part: ChecklistItem["part"], pt: string, en: string, optional?: boolean): ChecklistItem => ({ key, part, text: { pt, en }, optional });

/** Items paraphrased from the PRISMA 2020 statement (Page et al., BMJ 2021;372:n71, CC BY 4.0). */
export const PRISMA_2020: Checklist = {
  id: "prisma2020", name: "PRISMA 2020", official: true, source: "Page MJ et al. BMJ 2021;372:n71",
  items: [
    i("1", "title", "Identificar o relatório como revisão sistemática", "Identify the report as a systematic review"),
    i("2", "abstract", "Resumo estruturado conforme o PRISMA 2020 para resumos", "Structured abstract following PRISMA 2020 for Abstracts"),
    i("3", "introduction", "Justificativa da revisão no contexto do conhecimento existente", "Rationale for the review in the context of existing knowledge"),
    i("4", "introduction", "Objetivos ou questões da revisão, de forma explícita", "Explicit statement of the objectives or questions"),
    i("5", "methods", "Critérios de inclusão e exclusão e como os estudos foram agrupados para a síntese", "Inclusion and exclusion criteria and how studies were grouped for syntheses"),
    i("6", "methods", "Fontes de informação (bases, registros, outras) e data da última busca", "Information sources (databases, registers, others) and date last searched"),
    i("7", "methods", "Estratégias de busca completas de todas as bases, com filtros e limites", "Full search strategies for all databases, with filters and limits"),
    i("8", "methods", "Processo de seleção: número de revisores, independência e uso de ferramentas de automação", "Selection process: number of reviewers, independence, automation tools used"),
    i("9", "methods", "Processo de coleta de dados: revisores, independência, confirmação com autores, automação", "Data collection process: reviewers, independence, author confirmation, automation"),
    i("10a", "methods", "Desfechos buscados e como foram definidos", "Outcomes sought and how they were defined"),
    i("10b", "methods", "Outras variáveis coletadas e suposições feitas quando faltavam dados", "Other variables collected and assumptions made for missing information"),
    i("11", "methods", "Método de avaliação do risco de viés: ferramenta, revisores e independência", "Risk-of-bias assessment: tool, reviewers, independence"),
    i("12", "methods", "Medidas de efeito usadas para cada desfecho", "Effect measures used for each outcome"),
    i("13a", "methods", "Como os estudos foram escolhidos para cada síntese", "How studies were eligible for each synthesis"),
    i("13b", "methods", "Preparo dos dados para a síntese (dados ausentes, conversões)", "Data preparation for synthesis (missing data, conversions)"),
    i("13c", "methods", "Métodos para tabular ou exibir os resultados", "Methods to tabulate or visually display results"),
    i("13d", "methods", "Métodos de síntese, incluindo modelo e software", "Synthesis methods, including model and software"),
    i("13e", "methods", "Métodos para explorar a heterogeneidade", "Methods to explore heterogeneity"),
    i("13f", "methods", "Análises de sensibilidade", "Sensitivity analyses"),
    i("14", "methods", "Métodos para avaliar o risco de viés por resultados ausentes (viés de relato)", "Methods to assess risk of bias due to missing results (reporting bias)"),
    i("15", "methods", "Métodos para avaliar a certeza da evidência (por exemplo, GRADE)", "Methods to assess certainty of evidence (e.g. GRADE)"),
    i("16a", "results", "Resultado das buscas e da seleção, preferencialmente com fluxograma", "Results of searches and selection, preferably with a flow diagram"),
    i("16b", "results", "Estudos que pareciam elegíveis mas foram excluídos, com os motivos", "Studies that seemed eligible but were excluded, with reasons"),
    i("17", "results", "Características de cada estudo incluído", "Characteristics of each included study"),
    i("18", "results", "Risco de viés de cada estudo incluído", "Risk of bias of each included study"),
    i("19", "results", "Resultados de cada estudo individual", "Results of each individual study"),
    i("20a", "results", "Características e risco de viés entre os estudos de cada síntese", "Characteristics and risk of bias among studies in each synthesis"),
    i("20b", "results", "Resultados de todas as sínteses estatísticas, com medida de precisão", "Results of all statistical syntheses, with precision"),
    i("20c", "results", "Investigações de causas de heterogeneidade", "Investigations of causes of heterogeneity"),
    i("20d", "results", "Resultados das análises de sensibilidade", "Results of sensitivity analyses"),
    i("21", "results", "Risco de viés por resultados ausentes em cada síntese", "Risk of bias due to missing results for each synthesis"),
    i("22", "results", "Certeza da evidência para cada desfecho", "Certainty of evidence for each outcome"),
    i("23a", "discussion", "Interpretação geral dos resultados no contexto de outras evidências", "General interpretation of the results in the context of other evidence"),
    i("23b", "discussion", "Limitações da evidência incluída", "Limitations of the evidence included"),
    i("23c", "discussion", "Limitações dos processos da revisão", "Limitations of the review processes"),
    i("23d", "discussion", "Implicações para a prática, a política e a pesquisa futura", "Implications for practice, policy and future research"),
    i("24a", "other", "Registro da revisão e número de registro, ou declaração de que não foi registrada", "Registration information including register name and number, or statement that not registered"),
    i("24b", "other", "Onde acessar o protocolo, ou declaração de que não foi preparado", "Where the protocol can be accessed, or that none was prepared"),
    i("24c", "other", "Alterações em relação ao protocolo ou registro", "Amendments to the information in the registration or protocol"),
    i("25", "other", "Fontes de apoio financeiro e não financeiro e papel dos financiadores", "Sources of financial or non-financial support and role of funders"),
    i("26", "other", "Conflitos de interesse dos autores", "Competing interests of the authors"),
    i("27", "other", "Disponibilidade de dados, código e outros materiais", "Availability of data, code and other materials"),
  ],
};

/** Items paraphrased from PRISMA-ScR (Tricco et al., Ann Intern Med 2018;169:467-473): 22 items, 20 essential. */
export const PRISMA_SCR: Checklist = {
  id: "prisma-scr", name: "PRISMA-ScR", official: true, source: "Tricco AC et al. Ann Intern Med 2018;169:467-473",
  items: [
    i("1", "title", "Identificar o relatório como revisão de escopo", "Identify the report as a scoping review"),
    i("2", "abstract", "Resumo estruturado com contexto, objetivos, critérios, fontes, métodos, resultados e conclusões", "Structured summary with background, objectives, eligibility, sources, methods, results and conclusions"),
    i("3", "introduction", "Justificativa da revisão no contexto do que já se sabe, e por que uma revisão de escopo", "Rationale in the context of existing knowledge, and why a scoping approach"),
    i("4", "introduction", "Objetivos e questões, em geral por população, conceito e contexto", "Objectives and questions, usually by population, concept and context"),
    i("5", "methods", "Protocolo e registro: onde acessar e número de registro", "Protocol and registration: where it can be accessed and registration number"),
    i("6", "methods", "Critérios de elegibilidade e sua justificativa", "Eligibility criteria and their rationale"),
    i("7", "methods", "Fontes de informação e data da última busca", "Information sources and date last searched"),
    i("8", "methods", "Estratégia de busca completa de ao menos uma base, que permita repetição", "Full search strategy for at least one database so it could be repeated"),
    i("9", "methods", "Processo de seleção das fontes de evidência", "Process for selecting sources of evidence"),
    i("10", "methods", "Processo de extração (charting), incluindo teste do formulário e independência", "Data charting process, including piloting the form and independence"),
    i("11", "methods", "Variáveis extraídas e suposições feitas", "Data items charted and assumptions made"),
    i("12", "methods", "Avaliação crítica das fontes, se feita, e como", "Critical appraisal of sources, if done, and how", true),
    i("13", "methods", "Métodos para resumir e apresentar os resultados", "Methods of handling and summarising the data"),
    i("14", "results", "Número de fontes triadas, avaliadas e incluídas, com motivos de exclusão e fluxograma", "Numbers of sources screened, assessed and included, with reasons and a flow diagram"),
    i("15", "results", "Características das fontes incluídas", "Characteristics of the sources included"),
    i("16", "results", "Avaliação crítica de cada fonte, se feita", "Critical appraisal of each source, if done", true),
    i("17", "results", "Resultados de cada fonte incluída, relacionados às questões", "Results for each source, related to the questions"),
    i("18", "results", "Síntese dos resultados relacionados às questões", "Synthesis of results related to the questions"),
    i("19", "discussion", "Resumo da evidência, relacionado aos objetivos e a quem interessa", "Summary of the evidence, tied to the objectives and relevant groups"),
    i("20", "discussion", "Limitações do processo da revisão", "Limitations of the scoping review process"),
    i("21", "discussion", "Conclusões gerais e implicações para pesquisa, prática e política", "General conclusions and implications for research, practice and policy"),
    i("22", "other", "Fontes de financiamento e papel dos financiadores", "Sources of funding and role of funders"),
  ],
};

/**
 * There is no official reporting checklist for integrative reviews. This list follows the five
 * stages of Whittemore and Knafl (2005) and borrows PRISMA's flow and search items. The UI says
 * it is an adaptation so nobody cites it as an official guideline.
 */
export const INTEGRATIVE_ADAPTED: Checklist = {
  id: "prisma-adapted", name: "Whittemore e Knafl (adaptado)", official: false, source: "Whittemore R, Knafl K. J Adv Nurs 2005;52:546-553, with PRISMA 2020 flow and search items",
  items: [
    i("1", "title", "Identificar o relatório como revisão integrativa", "Identify the report as an integrative review"),
    i("2", "abstract", "Resumo com problema, método, resultados e conclusões", "Abstract with problem, method, results and conclusions"),
    i("3", "introduction", "Identificação do problema e justificativa da revisão", "Problem identification and rationale for the review"),
    i("4", "introduction", "Propósito e pergunta norteadora", "Purpose and guiding question"),
    i("5", "methods", "Critérios de inclusão e exclusão, incluindo métodos de estudo aceitos", "Inclusion and exclusion criteria, including accepted study methods"),
    i("6", "methods", "Fontes de informação e data da última busca", "Information sources and date last searched"),
    i("7", "methods", "Estratégia de busca descrita de forma que permita repetição", "Search strategy described so it can be repeated"),
    i("8", "methods", "Processo de seleção e número de revisores", "Selection process and number of reviewers"),
    i("9", "methods", "Avaliação dos dados: ferramenta de qualidade por desenho e classificação do nível de evidência", "Data evaluation: quality tool by design and level-of-evidence classification"),
    i("10", "methods", "Análise: redução, exibição em matriz, comparação constante e verificação das conclusões", "Analysis: data reduction, matrix display, constant comparison and verification of conclusions"),
    i("11", "results", "Fluxograma e número de estudos em cada etapa, com motivos de exclusão", "Flow diagram and numbers at each stage, with reasons for exclusion"),
    i("12", "results", "Características dos estudos incluídos e sua qualidade", "Characteristics and quality of included studies"),
    i("13", "results", "Síntese em temas, com a matriz de evidências", "Synthesis in themes, with the evidence matrix"),
    i("14", "discussion", "Interpretação, limitações e implicações para prática e pesquisa", "Interpretation, limitations and implications for practice and research"),
    i("15", "other", "Financiamento, conflitos de interesse e uso de IA", "Funding, competing interests and use of AI"),
  ],
};

export const CHECKLISTS: Record<string, Checklist> = { prisma2020: PRISMA_2020, "prisma-scr": PRISMA_SCR, "prisma-adapted": INTEGRATIVE_ADAPTED };
export const checklistFor = (guidelineId: string): Checklist => CHECKLISTS[guidelineId] ?? PRISMA_2020;

export type ItemStatus = "met" | "partial" | "missing" | "not_applicable";
