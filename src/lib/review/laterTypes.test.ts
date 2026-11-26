import { describe, expect, it } from "vitest";
import { isComplete, suggestOverall, TOOLS } from "./appraisal";
import { amstarSummary, cmoTable, overlapMatrix, overlapSummaryText, shortcutsTable, type Ctx } from "./artifacts";
import { CHECKLISTS, ENTREQ, PRIOR, RAMESES, SANRA } from "./checklists";
import { buildFacts, type FactsInput } from "./facts";
import { manuscriptFor, sectionOfItem, MASTER_SECTIONS } from "./manuscript";
import type { ReviewRecord } from "./protocol";
import { buildReviewState } from "./state";
import { synthesisFlags } from "./synthesis";
import { currentStage, evaluateGate, getReviewType, RAPID_SHORTCUTS, validateDefinition } from "./types";

const base = (type: string, over: Partial<ReviewRecord> = {}) => ({
  id: "r", owner_id: "u", review_type: type, title: "T", question: "Q?", area: "health", locale: "pt", definition_version: "0.1.0", framework: {}, eligibility: [],
  registry: {}, protocol_document: null, protocol_locked_at: null, protocol_locked_by: null, current_stage: "scope", stage_state: {}, research_project_id: null, is_living: false, ai_disclosure: [], created_at: "", updated_at: "", ...over,
}) as ReviewRecord;

describe("the five later types", () => {
  it.each(["rapid", "umbrella", "narrative", "qualitative", "realist"])("%s is a valid definition with a checklist that maps to real sections", (id) => {
    const def = getReviewType(id)!;
    expect(validateDefinition(def)).toEqual([]);
    const m = manuscriptFor(def);
    const keys = new Set(MASTER_SECTIONS.map((s) => s.key));
    for (const it of m.checklist.items) expect(keys.has(sectionOfItem(m.checklist.id, it.key)!), `${m.checklist.id}:${it.key}`).toBe(true);
    for (const s of ["title", "abstract", "discussion", "declarations"]) expect(m.sections.map((x) => x.key)).toContain(s);
  });

  it("use the official reporting guideline of each type; only the integrative list is an adaptation", () => {
    expect(getReviewType("rapid")!.reportingGuideline.id).toBe("prisma2020");
    expect(getReviewType("umbrella")!.reportingGuideline.id).toBe("prior");
    expect(getReviewType("realist")!.reportingGuideline.id).toBe("rameses");
    expect(getReviewType("qualitative")!.reportingGuideline.id).toBe("entreq");
    for (const t of ["rapid", "umbrella", "qualitative", "realist", "narrative", "scoping", "systematic"]) expect(CHECKLISTS[getReviewType(t)!.reportingGuideline.id].official, t).toBe(true);
    expect(CHECKLISTS[getReviewType("integrative")!.reportingGuideline.id].official).toBe(false);
  });

  it("carries the item counts of the official publications, which were compared with them on 2026-11-26", () => {
    expect(ENTREQ.items).toHaveLength(21);
    expect(SANRA.items).toHaveLength(6);
    expect(RAMESES.items).toHaveLength(19);
    expect(PRIOR.items).toHaveLength(46);
    expect(new Set(PRIOR.items.map((i) => i.key.replace(/[a-d]$/, ""))).size).toBe(27);
    for (const c of [ENTREQ, SANRA, RAMESES, PRIOR]) expect(c.checkedOn).toBe("2026-11-26");
  });

  it("SANRA is flagged as an appraisal scale, not a reporting guideline", () => {
    expect(SANRA.kind).toBe("appraisal");
    expect(getReviewType("narrative")!.reportingGuideline.id).toBe("sanra");
  });

  it("PRIOR splits the overlap items the module can fill from the overlap analysis", () => {
    const keys = new Set(PRIOR.items.filter((i) => ["8b", "9b", "17"].includes(i.key)).map((i) => i.key));
    expect(keys).toEqual(new Set(["8b", "9b", "17"]));
  });

  it("narrative and realist reviews do not require formal appraisal; umbrella and qualitative do, with the right tool", () => {
    expect(getReviewType("narrative")!.appraisal.required).toBe(false);
    expect(getReviewType("realist")!.appraisal.required).toBe(false);
    expect(getReviewType("umbrella")!.appraisal.tools.map((t) => t.id)).toEqual(["amstar2"]);
    expect(getReviewType("qualitative")!.appraisal.tools[0].id).toBe("casp");
  });

  it("require two reviewers only where the method does", () => {
    expect(getReviewType("umbrella")!.screening.dual).toBe("required");
    expect(getReviewType("qualitative")!.screening.dual).toBe("required");
    for (const id of ["rapid", "narrative", "realist"]) expect(getReviewType(id)!.screening.dual).toBe("optional");
  });

  it("a rapid review cannot lock its protocol before declaring shortcuts", () => {
    const def = getReviewType("rapid")!;
    const protocol = def.stages.find((s) => s.key === "protocol")!;
    const r = base("rapid", { framework: { population: "a", intervention: "b", outcome: "c" }, eligibility: [{ kind: "include", text: "x" }], protocol_locked_at: "2026-01-01" });
    expect(evaluateGate(protocol, buildReviewState(r)).missing.map((m) => m.pt)).toEqual(["Declarar os atalhos metodológicos"]);
    const declared = base("rapid", { ...r, stage_state: { rapid: { shortcuts: ["single_screening"] } } });
    expect(evaluateGate(protocol, buildReviewState(declared)).ok).toBe(true);
    expect(RAPID_SHORTCUTS.some((s) => s.key === "none")).toBe(true);
  });

  it("a narrative review needs one search, not two, and no formal appraisal", () => {
    const def = getReviewType("narrative")!;
    const search = def.stages.find((s) => s.key === "search")!;
    expect(evaluateGate(search, { fields: {}, metrics: { searches_logged: 1, records: 5 }, flags: { duplicates_reviewed: true } }).ok).toBe(true);
    const appraisal = def.stages.find((s) => s.key === "appraisal")!;
    expect(appraisal.gate.map((g) => (g.kind === "count" ? g.metric : ""))).toEqual(["extraction_verified_pct"]);
  });

  it("a realist review's synthesis follows what was written, not a button", () => {
    const def = getReviewType("realist")!;
    const syn = def.stages.find((s) => s.key === "synthesis")!;
    const empty = base("realist");
    expect(synthesisFlags(empty).program_theory_written).toBe(false);
    const done = base("realist", { stage_state: { synthesis: { programTheory: "Quando há apoio da equipe, a intervenção funciona porque reduz o medo de errar.", cmo: [{ id: "c", context: "equipe", mechanism: "confiança", outcome: "adesão", evidence: "S1" }] } } });
    const state = { ...buildReviewState(done), flags: { ...synthesisFlags(done) } };
    expect(evaluateGate(syn, state).ok).toBe(true);
    expect(synthesisFlags(base("realist", { stage_state: { synthesis: { cmo: [{ id: "c", context: "x", mechanism: "", outcome: "z", evidence: "" }] } } })).cmo_built).toBe(false);
  });

  it("start at the first stage whose gate is open", () => {
    expect(currentStage(getReviewType("umbrella")!, buildReviewState(base("umbrella", { title: "" }))).key).toBe("scope");
    expect(currentStage(getReviewType("umbrella")!, buildReviewState(base("umbrella"))).key).toBe("protocol");
  });
});

