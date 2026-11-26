import type { Bilingual } from "./types";

export type ToolId = "rob2" | "robins-i" | "nos" | "quadas2" | "mmat" | "amstar2" | "casp";

export interface AppraisalItem { key: string; label: Bilingual; hint?: Bilingual }
export interface Judgement { value: string; label: Bilingual }

export interface ToolSpec {
  id: ToolId;
  name: string;
  /** Scale used for each item. */
  scale: Judgement[];
  /** Scale of the overall rating when it differs from the items' (AMSTAR 2 rates confidence, not items). */
  overallScale?: Judgement[];
  /** Items whose failure counts as a critical flaw (AMSTAR 2). */
  critical?: string[];
  /** Date (ISO) the items and rules were compared with the official publication; absent when they were not. */
  checkedOn?: string;
  /** One line the reviewer should keep in mind when using the tool, taken from the tool's own guidance. */
  guidance?: Bilingual;
  items: AppraisalItem[];
  /** How the overall result is shown: a judgement, a star total, or per-criterion counts only. */
  overall: "judgement" | "stars" | "none";
  source: string;
}

const b = (pt: string, en: string): Bilingual => ({ pt, en });

const LOW_SOME_HIGH: Judgement[] = [
  { value: "low", label: b("Baixo risco", "Low risk") },
  { value: "some", label: b("Algumas preocupações", "Some concerns") },
  { value: "high", label: b("Alto risco", "High risk") },
];
const ROBINS: Judgement[] = [
  { value: "low", label: b("Baixo", "Low") },
  { value: "moderate", label: b("Moderado", "Moderate") },
  { value: "serious", label: b("Sério", "Serious") },
  { value: "critical", label: b("Crítico", "Critical") },
  { value: "ni", label: b("Sem informação", "No information") },
];
const YES_NO_CANT: Judgement[] = [
  { value: "yes", label: b("Sim", "Yes") },
  { value: "no", label: b("Não", "No") },
  { value: "cant", label: b("Não sei dizer", "Can't tell") },
];

