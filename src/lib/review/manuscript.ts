import type { Bilingual, ReviewTypeDef } from "./types";
import { checklistFor, type Checklist } from "./checklists";

/**
 * ai:     drafted by the AI from facts computed by the system, then edited and approved by the author
 * auto:   written by the system from the data, with no AI
 * manual: the author writes it (it needs knowledge the review data does not hold)
 */
export type SectionMode = "ai" | "auto" | "manual";

export interface SectionDef {
  key: string;
  part: "title" | "abstract" | "introduction" | "methods" | "results" | "discussion" | "other";
  title: Bilingual;
  mode: SectionMode;
  /** What the author should cover when writing it by hand. */
  guidance?: Bilingual;
}

const s = (key: string, part: SectionDef["part"], pt: string, en: string, mode: SectionMode, guidance?: [string, string]): SectionDef => ({
  key, part, title: { pt, en }, mode, guidance: guidance ? { pt: guidance[0], en: guidance[1] } : undefined,
});

/** Master order of every section; each review type keeps the ones its checklist maps items to. */
export const MASTER_SECTIONS: SectionDef[] = [
  s("title", "title", "Título", "Title", "manual", ["Identifique o tipo de revisão no título (por exemplo, \"uma revisão sistemática\").", "Identify the review type in the title (for example, \"a systematic review\")."]),
  s("abstract", "abstract", "Resumo", "Abstract", "ai"),
  s("rationale", "introduction", "Justificativa", "Rationale", "manual", ["Situe o problema no que já se sabe. Isso exige literatura além dos estudos incluídos, por isso é escrito por você.", "Place the problem within what is already known. This needs literature beyond the included studies, so you write it."]),
  s("objectives", "introduction", "Objetivos", "Objectives", "ai"),
  s("registration", "methods", "Registro e protocolo", "Registration and protocol", "auto"),
  s("methods_eligibility", "methods", "Critérios de elegibilidade", "Eligibility criteria", "ai"),
  s("methods_sources", "methods", "Fontes de informação e estratégia de busca", "Information sources and search strategy", "auto"),
  s("methods_selection", "methods", "Processo de seleção", "Selection process", "ai"),
  s("methods_extraction", "methods", "Extração de dados", "Data collection", "ai"),
  s("methods_rob", "methods", "Avaliação crítica dos estudos", "Critical appraisal", "ai"),
  s("methods_synthesis", "methods", "Métodos de síntese", "Synthesis methods", "ai"),
  s("methods_certainty", "methods", "Viés de relato e certeza da evidência", "Reporting bias and certainty of evidence", "ai"),
  s("results_selection", "results", "Seleção dos estudos", "Study selection", "ai"),
  s("results_characteristics", "results", "Características dos estudos", "Study characteristics", "ai"),
  s("results_rob", "results", "Qualidade dos estudos", "Quality of the studies", "ai"),
  s("results_findings", "results", "Resultados", "Results", "ai"),
  s("results_certainty", "results", "Certeza da evidência", "Certainty of evidence", "ai"),
  s("discussion", "discussion", "Discussão", "Discussion", "manual", ["Interprete os resultados diante de outras evidências e discuta as implicações. A interpretação é sua; o sistema só garante que os números do que você citar estejam certos.", "Interpret the results against other evidence and discuss implications. The interpretation is yours; the system only makes sure the numbers you cite are right."]),
  s("limitations", "discussion", "Limitações", "Limitations", "ai"),
  s("declarations", "other", "Financiamento, conflitos, dados e uso de IA", "Funding, competing interests, data and use of AI", "manual", ["Declare financiamento, conflitos de interesse e onde os dados estão. A declaração de uso de IA é preenchida pelo sistema.", "State funding, competing interests and where data are available. The AI-use statement is filled in by the system."]),
];

