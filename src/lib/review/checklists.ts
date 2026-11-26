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

/** Items paraphrased from ENTREQ (Tong et al., BMC Med Res Methodol 2012;12:181): 21 items for qualitative evidence synthesis. */
export const ENTREQ: Checklist = {
  id: "entreq", name: "ENTREQ", official: true, source: "Tong A et al. BMC Med Res Methodol 2012;12:181",
  items: [
    i("1", "introduction", "Objetivo da síntese", "Aim of the synthesis"),
    i("2", "methods", "Metodologia ou referencial teórico da síntese", "Synthesis methodology or theoretical framework"),
    i("3", "methods", "Abordagem de busca: planejada de antemão ou iterativa", "Approach to searching: pre-planned or iterative"),
    i("4", "methods", "Critérios de inclusão e exclusão (população, idioma, período, tipo de publicação e de estudo)", "Inclusion criteria (population, language, years, publication and study type)"),
    i("5", "methods", "Fontes de informação usadas e quando as buscas foram feitas", "Information sources used and when the searches were conducted"),
    i("6", "methods", "Estratégia de busca eletrônica, com termos e filtros para pesquisa qualitativa", "Electronic search strategy, with terms and filters for qualitative research"),
    i("7", "methods", "Processo de triagem e seleção dos estudos", "Process of study screening and sifting"),
    i("8", "results", "Características dos estudos incluídos", "Characteristics of the included studies"),
    i("9", "results", "Número de estudos triados e motivos de exclusão", "Number of studies screened and reasons for exclusion"),
    i("10", "methods", "Justificativa e abordagem da avaliação dos estudos", "Rationale and approach used to appraise the studies"),
    i("11", "methods", "Instrumentos, referenciais e critérios usados na avaliação", "Tools, frameworks and criteria used to appraise"),
    i("12", "methods", "Se a avaliação foi independente e se exigiu consenso", "Whether appraisal was independent and whether consensus was required"),
    i("13", "results", "Resultados da avaliação e se algum estudo foi excluído ou ponderado por ela", "Appraisal results and whether any study was weighted or excluded because of it"),
    i("14", "methods", "Quais partes dos estudos foram analisadas e como os dados foram extraídos", "Which sections of the studies were analysed and how data were extracted"),
    i("15", "methods", "Software usado, se algum", "Software used, if any"),
    i("16", "methods", "Quem codificou e analisou os dados", "Who coded and analysed the data"),
    i("17", "methods", "Processo de codificação dos dados", "Process for coding the data"),
    i("18", "methods", "Como as comparações foram feitas dentro e entre estudos", "How comparisons were made within and across studies"),
    i("19", "methods", "Se os temas foram derivados de forma indutiva ou dedutiva", "Whether themes were derived inductively or deductively"),
    i("20", "results", "Citações dos estudos primários que ilustram os temas, indicando se são dos participantes ou interpretação dos autores", "Quotations that illustrate themes, identifying participant quotes versus authors interpretation"),
    i("21", "results", "Resultados da síntese que vão além de um resumo dos estudos primários", "Synthesis output that goes beyond a summary of the primary studies"),
  ],
};

/** SANRA (Baethge et al., Res Integr Peer Rev 2019;4:5): six quality items for narrative review articles. */
export const SANRA: Checklist = {
  id: "sanra", name: "SANRA", official: true, source: "Baethge C et al. Res Integr Peer Rev 2019;4:5",
  items: [
    i("1", "introduction", "Justificativa da importância do tema para o leitor", "Justification of the topic importance for the readership"),
    i("2", "introduction", "Declaração dos objetivos ou questões concretas do artigo", "Statement of concrete aims or formulation of questions"),
    i("3", "methods", "Descrição da busca na literatura", "Description of the literature search"),
    i("4", "results", "Referenciamento: as afirmações-chave estão apoiadas em referências", "Referencing: key statements are supported by references"),
    i("5", "discussion", "Raciocínio científico: nível de evidência e argumentação apropriados", "Scientific reasoning: appropriate evidence level and argumentation"),
    i("6", "results", "Apresentação apropriada dos dados", "Appropriate presentation of data"),
  ],
};

