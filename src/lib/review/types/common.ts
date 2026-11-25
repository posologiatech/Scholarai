import type { Bilingual, FrameworkField, StageDef } from "./schema";

export const b = (pt: string, en: string): Bilingual => ({ pt, en });

export const ref = {
  prisma2020: "Page MJ, et al. The PRISMA 2020 statement. BMJ 2021;372:n71.",
  prismaS: "Rethlefsen ML, et al. PRISMA-S: an extension to the PRISMA statement for reporting literature searches. Syst Rev 2021;10:39.",
  prismaScr: "Tricco AC, et al. PRISMA Extension for Scoping Reviews (PRISMA-ScR). Ann Intern Med 2018;169:467-473.",
  cochrane: "Higgins JPT, et al. (eds). Cochrane Handbook for Systematic Reviews of Interventions. Current version online (verify version in use).",
  jbi: "Aromataris E, Munn Z (eds). JBI Manual for Evidence Synthesis. JBI (verify chapter and edition in use).",
  arksey: "Arksey H, O'Malley L. Scoping studies: towards a methodological framework. Int J Soc Res Methodol 2005;8:19-32.",
  levac: "Levac D, Colquhoun H, O'Brien KK. Scoping studies: advancing the methodology. Implement Sci 2010;5:69.",
  whittemore: "Whittemore R, Knafl K. The integrative review: updated methodology. J Adv Nurs 2005;52:546-553.",
  rob2: "Sterne JAC, et al. RoB 2: a revised tool for assessing risk of bias in randomised trials. BMJ 2019;366:l4898.",
  robinsI: "Sterne JAC, et al. ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions. BMJ 2016;355:i4919.",
  swim: "Campbell M, et al. Synthesis without meta-analysis (SWiM) in systematic reviews: reporting guideline. BMJ 2020;368:l6890.",
  mmat: "Hong QN, et al. The Mixed Methods Appraisal Tool (MMAT) version 2018 for information professionals and researchers. Educ Inf 2018;34:285-291.",
};

export const pico: FrameworkField[] = [
  { key: "population", label: b("População", "Population"), hint: b("Quem são os participantes?", "Who are the participants?"), required: true },
  { key: "intervention", label: b("Intervenção / exposição", "Intervention / exposure"), hint: b("O que está sendo avaliado?", "What is being assessed?"), required: true },
  { key: "comparison", label: b("Comparação", "Comparison"), hint: b("Comparador, se houver", "Comparator, if any"), required: false },
  { key: "outcome", label: b("Desfecho", "Outcome"), hint: b("O que será medido?", "What is measured?"), required: true },
  { key: "design", label: b("Desenho de estudo", "Study design"), hint: b("Ex.: ensaios clínicos randomizados", "E.g. randomised trials"), required: false },
];

/** Stages whose shape is identical across the types built so far. */
export const searchStage = (extra?: Partial<StageDef>): StageDef => ({
  key: "search",
  title: b("Busca e importação", "Search and import"),
  description: b(
    "Execute a busca nas bases abertas, importe as exportações das bases licenciadas, registre cada busca e remova duplicatas.",
    "Run the search in open sources, import exports from licensed ones, log every search and remove duplicates.",
  ),
  aiRole: b("Gera a string de cada base e sugere agrupamentos de duplicatas para você conferir.", "Generates each source's string and proposes duplicate groups for you to confirm."),
  gate: [
    { kind: "count", metric: "searches_logged", min: 2, label: b("Registrar ao menos duas buscas em bases diferentes", "Log at least two searches in different sources") },
    { kind: "count", metric: "records", min: 1, label: b("Ter registros importados", "Have imported records") },
    { kind: "flag", flag: "duplicates_reviewed", label: b("Conferir as duplicatas", "Review duplicates") },
  ],
  uses: ["search-papers", "lib/ris.ts", "review-harvest (new)"],
  ...extra,
});

export const strategyStage = (extra?: Partial<StageDef>): StageDef => ({
  key: "strategy",
  title: b("Estratégia e bases", "Strategy and sources"),
  description: b(
    "Escolha as bases com a recomendação do sistema, monte os blocos de termos e revise a string de cada base.",
    "Choose sources using the system's recommendation, build the term blocks and review each source's string.",
  ),
  aiRole: b("Sugere sinônimos e vocabulário controlado; você aprova cada string.", "Suggests synonyms and controlled vocabulary; you approve each string."),
  gate: [
    { kind: "count", metric: "sources_selected", min: 2, label: b("Selecionar ao menos duas bases", "Select at least two sources") },
    { kind: "flag", flag: "strategy_approved", label: b("Aprovar a estratégia de busca", "Approve the search strategy") },
  ],
  uses: ["BooleanQueryBuilder", "lib/review/databases.ts"],
  ...extra,
});

export const writingStage = (extra?: Partial<StageDef>): StageDef => ({
  key: "writing",
  title: b("Redação e entrega", "Writing and delivery"),
  description: b(
    "Redija seção a seção a partir dos dados, confira o checklist do guia de relato e exporte.",
    "Draft section by section from the data, check the reporting checklist and export.",
  ),
  aiRole: b("Rascunha apenas a partir dos estudos incluídos e das tabelas calculadas; cada citação e número é verificado.", "Drafts only from included studies and computed tables; each citation and number is verified."),
  gate: [],
  uses: ["WritingAssistant", "review-draft-section (new)", "review-audit (new)"],
  ...extra,
});