/** Which section covers each checklist item, per guideline. */
const MAP: Record<string, Record<string, string>> = {
  prisma2020: {
    "1": "title", "2": "abstract", "3": "rationale", "4": "objectives", "5": "methods_eligibility", "6": "methods_sources", "7": "methods_sources",
    "8": "methods_selection", "9": "methods_extraction", "10a": "methods_extraction", "10b": "methods_extraction", "11": "methods_rob", "12": "methods_synthesis",
    "13a": "methods_synthesis", "13b": "methods_synthesis", "13c": "methods_synthesis", "13d": "methods_synthesis", "13e": "methods_synthesis", "13f": "methods_synthesis",
    "14": "methods_certainty", "15": "methods_certainty", "16a": "results_selection", "16b": "results_selection", "17": "results_characteristics", "18": "results_rob",
    "19": "results_findings", "20a": "results_findings", "20b": "results_findings", "20c": "results_findings", "20d": "results_findings", "21": "results_findings",
    "22": "results_certainty", "23a": "discussion", "23d": "discussion", "23b": "limitations", "23c": "limitations", "24a": "registration", "24b": "registration", "24c": "registration",
    "25": "declarations", "26": "declarations", "27": "declarations",
  },
  "prisma-scr": {
    "1": "title", "2": "abstract", "3": "rationale", "4": "objectives", "5": "registration", "6": "methods_eligibility", "7": "methods_sources", "8": "methods_sources",
    "9": "methods_selection", "10": "methods_extraction", "11": "methods_extraction", "12": "methods_rob", "13": "methods_synthesis", "14": "results_selection",
    "15": "results_characteristics", "16": "results_rob", "17": "results_findings", "18": "results_findings", "19": "discussion", "20": "limitations", "21": "discussion", "22": "declarations",
  },
  "prisma-adapted": {
    "1": "title", "2": "abstract", "3": "rationale", "4": "objectives", "5": "methods_eligibility", "6": "methods_sources", "7": "methods_sources", "8": "methods_selection",
    "9": "methods_rob", "10": "methods_synthesis", "11": "results_selection", "12": "results_characteristics", "13": "results_findings", "14": "discussion", "15": "declarations",
  },
  entreq: {
    "1": "objectives", "2": "methods_synthesis", "3": "methods_sources", "4": "methods_eligibility", "5": "methods_sources", "6": "methods_sources", "7": "methods_selection",
    "8": "results_characteristics", "9": "results_selection", "10": "methods_rob", "11": "methods_rob", "12": "methods_rob", "13": "results_rob", "14": "methods_extraction",
    "15": "methods_extraction", "16": "methods_extraction", "17": "methods_extraction", "18": "methods_synthesis", "19": "methods_synthesis", "20": "results_findings", "21": "results_findings",
  },
  sanra: { "1": "rationale", "2": "objectives", "3": "methods_sources", "4": "results_findings", "5": "discussion", "6": "results_findings" },
  "umbrella-adapted": {
    "1": "title", "2": "abstract", "3": "rationale", "4": "objectives", "5": "methods_eligibility", "6": "methods_sources", "7": "methods_sources", "8": "methods_selection", "9": "methods_extraction",
    "10": "methods_rob", "11": "methods_synthesis", "12": "methods_synthesis", "13": "results_selection", "14": "results_characteristics", "15": "results_rob", "16": "results_findings",
    "17": "results_findings", "18": "discussion", "19": "registration", "20": "declarations",
  },
  "realist-adapted": {
    "1": "title", "2": "abstract", "3": "rationale", "4": "objectives", "5": "methods_synthesis", "6": "methods_sources", "7": "methods_selection", "8": "methods_extraction", "9": "methods_synthesis",
    "10": "results_selection", "11": "results_characteristics", "12": "results_findings", "13": "discussion", "14": "limitations", "15": "declarations",
  },
};

export const sectionOfItem = (checklistId: string, itemKey: string): string | undefined => MAP[checklistId]?.[itemKey];

export interface Manuscript { checklist: Checklist; sections: SectionDef[]; itemsBySection: Record<string, string[]> }

/** Sections every manuscript has, even when the guideline gives them no item of their own. */
const ALWAYS = new Set(["title", "abstract", "rationale", "discussion", "limitations", "declarations"]);

export function manuscriptFor(def: ReviewTypeDef): Manuscript {
  const checklist = checklistFor(def.reportingGuideline.id);
  const itemsBySection: Record<string, string[]> = {};
  for (const it of checklist.items) {
    const sec = sectionOfItem(checklist.id, it.key);
    if (sec) (itemsBySection[sec] ??= []).push(it.key);
  }
  return { checklist, sections: MASTER_SECTIONS.filter((x) => itemsBySection[x.key] || ALWAYS.has(x.key)), itemsBySection };
}

export interface SectionState { text: string; approved?: boolean; generated?: boolean; issues?: { type: string; snippet: string }[] }
export type CiteStyle = "author-year" | "numbered";
export interface WritingState { sections?: Record<string, SectionState>; citeStyle?: CiteStyle; aiDrafted?: string[] }