const BASE: Omit<Record<ToolId, ToolSpec>, "amstar2" | "casp"> = {
  rob2: {
    id: "rob2", name: "RoB 2", scale: LOW_SOME_HIGH, overall: "judgement",
    source: "Sterne JAC et al. BMJ 2019;366:l4898",
    items: [
      { key: "D1", label: b("Processo de randomização", "Randomization process") },
      { key: "D2", label: b("Desvios das intervenções pretendidas", "Deviations from intended interventions") },
      { key: "D3", label: b("Dados de desfecho ausentes", "Missing outcome data") },
      { key: "D4", label: b("Aferição do desfecho", "Measurement of the outcome") },
      { key: "D5", label: b("Seleção do resultado relatado", "Selection of the reported result") },
    ],
  },
  "robins-i": {
    id: "robins-i", name: "ROBINS-I", scale: ROBINS, overall: "judgement",
    source: "Sterne JAC et al. BMJ 2016;355:i4919 (a 2025 draft, ROBINS-I V2, exists; this is the 2016 version)", checkedOn: "2026-11-26",
    items: [
      { key: "D1", label: b("Confusão", "Confounding") },
      { key: "D2", label: b("Seleção dos participantes", "Selection of participants") },
      { key: "D3", label: b("Classificação das intervenções", "Classification of interventions") },
      { key: "D4", label: b("Desvios das intervenções pretendidas", "Deviations from intended interventions") },
      { key: "D5", label: b("Dados ausentes", "Missing data") },
      { key: "D6", label: b("Aferição dos desfechos", "Measurement of outcomes") },
      { key: "D7", label: b("Seleção do resultado relatado", "Selection of the reported result") },
    ],
  },
  nos: {
    id: "nos", name: "Newcastle-Ottawa", overall: "stars", checkedOn: "2026-11-26",
    scale: [{ value: "star", label: b("★ (atende)", "★ (met)") }, { value: "none", label: b("Sem estrela", "No star") }],
    source: "Wells GA et al. Newcastle-Ottawa Scale (coorte)",
    items: [
      { key: "S1", label: b("Representatividade da coorte exposta", "Representativeness of the exposed cohort") },
      { key: "S2", label: b("Seleção da coorte não exposta", "Selection of the non-exposed cohort") },
      { key: "S3", label: b("Aferição da exposição", "Ascertainment of exposure") },
      { key: "S4", label: b("Desfecho ausente no início", "Outcome not present at start") },
      { key: "C1", label: b("Comparabilidade (fator principal)", "Comparability (main factor)") },
      { key: "C2", label: b("Comparabilidade (fator adicional)", "Comparability (additional factor)") },
      { key: "O1", label: b("Avaliação do desfecho", "Assessment of outcome") },
      { key: "O2", label: b("Seguimento longo o bastante", "Follow-up long enough") },
      { key: "O3", label: b("Adequação do seguimento", "Adequacy of follow-up") },
    ],
  },
  quadas2: {
    id: "quadas2", name: "QUADAS-2",
    scale: [{ value: "low", label: b("Baixo risco", "Low risk") }, { value: "high", label: b("Alto risco", "High risk") }, { value: "unclear", label: b("Incerto", "Unclear") }],
    overall: "judgement", source: "Whiting PF et al. Ann Intern Med 2011;155:529-536",
    items: [
      { key: "D1", label: b("Seleção de pacientes", "Patient selection") },
      { key: "D2", label: b("Teste índice", "Index test") },
      { key: "D3", label: b("Padrão de referência", "Reference standard") },
      { key: "D4", label: b("Fluxo e tempo", "Flow and timing") },
    ],
  },
  mmat: {
    id: "mmat", name: "MMAT 2018", scale: YES_NO_CANT, overall: "none",
    source: "Hong QN et al. Educ Inf 2018;34:285-291",
    items: [
      { key: "S1", label: b("Há questões de pesquisa claras?", "Are there clear research questions?") },
      { key: "S2", label: b("Os dados coletados permitem responder às questões?", "Do the collected data allow the questions to be addressed?") },
      { key: "1.1", label: b("[Qualitativo] A abordagem é adequada à questão?", "[Qualitative] Is the approach appropriate to the question?") },
      { key: "1.2", label: b("[Qualitativo] Os métodos de coleta são adequados?", "[Qualitative] Are data collection methods adequate?") },
      { key: "1.3", label: b("[Qualitativo] Os achados derivam adequadamente dos dados?", "[Qualitative] Are findings adequately derived from the data?") },
      { key: "1.4", label: b("[Qualitativo] A interpretação é sustentada pelos dados?", "[Qualitative] Is the interpretation substantiated by data?") },
      { key: "1.5", label: b("[Qualitativo] Há coerência entre fontes, coleta, análise e interpretação?", "[Qualitative] Is there coherence between sources, collection, analysis and interpretation?") },
      { key: "2.1", label: b("[Ensaio randomizado] A randomização foi adequada?", "[Randomized trial] Was randomization appropriately performed?") },
      { key: "2.2", label: b("[Ensaio randomizado] Os grupos são comparáveis no início?", "[Randomized trial] Are groups comparable at baseline?") },
      { key: "2.3", label: b("[Ensaio randomizado] Os dados de desfecho estão completos?", "[Randomized trial] Are outcome data complete?") },
      { key: "2.4", label: b("[Ensaio randomizado] Os avaliadores do desfecho estavam cegados?", "[Randomized trial] Were outcome assessors blinded?") },
      { key: "2.5", label: b("[Ensaio randomizado] Os participantes aderiram à intervenção?", "[Randomized trial] Did participants adhere to the assigned intervention?") },
      { key: "3.1", label: b("[Não randomizado] Os participantes representam a população-alvo?", "[Non-randomized] Are participants representative of the target population?") },
      { key: "3.2", label: b("[Não randomizado] As medidas são adequadas ao desfecho e à intervenção?", "[Non-randomized] Are measurements appropriate for outcome and intervention?") },
      { key: "3.3", label: b("[Não randomizado] Os dados de desfecho estão completos?", "[Non-randomized] Are outcome data complete?") },
      { key: "3.4", label: b("[Não randomizado] Os fatores de confusão foram considerados?", "[Non-randomized] Are confounders accounted for?") },
      { key: "3.5", label: b("[Não randomizado] A intervenção foi aplicada como planejado?", "[Non-randomized] Was the intervention administered as intended?") },
      { key: "4.1", label: b("[Descritivo] A estratégia de amostragem é relevante?", "[Descriptive] Is the sampling strategy relevant?") },
      { key: "4.2", label: b("[Descritivo] A amostra é representativa?", "[Descriptive] Is the sample representative?") },
      { key: "4.3", label: b("[Descritivo] As medidas são adequadas?", "[Descriptive] Are measurements appropriate?") },
      { key: "4.4", label: b("[Descritivo] O risco de viés de não resposta é baixo?", "[Descriptive] Is the risk of nonresponse bias low?") },
      { key: "4.5", label: b("[Descritivo] A análise estatística é adequada?", "[Descriptive] Is the statistical analysis appropriate?") },
      { key: "5.1", label: b("[Métodos mistos] Há justificativa para o desenho misto?", "[Mixed methods] Is there an adequate rationale for the mixed design?") },
      { key: "5.2", label: b("[Métodos mistos] A integração dos componentes é eficaz?", "[Mixed methods] Is integration of components effective?") },
      { key: "5.3", label: b("[Métodos mistos] Os resultados da integração foram bem interpretados?", "[Mixed methods] Are outputs of the integration adequately interpreted?") },
      { key: "5.4", label: b("[Métodos mistos] As divergências entre quanti e quali foram tratadas?", "[Mixed methods] Are divergences between quantitative and qualitative results addressed?") },
      { key: "5.5", label: b("[Métodos mistos] Os componentes seguem os critérios de qualidade de cada método?", "[Mixed methods] Do components adhere to the quality criteria of each method?") },
    ],
  },
};

