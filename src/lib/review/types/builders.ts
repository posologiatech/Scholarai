import { b } from "./common";
import type { GateCheck, StageDef } from "./schema";

/** Stage shapes shared by the later review types, so each definition lists only what makes it different. */

export const scopeStage = (desc?: [string, string]): StageDef => ({
  key: "scope", title: b("Tipo e escopo", "Type and scope"),
  description: desc ? b(desc[0], desc[1]) : b("Defina o tema, a área e a equipe e confirme que este é o tipo de revisão adequado.", "Define topic, area and team and confirm this is the right review type."),
  aiRole: b("Indica se a pergunta cabe neste tipo de revisão ou pede outro.", "Indicates whether the question fits this review type or calls for another."),
  gate: [
    { kind: "field", field: "title", label: b("Dar um título de trabalho", "Give a working title") },
    { kind: "field", field: "area", label: b("Informar a área", "Set the area") },
  ],
  uses: ["QuestionEvaluator"],
});

export const protocolStage = (opts: { fields: { key: string; pt: string; en: string }[]; desc: [string, string]; extra?: GateCheck[]; uses?: string[] }): StageDef => ({
  key: "protocol", title: b("Pergunta e protocolo", "Question and protocol"), description: b(opts.desc[0], opts.desc[1]),
  aiRole: b("Sugere critérios e refina a pergunta; o protocolo só vale depois que você o congela.", "Suggests criteria and refines the question; the protocol only counts once you lock it."),
  gate: [
    ...opts.fields.map((f) => ({ kind: "field" as const, field: `framework.${f.key}`, label: b(`Preencher: ${f.pt}`, `Fill in: ${f.en}`) })),
    { kind: "field", field: "eligibility", label: b("Definir critérios de elegibilidade", "Define eligibility criteria") },
    ...(opts.extra ?? []),
    { kind: "field", field: "protocol_locked_at", label: b("Congelar o protocolo", "Lock the protocol") },
  ],
  uses: opts.uses ?? ["ProtocolPanel", "generate-screening-criteria"],
});

export const screeningStage = (opts: { requireTwo: boolean; pilot?: boolean; desc: [string, string] }): StageDef => ({
  key: "screening", title: b("Triagem", "Screening"), description: b(opts.desc[0], opts.desc[1]),
  aiRole: b("Apoio rotulado; não conta como voto.", "Labelled aid; it does not count as a vote."),
  gate: [
    ...(opts.requireTwo ? [{ kind: "count" as const, metric: "reviewers", min: 2, label: b("Ter dois revisores", "Have two reviewers") }] : []),
    ...(opts.pilot ? [{ kind: "flag" as const, flag: "pilot_done", label: b("Fazer o piloto de calibração dos critérios", "Run the criteria calibration pilot") }] : []),
    { kind: "count", metric: "title_abstract_done_pct", min: 100, label: b("Concluir a triagem por título e resumo", "Finish title/abstract screening") },
    { kind: "count", metric: "full_text_done_pct", min: 100, label: b("Concluir o texto completo, com motivo de exclusão", "Finish full text, with exclusion reasons") },
  ],
  uses: ["ScreeningStage", "PrismaFlowDiagram"],
});

export const appraisalStage = (opts: { title: [string, string]; desc: [string, string]; appraisal: boolean }): StageDef => ({
  key: "appraisal", title: b(opts.title[0], opts.title[1]), description: b(opts.desc[0], opts.desc[1]),
  aiRole: b("Propõe valores e julgamentos com o trecho de origem; você confere.", "Proposes values and judgements with the source passage; you verify."),
  gate: [
    { kind: "count", metric: "extraction_verified_pct", min: 100, label: b("Verificar a extração de todos os incluídos", "Verify extraction for all included studies") },
    ...(opts.appraisal ? [{ kind: "count" as const, metric: "appraisal_done_pct", min: 100, label: b("Avaliar a qualidade de todos os incluídos", "Appraise the quality of all included studies") }] : []),
  ],
  uses: ["ExtractionStage"],
});

export const synthesisStage = (opts: { title: [string, string]; desc: [string, string]; ai: [string, string]; gate: GateCheck[] }): StageDef => ({
  key: "synthesis", title: b(opts.title[0], opts.title[1]), description: b(opts.desc[0], opts.desc[1]), aiRole: b(opts.ai[0], opts.ai[1]), gate: opts.gate, uses: ["SynthesisStage"],
});

export const flag = (f: string, pt: string, en: string): GateCheck => ({ kind: "flag", flag: f, label: b(pt, en) });
