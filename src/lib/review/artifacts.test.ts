import { describe, expect, it } from "vitest";
import { barChart, distribution, esc, evidenceMap, excludedFullText, extractionTable, methodEvidence, robTrafficLight, searchAppendix, studyLabel, summaryOfFindings, synthesisMatrix, themePrevalence, toCsv, type Ctx } from "./artifacts";
import { certaintyOf, downgradeReasons, isGraded, newGradeEntry, type GradeEntry } from "./grade";

const graded = (over: Partial<GradeEntry> = {}): GradeEntry => ({
  ...newGradeEntry("g"), outcome: "Dementia", design: "rct",
  downgrades: { risk_of_bias: 0, inconsistency: 0, indirectness: 0, imprecision: 0, publication_bias: 0 }, ...over,
});
const down = (o: Partial<Record<string, 0 | 1 | 2>>) => ({ risk_of_bias: 0, inconsistency: 0, indirectness: 0, imprecision: 0, publication_bias: 0, ...o }) as GradeEntry["downgrades"];

describe("GRADE certainty", () => {
  it("is not computed until every downgrade domain has been judged", () => {
    expect(certaintyOf(newGradeEntry("x"))).toBeNull();
    expect(isGraded(graded({ downgrades: { risk_of_bias: 0 } }))).toBe(false);
  });
  it("randomised trials start high and observational studies low", () => {
    expect(certaintyOf(graded())).toBe(4);
    expect(certaintyOf(graded({ design: "observational" }))).toBe(2);
  });
  it("each downgrade removes a level, very serious removes two, and the floor is very low", () => {
    expect(certaintyOf(graded({ downgrades: down({ risk_of_bias: 1 }) }))).toBe(3);
    expect(certaintyOf(graded({ downgrades: down({ risk_of_bias: 2, inconsistency: 1 }) }))).toBe(1);
    expect(certaintyOf(graded({ downgrades: down({ risk_of_bias: 2, inconsistency: 2, indirectness: 2, imprecision: 2, publication_bias: 2 }) }))).toBe(1);
  });
  it("upgrades observational evidence only when bias, inconsistency and imprecision are not a concern", () => {
    expect(certaintyOf(graded({ design: "observational", upgrades: { large_effect: 1, dose_response: 1 } }))).toBe(4);
    expect(certaintyOf(graded({ design: "observational", upgrades: { large_effect: 2 }, downgrades: down({ risk_of_bias: 1 }) }))).toBe(1);
  });
  it("never upgrades trials and never exceeds high", () => {
    expect(certaintyOf(graded({ upgrades: { large_effect: 2 } }))).toBe(4);
  });
  it("lists the reasons for downgrading in the user's language", () => {
    expect(downgradeReasons(graded({ downgrades: down({ risk_of_bias: 1, imprecision: 2 }) }), "pt")).toEqual(["Risco de viés (grave)", "Imprecisão (muito grave)"]);
  });
});

const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  locale: "pt", reviewType: "systematic",
  studies: [
    { id: "a", title: "Metformin and dementia", authors: ["Silva, J", "Lee, K"], year: 2020 },
    { id: "b", title: "Statins in the elderly <script>alert(1)</script>", authors: [], year: 2018 },
  ],
  fields: [{ key: "country", label: "País", kind: "text" }, { key: "population", label: "População", kind: "text" }, { key: "intervention", label: "Intervenção", kind: "text" }, { key: "findings", label: "Achados", kind: "list" }],
  extraction: new Map([["a", { country: "Brasil", population: "Idosos; adultos", intervention: "Metformina", findings: "Menor risco" }], ["b", { country: "Brasil", population: "idosos", intervention: "Estatina" }]]),
  appraisals: [{ record_id: "a", tool: "rob2", domains: { D1: { judgement: "low" }, D2: { judgement: "some" }, D3: { judgement: "low" }, D4: { judgement: "high" }, D5: { judgement: "low" } }, overall: "high" }],
  searches: [{ source: "pubmed", method: "api", interface: "review-harvest", query: "a AND b", run_at: "2026-11-25T10:00:00Z", results_count: 120, imported_count: 118, filters: {} }],
  sourceLabel: (id) => (id === "pubmed" ? "PubMed / MEDLINE" : id),
  excluded: [{ id: "x", title: "Excluded one", authors: ["Roe, P"], year: 2019, reason: "wrong_design" }],
  themes: [{ id: "t1", name: "Cognição" }, { id: "t2", name: "Segurança" }],
  assign: { a: ["t1"], b: ["t1", "t2"] },
  grade: [graded()],
  ...over,
});