const AMSTAR_SCALE: Judgement[] = [
  { value: "yes", label: b("Sim", "Yes") }, { value: "partial", label: b("Sim parcial", "Partial yes") },
  { value: "no", label: b("Não", "No") }, { value: "na", label: b("Não se aplica", "Not applicable") },
];
const AMSTAR_ITEMS: [string, string, string][] = [
  ["1", "A pergunta e os critérios de inclusão contêm os componentes PICO?", "Do the research questions and inclusion criteria include the PICO components?"],
  ["2", "[Crítico] Os métodos foram estabelecidos antes da revisão e os desvios justificados?", "[Critical] Were the methods established before the review and deviations justified?"],
  ["3", "Os autores explicaram a escolha dos desenhos de estudo incluídos?", "Did the authors explain their selection of study designs?"],
  ["4", "[Crítico] A estratégia de busca foi abrangente?", "[Critical] Was the search strategy comprehensive?"],
  ["5", "A seleção dos estudos foi feita em duplicata?", "Was study selection performed in duplicate?"],
  ["6", "A extração de dados foi feita em duplicata?", "Was data extraction performed in duplicate?"],
  ["7", "[Crítico] Há lista dos estudos excluídos, com justificativa?", "[Critical] Is there a list of excluded studies with justification?"],
  ["8", "Os estudos incluídos foram descritos em detalhe adequado?", "Were the included studies described in adequate detail?"],
  ["9", "[Crítico] A técnica de avaliação do risco de viés foi satisfatória?", "[Critical] Was the risk-of-bias technique satisfactory?"],
  ["10", "Informaram as fontes de financiamento dos estudos incluídos?", "Did they report the funding sources of the included studies?"],
  ["11", "[Crítico] Os métodos de meta-análise foram adequados?", "[Critical] Were appropriate methods used for meta-analysis?"],
  ["12", "Consideraram o impacto do risco de viés na meta-análise?", "Did they assess the impact of risk of bias on the meta-analysis?"],
  ["13", "[Crítico] O risco de viés foi considerado na interpretação dos resultados?", "[Critical] Was risk of bias accounted for when interpreting the results?"],
  ["14", "A heterogeneidade foi explicada e discutida?", "Was heterogeneity explained and discussed?"],
  ["15", "[Crítico] O viés de publicação foi investigado e discutido?", "[Critical] Was publication bias investigated and discussed?"],
  ["16", "Declararam conflitos de interesse e financiamento da própria revisão?", "Did they report conflicts of interest and funding for the review?"],
];
const AMSTAR: ToolSpec = {
  id: "amstar2", name: "AMSTAR 2", scale: AMSTAR_SCALE, overall: "judgement", source: "Shea BJ et al. BMJ 2017;358:j4008", checkedOn: "2026-11-26",
  guidance: b("Sem informação para avaliar um item, responda \"Não\": os autores da revisão não recebem o benefício da dúvida. Não some os itens numa nota. Vários pontos fracos fora dos críticos podem justificar baixar a confiança de moderada para baixa.", "If there is no information to rate an item, answer \"No\": the review authors get no benefit of the doubt. Do not add items into a score. Several non-critical weaknesses may justify moving confidence from moderate to low."),
  critical: ["2", "4", "7", "9", "11", "13", "15"],
  overallScale: [
    { value: "high", label: b("Confiança alta", "High confidence") }, { value: "moderate", label: b("Confiança moderada", "Moderate confidence") },
    { value: "low", label: b("Confiança baixa", "Low confidence") }, { value: "critically_low", label: b("Confiança criticamente baixa", "Critically low confidence") },
  ],
  items: AMSTAR_ITEMS.map(([key, pt, en]) => ({ key, label: b(pt, en) })),
};
const CASP_ITEMS: [string, string, string][] = [
  ["1", "Há uma declaração clara dos objetivos da pesquisa?", "Was there a clear statement of the aims of the research?"],
  ["2", "A metodologia qualitativa é adequada?", "Is a qualitative methodology appropriate?"],
  ["3", "O desenho da pesquisa é adequado aos objetivos?", "Was the research design appropriate to address the aims?"],
  ["4", "A estratégia de recrutamento foi adequada?", "Was the recruitment strategy appropriate to the aims?"],
  ["5", "Os dados foram coletados de modo a abordar a questão?", "Was the data collected in a way that addressed the research issue?"],
  ["6", "A relação entre pesquisadores e participantes foi considerada?", "Has the relationship between researcher and participants been adequately considered?"],
  ["7", "As questões éticas foram consideradas?", "Have ethical issues been taken into consideration?"],
  ["8", "A análise dos dados foi suficientemente rigorosa?", "Was the data analysis sufficiently rigorous?"],
  ["9", "Há uma declaração clara dos achados?", "Is there a clear statement of findings?"],
  ["10", "Qual o valor da pesquisa (contribuição ao conhecimento, novas áreas, transferibilidade)?", "How valuable is the research (contribution to knowledge, new areas, transferability)?"],
];
const CASP: ToolSpec = {
  id: "casp", name: "CASP (qualitativo)", scale: YES_NO_CANT, overall: "none", source: "Critical Appraisal Skills Programme, Qualitative Studies Checklist (2024, CC BY-NC-SA 4.0)", checkedOn: "2026-11-26",
  guidance: b("Nunca suponha o que os pesquisadores fizeram: se não der para saber, responda \"Não sei dizer\". Muitas respostas assim indicam falta de transparência. O CASP não gera nota.", "Never assume what the researchers did: if you cannot tell, answer \"Can't tell\". Many such answers mean a lack of transparency. CASP does not produce a score."),
  items: CASP_ITEMS.map(([key, pt, en]) => ({ key, label: b(pt, en) })),
};

