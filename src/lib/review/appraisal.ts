import type { Bilingual } from "./types";

export type ToolId = "rob2" | "robins-i" | "nos" | "quadas2" | "mmat";

export interface AppraisalItem { key: string; label: Bilingual; hint?: Bilingual }
export interface Judgement { value: string; label: Bilingual }

export interface ToolSpec {
  id: ToolId;
  name: string;
  /** Scale used for each item. */
  scale: Judgement[];
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

export const TOOLS: Record<ToolId, ToolSpec> = {
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
    source: "Sterne JAC et al. BMJ 2016;355:i4919",
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
    id: "nos", name: "Newcastle-Ottawa", overall: "stars",
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

/** Tools the module can apply today; a type's definition may list others that are not built yet. */
export const isImplemented = (id: string): id is ToolId => id in TOOLS;

/**
 * A starting suggestion for the overall RoB 2 / QUADAS-2 judgement. The tools leave the final call
 * to the reviewer (several "some concerns" can add up to "high"), so this is only a default.
 */
export function suggestOverall(tool: ToolId, domains: Record<string, string | undefined>): string | null {
  const spec = TOOLS[tool];
  if (spec.overall !== "judgement") return null;
  const vals = spec.items.map((i) => domains[i.key]);
  if (vals.some((v) => !v)) return null;
  if (tool === "robins-i") {
    const order = ["low", "moderate", "serious", "critical"];
    const known = vals.filter((v) => order.includes(v!));
    if (known.length === 0) return "ni";
    return order[Math.max(...known.map((v) => order.indexOf(v!)))];
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
  if (/random/.test(d) && !/non/.test(d)) return pick("rob2") ?? pick("mmat");
  if (/cohort|case-control|observational|coorte/.test(d)) return pick("nos") ?? pick("robins-i") ?? pick("mmat");
  if (/diagnostic|accuracy/.test(d)) return pick("quadas2");
  if (/qualitative|mixed/.test(d)) return pick("mmat");
  return allowed.find(isImplemented) as ToolId | null ?? null;
}