describe("escaping and export safety", () => {
  it("escapes markup characters", () => {
    expect(esc(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
  });
  it("never lets a paper title inject markup into a figure", () => {
    const all = [...robTrafficLight(ctx()), ...distribution(ctx()), evidenceMap(ctx(), "population", "intervention"), themePrevalence(ctx())].map((f) => f.svg).join("");
    expect(all).not.toContain("<script>");
    expect(barChart("<b>x</b>", [{ label: "<i>y</i>", n: 1 }], "").includes("<i>")).toBe(false);
  });
  it("prefixes CSV cells that a spreadsheet would run as formulas, and doubles quotes", () => {
    const csv = toCsv({ head: ["a"], rows: [['=HYPERLINK("x")'], ['say "hi"'], ["+1"], ["ok"]] });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain(`"'+1"`);
    expect(csv.startsWith("﻿")).toBe(true);
  });
});

describe("tables", () => {
  it("labels a study by first author and year, falling back to the title", () => {
    expect(studyLabel({ authors: ["Silva, J", "Lee, K"], year: 2020, title: "t" })).toBe("Silva et al. (2020)");
    expect(studyLabel({ authors: [], year: null, title: "A very long title that goes on and on forever" }).length).toBeLessThanOrEqual(30);
  });
  it("builds the search appendix from the log", () => {
    expect(searchAppendix(ctx()).rows[0]).toEqual(["PubMed / MEDLINE", "api", "review-harvest", "2026-11-25", "a AND b", "120", "118"]);
  });
  it("builds one extraction row per included study with the field columns", () => {
    const t = extractionTable(ctx());
    expect(t.head).toEqual(["Estudo", "País", "População", "Intervenção", "Achados"]);
    expect(t.rows[0][1]).toBe("Brasil");
    expect(t.rows).toHaveLength(2);
  });
  it("translates exclusion reasons", () => {
    expect(excludedFullText(ctx()).rows[0][2]).toBe("Desenho de estudo não elegível");
  });
  it("marks theme membership and carries the findings", () => {
    const t = synthesisMatrix(ctx());
    expect(t.head).toEqual(["Estudo", "Cognição", "Segurança", "Principais achados"]);
    expect(t.rows[0].slice(1, 3)).toEqual(["●", ""]);
    expect(t.rows[1].slice(1, 3)).toEqual(["●", "●"]);
  });
  it("groups by method and evidence level", () => {
    const c = ctx({ extraction: new Map([["a", { method: "qualitative", evidence_level: "VI" }], ["b", { method: "qualitative", evidence_level: "VI" }]]) });
    expect(methodEvidence(c).rows[0].slice(0, 3)).toEqual(["qualitative", "VI", "2"]);
  });
  it("shows the computed certainty with its symbols and rates unrated outcomes as such", () => {
    const t = summaryOfFindings(ctx({ grade: [graded(), { ...newGradeEntry("n"), outcome: "Mortality" }] }));
    expect(t.rows[0][4]).toBe("⊕⊕⊕⊕ Alta");
    expect(t.rows[1][4]).toBe("não classificado");
  });
});

describe("figures", () => {
  it("draws a symbol with every colour so the plot survives greyscale", () => {
    const [fig] = robTrafficLight(ctx());
    expect(fig.title).toBe("RoB 2");
    expect(fig.svg).toContain("−");
    expect(fig.svg).toContain("?");
    expect(fig.svg).toContain("+");
  });
  it("skips tools that have no overall judgement, such as the MMAT", () => {
    expect(robTrafficLight(ctx({ appraisals: [{ record_id: "a", tool: "mmat", domains: { S1: { judgement: "yes" } }, overall: null }] }))).toHaveLength(0);
  });
  it("counts studies per year in order and per country when the field exists", () => {
    const figs = distribution(ctx());
    expect(figs.map((f) => f.title)).toEqual(["Estudos por ano", "Estudos por país"]);
    expect(figs[0].svg.indexOf("2018")).toBeLessThan(figs[0].svg.indexOf("2020"));
  });
  it("buckets free text by its first value so case and lists do not split a cell", () => {
    const f = evidenceMap(ctx(), "population", "intervention");
    expect(f.svg).toContain("idosos");
    expect((f.svg.match(/<circle/g) ?? []).length).toBe(2);
  });
  it("explains itself when the chosen fields are empty", () => {
    expect(evidenceMap(ctx({ extraction: new Map() }), "population", "intervention").svg).toContain("Preencha");
  });
  it("counts studies per theme", () => {
    expect(themePrevalence(ctx()).svg).toContain("Cognição");
  });
});