describe("AMSTAR 2 and CASP", () => {
  const all = (v: string) => Object.fromEntries(TOOLS.amstar2.items.map((i) => [i.key, v]));
  it("rates confidence from critical flaws and other weaknesses, counting only 'No'", () => {
    expect(suggestOverall("amstar2", all("yes"))).toBe("high");
    expect(suggestOverall("amstar2", { ...all("yes"), "1": "no" })).toBe("high");
    expect(suggestOverall("amstar2", { ...all("yes"), "1": "no", "3": "no" })).toBe("moderate");
    expect(suggestOverall("amstar2", { ...all("yes"), "2": "no" })).toBe("low");
    expect(suggestOverall("amstar2", { ...all("yes"), "2": "no", "9": "no" })).toBe("critically_low");
    expect(suggestOverall("amstar2", { ...all("partial"), "7": "partial" })).toBe("high");
  });
  it("waits for every item and has the seven critical domains", () => {
    expect(suggestOverall("amstar2", { "1": "yes" })).toBeNull();
    expect(TOOLS.amstar2.items).toHaveLength(16);
    expect(TOOLS.amstar2.critical).toEqual(["2", "4", "7", "9", "11", "13", "15"]);
  });
  it("is complete only with every item and an overall confidence; CASP needs its ten answers and no score", () => {
    expect(isComplete("amstar2", all("yes"), null)).toBe(false);
    expect(isComplete("amstar2", all("yes"), "high")).toBe(true);
    expect(TOOLS.casp.items).toHaveLength(10);
    expect(isComplete("casp", Object.fromEntries(TOOLS.casp.items.map((i) => [i.key, "yes"])), null)).toBe(true);
    expect(suggestOverall("casp", {})).toBeNull();
  });
});

const ctx: Ctx = {
  locale: "pt", reviewType: "umbrella",
  studies: [{ id: "a", title: "Review one", authors: ["Silva, J"], year: 2020 }, { id: "b", title: "Review two", authors: ["Lee, K"], year: 2021 }],
  fields: [], extraction: new Map([["a", { primary_studies: "10.1/x\n10.1/y\n10.1/z" }], ["b", { primary_studies: "10.1/x\nhttps://doi.org/10.1/y\n10.1/w" }]]),
  appraisals: [{ record_id: "a", tool: "amstar2", domains: { "2": { judgement: "no" }, "1": { judgement: "no" }, "3": { judgement: "yes" } }, overall: "low" }],
  searches: [], sourceLabel: (x) => x, excluded: [], themes: [], assign: {}, grade: [], cmo: [{ id: "c", context: "equipe", mechanism: "confiança", outcome: "adesão", evidence: "S1" }], shortcuts: ["single_screening"],
};