/** No official umbrella list is reproduced here (PRIOR is the reference); this PRISMA-derived list is an aid, not the guideline. */
export const UMBRELLA_ADAPTED: Checklist = {
  id: "umbrella-adapted", name: "PRISMA 2020 adaptado (guarda-chuva)", official: false, source: "Adapted from PRISMA 2020; consult the PRIOR statement (Gates et al., BMJ 2022) for the official list",
  items: [
    i("1", "title", "Identificar o relatório como revisão guarda-chuva (revisão de revisões)", "Identify the report as an umbrella review (overview of reviews)"),
    i("2", "abstract", "Resumo estruturado", "Structured abstract"),
    i("3", "introduction", "Justificativa, incluindo o que já existe em revisões sobre o tema", "Rationale, including what existing reviews on the topic show"),
    i("4", "introduction", "Objetivos e questão, com os tipos de revisão elegíveis", "Objectives and question, with the eligible review types"),
    i("5", "methods", "Critérios de elegibilidade das revisões", "Eligibility criteria for reviews"),
    i("6", "methods", "Fontes de informação e data da última busca", "Information sources and date last searched"),
    i("7", "methods", "Estratégia de busca completa", "Full search strategy"),
    i("8", "methods", "Processo de seleção das revisões e número de revisores", "Process for selecting reviews and number of reviewers"),
    i("9", "methods", "Extração de dados das revisões", "Data extraction from the reviews"),
    i("10", "methods", "Avaliação da qualidade das revisões (por exemplo, AMSTAR 2) e revisores", "Quality appraisal of the reviews (e.g. AMSTAR 2) and reviewers"),
    i("11", "methods", "Método para avaliar a sobreposição de estudos primários entre as revisões", "Method to assess overlap of primary studies between reviews"),
    i("12", "methods", "Métodos de síntese", "Synthesis methods"),
    i("13", "results", "Fluxograma da seleção, com motivos de exclusão", "Selection flow diagram, with reasons for exclusion"),
    i("14", "results", "Características das revisões incluídas", "Characteristics of the included reviews"),
    i("15", "results", "Qualidade das revisões incluídas", "Quality of the included reviews"),
    i("16", "results", "Grau de sobreposição e como foi tratado", "Degree of overlap and how it was handled"),
    i("17", "results", "Resultados da síntese", "Results of the synthesis"),
    i("18", "discussion", "Interpretação, limitações e implicações", "Interpretation, limitations and implications"),
    i("19", "other", "Registro e protocolo", "Registration and protocol"),
    i("20", "other", "Financiamento, conflitos de interesse, dados e uso de IA", "Funding, competing interests, data and use of AI"),
  ],
};

/** The RAMESES publication standards are not reproduced from memory; this list follows the realist review process and is an aid only. */
export const REALIST_ADAPTED: Checklist = {
  id: "realist-adapted", name: "Revisão realista (adaptado)", official: false, source: "Adapted from the realist review process (Pawson et al.); consult the RAMESES publication standards (Wong et al., BMC Med 2013) for the official list",
  items: [
    i("1", "title", "Identificar o relatório como revisão realista", "Identify the report as a realist review"),
    i("2", "abstract", "Resumo com questão, método, achados e conclusões", "Abstract with question, method, findings and conclusions"),
    i("3", "introduction", "Justificativa e por que uma abordagem realista", "Rationale and why a realist approach"),
    i("4", "introduction", "Objetivos e foco: o que funciona, para quem, em que circunstâncias e por quê", "Objectives and focus: what works, for whom, in what circumstances and why"),
    i("5", "methods", "Teoria inicial do programa e como foi construída", "Initial program theory and how it was built"),
    i("6", "methods", "Processo de busca, que pode ser iterativo, e as fontes", "Search process, which may be iterative, and sources"),
    i("7", "methods", "Seleção dos documentos por relevância e rigor", "Selecting documents by relevance and rigour"),
    i("8", "methods", "Extração de dados: contexto, mecanismo e resultado", "Data extraction: context, mechanism and outcome"),
    i("9", "methods", "Análise e síntese, incluindo o refinamento da teoria", "Analysis and synthesis, including refining the theory"),
    i("10", "results", "Fluxo dos documentos e motivos de exclusão", "Document flow and reasons for exclusion"),
    i("11", "results", "Características dos documentos incluídos", "Characteristics of the included documents"),
    i("12", "results", "Configurações contexto-mecanismo-resultado e a teoria refinada", "Context-mechanism-outcome configurations and the refined theory"),
    i("13", "discussion", "Resumo dos achados e relação com a literatura existente", "Summary of findings and link to the existing literature"),
    i("14", "discussion", "Pontos fortes, limitações e implicações", "Strengths, limitations and implications"),
    i("15", "other", "Financiamento, conflitos de interesse e uso de IA", "Funding, competing interests and use of AI"),
  ],
};

export const CHECKLISTS: Record<string, Checklist> = {
  prisma2020: PRISMA_2020, "prisma-scr": PRISMA_SCR, "prisma-adapted": INTEGRATIVE_ADAPTED, entreq: ENTREQ, sanra: SANRA, "umbrella-adapted": UMBRELLA_ADAPTED, "realist-adapted": REALIST_ADAPTED,
};
export const checklistFor = (guidelineId: string): Checklist => CHECKLISTS[guidelineId] ?? PRISMA_2020;

export type ItemStatus = "met" | "partial" | "missing" | "not_applicable";