export const TOOLS: Record<ToolId, ToolSpec> = { ...BASE, amstar2: AMSTAR, casp: CASP };

/** Tools the module can apply today; a type's definition may list others that are not built yet. */
export const isImplemented = (id: string): id is ToolId => id in TOOLS;

/**
 * A starting suggestion for the overall RoB 2 / QUADAS-2 judgement. The tools leave the final call
 * to the reviewer (several "some concerns" can add up to "high"), so this is only a default.
 */
export function suggestOverall(tool: ToolId, domains: Record<string, string | undefined>): string | null {
  const spec = TOOLS[tool];
  if (spec.overall !== "judgement") return null;
  if (tool === "amstar2") {
    if (spec.items.some((i) => !domains[i.key])) return null;
    // Only "No" counts as a flaw or weakness; "Partial yes" is treated as met, as the authors' scoring does.
    const crit = spec.critical ?? [];
    const flaws = crit.filter((k) => domains[k] === "no").length;
    const weak = spec.items.filter((i) => !crit.includes(i.key) && domains[i.key] === "no").length;
    return flaws > 1 ? "critically_low" : flaws === 1 ? "low" : weak > 1 ? "moderate" : "high";
  }
  const vals = spec.items.map((i) => domains[i.key]);
  if (vals.some((v) => !v)) return null;
  if (tool === "robins-i") {
    // ROBINS-I: critical if any domain is critical; serious if any is serious; "no information" when some key
    // domain lacks information and nothing is clearly serious or critical; otherwise moderate, else low.
    if (vals.includes("critical")) return "critical";
    if (vals.includes("serious")) return "serious";
    if (vals.includes("ni")) return "ni";
    return vals.includes("moderate") ? "moderate" : "low";
  }
  if (vals.includes("high")) return "high";
  if (tool === "quadas2") return vals.includes("unclear") ? "unclear" : "low";
  return vals.includes("some") ? "some" : "low";
}

