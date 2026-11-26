import { appraisalStage, flag, protocolStage, scopeStage, screeningStage, synthesisStage } from "./builders";
import { b, searchStage, strategyStage, writingStage } from "./common";
import type { ReviewTypeDef } from "./schema";

export const realist: ReviewTypeDef = {
  id: "realist", version: "0.1.0",
  label: b("Revisão realista", "Realist review"),
  summary: b("Explica o que funciona, para quem, em quais circunstâncias e por quê, construindo e testando uma teoria do programa a partir de configurações contexto-mecanismo-resultado.", "Explains what works, for whom, in what circumstances and why, building and testing a program theory from context-mechanism-outcome configurations."),
  framework: { name: "CMO", label: b("Teoria do programa", "Program theory"), fields: [
    { key: "program", label: b("Programa ou intervenção", "Program or intervention"), hint: b("O que está sendo explicado", "What is being explained"), required: true },
    { key: "population", label: b("Para quem", "For whom"), hint: b("Participantes ou grupos de interesse", "Participants or groups of interest"), required: true },
    { key: "context", label: b("Contextos de interesse", "Contexts of interest"), hint: b("Circunstâncias em que o programa opera", "Circumstances in which the program operates"), required: true },
    { key: "outcome", label: b("Resultados de interesse", "Outcomes of interest"), hint: b("Resultados pretendidos e não pretendidos", "Intended and unintended outcomes"), required: true },
  ] },
  registry: { name: "PROSPERO / OSF", url: "https://osf.io/registries", required: false },
  reportingGuideline: { id: "realist-adapted", name: "Processo realista (adaptado; consulte o RAMESES)" },
  appraisal: { required: false, tools: [] },
  screening: { dual: "optional", phases: ["title_abstract", "full_text"] },
  synthesis: b("Refinamento iterativo da teoria do programa a partir das configurações contexto-mecanismo-resultado extraídas dos documentos.", "Iterative refinement of the program theory from context-mechanism-outcome configurations extracted from the documents."),
  extractionFields: [
    { key: "authors_year", label: b("Autores e ano", "Authors and year"), kind: "text" },
    { key: "design", label: b("Tipo de documento", "Document type"), kind: "text" },
    { key: "context", label: b("Contexto", "Context"), kind: "text" },
    { key: "mechanism", label: b("Mecanismo proposto", "Proposed mechanism"), kind: "text" },
    { key: "outcome", label: b("Resultado", "Outcome"), kind: "text" },
    { key: "relevance", label: b("Relevância para a teoria", "Relevance to the theory"), kind: "choice", choices: ["high", "medium", "low"] },
    { key: "rigour", label: b("Rigor da evidência", "Rigour of the evidence"), kind: "choice", choices: ["high", "medium", "low"] },
  ],
  artifacts: [
    { kind: "prisma_flow", label: b("Fluxo dos documentos", "Document flow"), type: "figure" },
    { kind: "cmo_table", label: b("Configurações contexto-mecanismo-resultado", "Context-mechanism-outcome configurations"), type: "table" },
    { kind: "characteristics", label: b("Características dos documentos", "Document characteristics"), type: "table" },
    { kind: "search_appendix", label: b("Estratégia de busca", "Search strategy"), type: "table" },
  ],
  stages: [
    scopeStage(["Confirme que a pergunta pede uma explicação (o que funciona, para quem, por quê) e não uma estimativa de efeito.", "Confirm the question asks for an explanation (what works, for whom, why) rather than an effect estimate."]),
    protocolStage({
      fields: [{ key: "program", pt: "programa", en: "program" }, { key: "population", pt: "para quem", en: "for whom" }, { key: "context", pt: "contextos", en: "contexts" }, { key: "outcome", pt: "resultados", en: "outcomes" }],
      desc: ["Descreva a teoria inicial do programa e os critérios de seleção. A busca pode ser iterativa: registre cada rodada.", "Describe the initial program theory and the selection criteria. Searching may be iterative: log each round."],
    }),
    strategyStage(),
    searchStage(),
    screeningStage({ requireTwo: false, desc: ["Selecione por relevância e rigor para a teoria; a seleção pode se repetir conforme a teoria muda.", "Select by relevance and rigour for the theory; selection may repeat as the theory changes."] }),
    appraisalStage({ title: ["Extração de contexto, mecanismo e resultado", "Extraction of context, mechanism and outcome"], desc: ["Extraia contexto, mecanismo e resultado de cada documento e julgue relevância e rigor, em vez de risco de viés.", "Extract context, mechanism and outcome from each document and judge relevance and rigour instead of risk of bias."], appraisal: false }),
    synthesisStage({
      title: ["Teoria do programa", "Program theory"], desc: ["Escreva a teoria refinada e monte as configurações contexto-mecanismo-resultado com os documentos que as sustentam.", "Write the refined theory and build the context-mechanism-outcome configurations with the documents that support them."],
      ai: ["A teoria e as configurações são interpretação sua.", "The theory and configurations are your interpretation."],
      gate: [flag("program_theory_written", "Escrever a teoria do programa refinada", "Write the refined program theory"), flag("cmo_built", "Registrar ao menos uma configuração contexto-mecanismo-resultado", "Record at least one context-mechanism-outcome configuration")],
    }),
    writingStage(),
  ],
  references: [
    { citation: "Pawson R, Greenhalgh T, Harvey G, Walshe K. Realist review: a new method of systematic review designed for complex policy interventions. J Health Serv Res Policy 2005;10(Suppl 1):21-34.", role: "method" },
    { citation: "Wong G, et al. RAMESES publication standards: realist syntheses. BMC Med 2013;11:21.", role: "reporting" },
  ],
  review: { status: "pending-expert-review" },
};