describe("tables for the later types", () => {
  it("builds the overlap matrix and summary from the extracted lists", () => {
    const t = overlapMatrix(ctx);
    expect(t.head).toEqual(["Estudo primário", "Silva (2020)", "Lee (2021)", "Nº de revisões"]);
    expect(t.rows[0].slice(1)).toEqual(["●", "●", "2"]);
    expect(overlapSummaryText(ctx)).toContain("Área coberta corrigida de 50%");
  });
  it("summarises AMSTAR 2 with critical flaws and weaknesses apart", () => {
    const t = amstarSummary(ctx);
    expect(t.rows[0]).toEqual(["Silva (2020)", "2", "1", "Confiança baixa"]);
  });
  it("lists the CMO configurations and the declared shortcuts", () => {
    expect(cmoTable(ctx).rows[0]).toEqual(["1", "equipe", "confiança", "adesão", "S1"]);
    const s = shortcutsTable(ctx).rows;
    expect(s.find((r) => r[0].startsWith("Triagem por um revisor"))![1]).toBe("Sim");
    expect(s.find((r) => r[0].startsWith("Sem literatura cinzenta"))![1]).toBe("Não");
  });
});

describe("facts for the later types", () => {
  const input = (type: string): FactsInput => ({
    locale: "pt", def: getReviewType(type)!, review: base(type, { eligibility: [] }), studies: [], fields: [], extraction: new Map(), appraisals: [], grade: [], themes: [], assign: {}, synthesis: {},
    prisma: { identified: 0, duplicatesRemoved: 0, screened: 0, excludedScreening: 0, includedFullText: 0, excludedFullText: 0, finalIncluded: 0, excludedReasons: {} },
    reasonLabels: {}, searches: [], screening: { reviewers: 1, kappaTitleAbstract: null, aiScreening: false, pilot: false }, aiUses: [],
    shortcuts: ["single_screening"], overlap: { cca: 12.5, unique: 40, inclusions: 52, reviews: 5 }, programTheory: "Teoria.", cmo: [{ id: "c", context: "a", mechanism: "b", outcome: "c", evidence: "" }],
  });
  it("carry the declared shortcuts into the methods and limitations so the draft can state them", () => {
    expect((buildFacts("methods_selection", input("rapid")) as any).declaredShortcuts).toEqual(["single_screening"]);
    expect((buildFacts("limitations", input("rapid")) as any).declaredShortcuts).toEqual(["single_screening"]);
  });
  it("give the draft the overlap numbers, so 12.5 is an allowed number and 99 is not", () => {
    const f = buildFacts("results_findings", input("umbrella")) as any;
    expect(f.overlap.cca).toBe(12.5);
    expect(JSON.stringify(f)).not.toContain("99");
  });
  it("give the realist draft the theory and the configurations", () => {
    const f = buildFacts("results_findings", input("realist")) as any;
    expect(f.programTheory).toBe("Teoria.");
    expect(f.configurations).toHaveLength(1);
  });
});

describe("rules checked against the official publications", () => {
  const robins = (o: Record<string, string>) => suggestOverall("robins-i", { D1: "low", D2: "low", D3: "low", D4: "low", D5: "low", D6: "low", D7: "low", ...o });
  it("ROBINS-I: critical beats serious beats no-information beats moderate beats low", () => {
    expect(robins({})).toBe("low");
    expect(robins({ D2: "moderate" })).toBe("moderate");
    expect(robins({ D2: "moderate", D5: "ni" })).toBe("ni");
    expect(robins({ D2: "serious", D5: "ni" })).toBe("serious");
    expect(robins({ D2: "serious", D3: "critical" })).toBe("critical");
  });
  it("ROBINS-I has seven domains and five judgements", () => {
    expect(TOOLS["robins-i"].items).toHaveLength(7);
    expect(TOOLS["robins-i"].scale.map((s) => s.value)).toEqual(["low", "moderate", "serious", "critical", "ni"]);
  });
  it("Newcastle-Ottawa has nine items worth one star each (4 selection, 2 for comparability, 3 outcome)", () => {
    expect(TOOLS.nos.items.map((i) => i.key[0]).join("")).toBe("SSSSCCOOO");
  });
  it("records which tools were compared with the official text, and which were not", () => {
    for (const t of ["amstar2", "robins-i", "nos", "casp"] as const) expect(TOOLS[t].checkedOn, t).toBe("2026-11-26");
    // RoB 2, QUADAS-2 and the MMAT could not be reached from an open source: they must not claim a check.
    for (const t of ["rob2", "quadas2", "mmat"] as const) expect(TOOLS[t].checkedOn, t).toBeUndefined();
  });
  it("AMSTAR 2 keeps the author's advice about overall scores and missing information", () => {
    expect(TOOLS.amstar2.guidance!.pt).toContain("Não some os itens");
    expect(TOOLS.amstar2.guidance!.pt).toContain("benefício da dúvida");
  });
});