export const starTotal = (domains: Record<string, string | undefined>): { stars: number; max: number } => ({
  stars: Object.values(domains).filter((v) => v === "star").length,
  max: TOOLS.nos.items.length,
});

/** MMAT advises against one overall score: report the answers per criterion instead. */
export function mmatCounts(domains: Record<string, string | undefined>): Record<string, number> {
  const c: Record<string, number> = { yes: 0, no: 0, cant: 0 };
  for (const v of Object.values(domains)) if (v && v in c) c[v]++;
  return c;
}

export function isComplete(tool: ToolId, domains: Record<string, string | undefined>, overall: string | null): boolean {
  const spec = TOOLS[tool];
  if (tool === "mmat") {
    // Screening questions plus every criterion of at least one design category (which one depends on the study).
    const full = ["1", "2", "3", "4", "5"].some((c) => [1, 2, 3, 4, 5].every((n) => domains[`${c}.${n}`]));
    return !!domains.S1 && !!domains.S2 && full;
  }
  if (!spec.items.every((i) => domains[i.key])) return false;
  return spec.overall === "judgement" ? !!overall : true;
}

/** Guess a tool from the study design recorded for the record. The reviewer can always change it. */
export function guessTool(design: string | null | undefined, allowed: string[]): ToolId | null {
  const d = (design ?? "").toLowerCase();
  const pick = (id: ToolId) => (allowed.includes(id) ? id : null);
  if (/systematic review|meta-analys|umbrella|overview/.test(d)) return pick("amstar2");
  if (/qualitative|focus group|interview|phenomenolog|ethnograph|grounded/.test(d) && allowed.includes("casp")) return "casp";
  if (/random/.test(d) && !/non/.test(d)) return pick("rob2") ?? pick("mmat");
  if (/cohort|case-control|observational|coorte/.test(d)) return pick("nos") ?? pick("robins-i") ?? pick("mmat");
  if (/diagnostic|accuracy/.test(d)) return pick("quadas2");
  if (/qualitative|mixed/.test(d)) return pick("mmat");
  return allowed.find(isImplemented) as ToolId | null ?? null;
}
