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
  /** "appraisal" for instruments that grade a finished review (SANRA) rather than say what to report. */
  kind?: "reporting" | "appraisal";
  source: string;
  /** Date the item list was compared with the official publication (ISO), and what it was compared with. */
  checkedOn?: string;
  checkedWith?: string;
  items: ChecklistItem[];
}

const i = (key: string, part: ChecklistItem["part"], pt: string, en: string, optional?: boolean): ChecklistItem => ({ key, part, text: { pt, en }, optional });

/** Items paraphrased from the PRISMA 2020 statement (Page et al., BMJ 2021;372:n71, CC BY 4.0). */
export const PRISMA_2020: Checklist = {
  id: "prisma2020", name: "PRISMA 2020", official: true, source: "Page MJ et al. BMJ 2021;372:n71 (CC BY 4.0)",
  checkedOn: "2026-11-26", checkedWith: "prisma-statement.org checklist (Word file, 2025)",
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
    i("19", "results", "Resultados de cada estudo: estatísticas por grupo e estimativa de efeito com sua precisão", "Results of each study: summary statistics per group and an effect estimate with its precision"),
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
  checkedOn: "2026-11-26", checkedWith: "prisma-statement.org checklist (Word file, 2019)",
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
  id: "entreq", name: "ENTREQ", official: true, source: "Tong A et al. BMC Med Res Methodol 2012;12:181 (CC BY 2.0)",
  checkedOn: "2026-11-26", checkedWith: "Table 1 of the article (Europe PMC PMC3552766)",
  items: [
    i("1", "introduction", "Pergunta de pesquisa que a síntese responde", "The research question the synthesis addresses"),
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

/**
 * SANRA (Baethge et al., Res Integr Peer Rev 2019;4:5). The authors state it is "a critical appraisal tool and not a
 * reporting guideline": six items, each scored 0 to 2, on the importance and aims of the review, the literature search,
 * referencing, evidence level and relevant endpoint data.
 */
export const SANRA: Checklist = {
  id: "sanra", name: "SANRA", official: true, kind: "appraisal", source: "Baethge C et al. Res Integr Peer Rev 2019;4:5 (CC BY 4.0)",
  checkedOn: "2026-11-26", checkedWith: "Article text (Europe PMC PMC6434870); the item descriptions are the authors' summary, the anchor definitions were not read",
  items: [
    i("1", "introduction", "Explicação da importância da revisão para o leitor", "Explanation of the importance of the review"),
    i("2", "introduction", "Declaração dos objetivos ou das questões da revisão", "Statement of the aims or questions of the review"),
    i("3", "methods", "Descrição da busca na literatura", "Description of the literature search"),
    i("4", "results", "Referenciamento: as afirmações-chave têm referência", "Referencing: key statements are referenced"),
    i("5", "discussion", "Apresentação do nível de evidência", "Presentation of the level of evidence"),
    i("6", "results", "Apresentação dos dados relevantes de desfecho", "Presentation of relevant endpoint data"),
  ],
};

/**
 * PRIOR (Gates et al., BMJ 2022;378:e070849): 27 main items, 46 with sub-items. Numbering follows the statement; the
 * wording is a short paraphrase. The article is published under CC BY-NC 4.0, so confirm that a commercial product
 * may carry even paraphrased items before relying on this list.
 */
export const PRIOR: Checklist = {
  id: "prior", name: "PRIOR", official: true, source: "Gates M et al. BMJ 2022;378:e070849 (CC BY-NC 4.0)",
  checkedOn: "2026-11-26", checkedWith: "Table 2 of the article (Europe PMC PMC9361065)",
  items: [
    i("1", "title", "Identificar o relatório como uma revisão de revisões", "Identify the report as an overview of reviews"),
    i("2", "abstract", "Resumo completo e preciso do objetivo, dos métodos e dos resultados", "Comprehensive and accurate summary of purpose, methods and results"),
    i("3", "introduction", "Justificativa da revisão de revisões no contexto do conhecimento existente", "Rationale for the overview in the context of existing knowledge"),
    i("4", "introduction", "Objetivos ou questões, de forma explícita", "Explicit objectives or questions"),
    i("5a", "methods", "Critérios de inclusão e exclusão; se estudos primários complementares entraram, dizer e justificar", "Inclusion and exclusion criteria; if supplemental primary studies were included, say so and justify"),
    i("5b", "methods", "Definição de \"revisão sistemática\" usada nos critérios", "Definition of \"systematic review\" used in the criteria"),
    i("6", "methods", "Todas as fontes pesquisadas e a data da última busca de cada uma", "All sources searched and the date each was last searched"),
    i("7", "methods", "Estratégias de busca completas, reprodutíveis, com filtros e limites", "Full, reproducible search strategies with filters and limits"),
    i("8a", "methods", "Métodos para decidir se uma revisão atendia aos critérios", "Methods to decide whether a review met the criteria"),
    i("8b", "methods", "Como a sobreposição de populações, intervenções, comparadores e desfechos foi identificada e tratada na seleção", "How overlap in populations, interventions, comparators and outcomes was identified and managed during selection"),
    i("9a", "methods", "Métodos de coleta de dados dos relatos", "Methods to collect data from reports"),
    i("9b", "methods", "Como a sobreposição de estudos primários foi identificada, tratada e quantificada para cada desfecho", "How primary-study overlap was identified, managed and quantified for each outcome"),
    i("9c", "methods", "Como dados discrepantes entre as revisões foram tratados", "How discrepant data across reviews were handled"),
    i("10", "methods", "Variáveis e desfechos buscados, suposições e medidas para dados ausentes ou pouco claros", "Variables and outcomes sought, assumptions, and measures for missing or unclear information"),
    i("11a", "methods", "Métodos para avaliar o risco de viés ou a qualidade metodológica das revisões incluídas", "Methods to assess risk of bias or methodological quality of the included reviews"),
    i("11b", "methods", "Como o risco de viés dos estudos primários foi coletado ou reavaliado, justificando avaliações falhas não reavaliadas", "How primary-study risk of bias was collected or reassessed, justifying flawed assessments not reassessed"),
    i("11c", "methods", "Avaliação do risco de viés dos estudos primários complementares, se houver", "Risk-of-bias assessment of supplemental primary studies, if any"),
    i("12a", "methods", "Métodos para resumir ou sintetizar os resultados, com a justificativa", "Methods to summarise or synthesise results, with rationale"),
    i("12b", "methods", "Métodos para explorar causas de heterogeneidade", "Methods to explore causes of heterogeneity"),
    i("12c", "methods", "Análises de sensibilidade", "Sensitivity analyses"),
    i("13", "methods", "Métodos para coletar ou avaliar o risco de viés por resultados ausentes (viés de relato)", "Methods to collect or assess risk of bias due to missing results (reporting biases)"),
    i("14", "methods", "Métodos para coletar ou avaliar a certeza da evidência de cada desfecho", "Methods to collect or assess certainty of evidence for each outcome"),
    i("15a", "results", "Resultado da busca e da seleção, com fluxograma", "Results of the search and selection, with a flow diagram"),
    i("15b", "results", "Lista das revisões que pareciam elegíveis mas foram excluídas, com o motivo principal", "List of reviews that seemed eligible but were excluded, with the main reason"),
    i("16", "results", "Cada revisão incluída e suas características", "Each included review and its characteristics"),
    i("17", "results", "Extensão da sobreposição de estudos primários entre as revisões", "Extent of primary-study overlap across the reviews"),
    i("18a", "results", "Risco de viés ou qualidade metodológica de cada revisão incluída", "Risk of bias or methodological quality of each included review"),
    i("18b", "results", "Risco de viés dos estudos primários das revisões", "Risk of bias of the primary studies in the reviews"),
    i("18c", "results", "Risco de viés dos estudos primários complementares, se houver", "Risk of bias of supplemental primary studies, if any"),
    i("19a", "results", "Resumo da evidência para todos os desfechos, com estimativas e precisão quando houve meta-análise", "Summary of evidence for all outcomes, with estimates and precision when meta-analysed"),
    i("19b", "results", "Resultados das investigações de heterogeneidade, se houve meta-análise", "Results of heterogeneity investigations, if meta-analysed"),
    i("19c", "results", "Resultados das análises de sensibilidade, se houve meta-análise", "Results of sensitivity analyses, if meta-analysed"),
    i("20", "results", "Risco de viés por resultados ausentes em cada síntese", "Risk of bias due to missing results for each synthesis"),
    i("21", "results", "Certeza da evidência de cada desfecho", "Certainty of evidence for each outcome"),
    i("22a", "discussion", "Principais achados, incluindo discrepâncias entre as revisões", "Main findings, including discrepancies across reviews"),
    i("22b", "discussion", "Interpretação geral no contexto de outras evidências", "General interpretation in the context of other evidence"),
    i("22c", "discussion", "Limitações da evidência e dos métodos da revisão de revisões", "Limitations of the evidence and of the overview methods"),
    i("22d", "discussion", "Implicações para a prática, a política e a pesquisa futura", "Implications for practice, policy and future research"),
    i("23a", "other", "Registro, com nome e número, ou declaração de que não foi registrada", "Registration with name and number, or a statement that it was not registered"),
    i("23b", "other", "Onde acessar o protocolo, ou declaração de que não houve", "Where to access the protocol, or that none was prepared"),
    i("23c", "other", "Alterações em relação ao protocolo e em que etapa ocorreram", "Amendments to the protocol and the stage at which they occurred"),
    i("24", "other", "Apoio financeiro e não financeiro e papel dos financiadores", "Financial and non-financial support and the role of funders"),
    i("25", "other", "Conflitos de interesse dos autores", "Competing interests of the authors"),
    i("26a", "other", "Contato do autor correspondente", "Contact information of the corresponding author"),
    i("26b", "other", "Contribuição de cada autor e quem é o garantidor", "Each author's contribution and who the guarantor is"),
    i("27", "other", "Disponibilidade de formulários, dados, código e outros materiais, e em que condições", "Availability of forms, data, code and other materials, and under what conditions"),
  ],
};

/** RAMESES publication standards for realist syntheses (Wong et al., BMC Med 2013;11:21): 19 standards. */
export const RAMESES: Checklist = {
  id: "rameses", name: "RAMESES (síntese realista)", official: true, source: "Wong G et al. BMC Med 2013;11:21 (CC BY 2.0)",
  checkedOn: "2026-11-26", checkedWith: "Table 1 of the article (Europe PMC PMC3558331)",
  items: [
    i("1", "title", "No título, identificar o documento como síntese ou revisão realista", "In the title, identify the document as a realist synthesis or review"),
    i("2", "abstract", "Resumo com contexto, questão, busca, métodos de seleção, avaliação, análise e síntese, principais resultados e implicações", "Abstract with background, question, search, methods of selection, appraisal, analysis and synthesis, main results and implications"),
    i("3", "introduction", "Justificativa: por que a revisão é necessária e o que ela deve acrescentar", "Rationale: why the review is needed and what it should add"),
    i("4", "introduction", "Objetivos ou questões da revisão e justificativa do foco", "Objectives or questions of the review and rationale for the focus"),
    i("5", "methods", "Mudanças no processo originalmente planejado, descritas e justificadas", "Changes to the originally planned process, described and justified"),
    i("6", "methods", "Por que a síntese realista foi considerada o método mais adequado", "Why realist synthesis was the most appropriate method"),
    i("7", "methods", "Processo inicial de exploração (escopo) da literatura, descrito e justificado", "Initial exploratory scoping of the literature, described and justified"),
    i("8", "methods", "Como a busca iterativa foi feita, com todas as fontes, termos, datas de cobertura e data da última busca", "How the iterative searching was done, with all sources, terms, coverage dates and date last searched"),
    i("9", "methods", "Como os documentos foram incluídos ou excluídos e avaliados, com justificativa", "How documents were included, excluded and appraised, with justification"),
    i("10", "methods", "Quais dados foram extraídos dos documentos e por quê", "Which data were extracted from the documents and why"),
    i("11", "methods", "Processos de análise e síntese em detalhe, incluindo os construtos analisados", "Analysis and synthesis processes in detail, including the constructs analysed"),
    i("12", "results", "Fluxo dos documentos avaliados e incluídos, com motivos de exclusão e origem", "Flow of documents assessed and included, with reasons for exclusion and source"),
    i("13", "results", "Características dos documentos incluídos", "Characteristics of the included documents"),
    i("14", "results", "Principais achados, com foco na construção e no teste de teoria", "Main findings, focused on theory building and testing"),
    i("15", "discussion", "Resumo dos achados à luz dos objetivos, do foco e do público", "Summary of findings in light of the objectives, focus and audience"),
    i("16", "discussion", "Pontos fortes, limitações e direções de pesquisa futura, incluindo a força da evidência das explicações", "Strengths, limitations and future research, including the strength of evidence behind the explanations"),
    i("17", "discussion", "Comparação com a literatura existente, quando aplicável", "Comparison with the existing literature, where applicable"),
    i("18", "discussion", "Conclusões e recomendações para política e prática, se cabível", "Conclusions and recommendations for policy and practice, if appropriate"),
    i("19", "other", "Financiamento, papel do financiador e conflitos de interesse dos revisores", "Funding, the funder's role and reviewers' conflicts of interest"),
  ],
};

export const CHECKLISTS: Record<string, Checklist> = {
  prisma2020: PRISMA_2020, "prisma-scr": PRISMA_SCR, "prisma-adapted": INTEGRATIVE_ADAPTED, entreq: ENTREQ, sanra: SANRA, prior: PRIOR, rameses: RAMESES,
};
export const checklistFor = (guidelineId: string): Checklist => CHECKLISTS[guidelineId] ?? PRISMA_2020;

export type ItemStatus = "met" | "partial" | "missing" | "not_applicable";
