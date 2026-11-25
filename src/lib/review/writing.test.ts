import { describe, expect, it } from "vitest";
import { CHECKLISTS, INTEGRATIVE_ADAPTED, PRISMA_2020, PRISMA_SCR } from "./checklists";
import { allowedNumbers, autoText, buildFacts, referenceList, renderCitations, verifyDraft, withKeys, type FactsInput } from "./facts";
import { manuscriptFor, MASTER_SECTIONS, sectionOfItem } from "./manuscript";
import type { ReviewRecord } from "./protocol";
import { getReviewType } from "./types";

describe("checklists", () => {
  it("PRISMA 2020 has 27 numbered items (42 with sub-items) and PRISMA-ScR 22 of which 2 are optional", () => {
    expect(new Set(PRISMA_2020.items.map((i) => i.key.replace(/[a-f]$/, ""))).size).toBe(27);
    expect(PRISMA_2020.items).toHaveLength(42);
    expect(PRISMA_SCR.items).toHaveLength(22);
    expect(PRISMA_SCR.items.filter((i) => i.optional).map((i) => i.key)).toEqual(["12", "16"]);
  });
  it("has unique keys, text in both languages, and flags the integrative list as an adaptation", () => {
    for (const c of Object.values(CHECKLISTS)) {
      expect(new Set(c.items.map((i) => i.key)).size).toBe(c.items.length);
      for (const i of c.items) { expect(i.text.pt.length).toBeGreaterThan(10); expect(i.text.en.length).toBeGreaterThan(10); }
    }
    expect(INTEGRATIVE_ADAPTED.official).toBe(false);
    expect(PRISMA_2020.official).toBe(true);
  });
});

describe("manuscript structure", () => {
  it("maps every checklist item of every guideline to a section that exists", () => {
    const keys = new Set(MASTER_SECTIONS.map((s) => s.key));
    for (const c of Object.values(CHECKLISTS)) for (const i of c.items) {
      const sec = sectionOfItem(c.id, i.key);
      expect(sec, `${c.id} item ${i.key}`).toBeTruthy();
      expect(keys.has(sec!), `${c.id} item ${i.key} -> ${sec}`).toBe(true);
    }
  });
  it("keeps only the sections a type needs", () => {
    const sys = manuscriptFor(getReviewType("systematic")!).sections.map((s) => s.key);
    const scr = manuscriptFor(getReviewType("scoping")!).sections.map((s) => s.key);
    expect(sys).toContain("methods_certainty");
    expect(scr).not.toContain("methods_certainty");
    expect(sys.indexOf("abstract")).toBeLessThan(sys.indexOf("results_selection"));
  });
  it("never lets the AI write what needs outside literature or the author's judgement", () => {
    const m = Object.fromEntries(MASTER_SECTIONS.map((s) => [s.key, s.mode]));
    expect(m.rationale).toBe("manual");
    expect(m.discussion).toBe("manual");
    expect(m.registration).toBe("auto");
    expect(m.methods_sources).toBe("auto");
  });
});

const review = {
  id: "r", locale: "pt", title: "Metformina", question: "A metformina reduz demência?",
  framework: { population: "Idosos", intervention: "Metformina", outcome: "Demência" },
  eligibility: [{ kind: "include", text: "Ensaios" }, { kind: "exclude", text: "Editoriais" }],
  registry: { id: "CRD42026000001" }, protocol_locked_at: "2026-03-01T12:00:00Z",
} as unknown as ReviewRecord;

const studies = withKeys([
  { id: "a", title: "Metformin and dementia in older adults", year: 2020, authors: ["Silva, J", "Lee, K"] },
  { id: "b", title: "Statins in the elderly", year: 2018, authors: ["Roe, P"] },
]);

const input = (over: Partial<FactsInput> = {}): FactsInput => ({
  locale: "pt", def: getReviewType("systematic")!, review, studies, fields: [{ key: "country", label: "País", kind: "text" }, { key: "sample_size", label: "Tamanho da amostra", kind: "number" }, { key: "effect", label: "Efeito", kind: "text" }],
  extraction: new Map([["a", { country: "Brasil", sample_size: "240", effect: "HR 0,78" }], ["b", { country: "Brasil", sample_size: "100", effect: "HR 1,0" }]]),
  appraisals: [], grade: [], themes: [], assign: {}, synthesis: {},
  prisma: { identified: 500, duplicatesRemoved: 120, screened: 380, excludedScreening: 340, includedFullText: 40, excludedFullText: 38, finalIncluded: 2, excludedReasons: { wrong_design: 30, other: 8 } },
  reasonLabels: { wrong_design: "Desenho não elegível" },
  searches: [{ source: "pubmed", label: "PubMed / MEDLINE", method: "api", query: "q", run_at: "2026-03-05T10:00:00Z", results_count: 300, imported_count: 300 }, { source: "embase", label: "Embase", method: "import", query: "q", run_at: "2026-03-06T10:00:00Z", results_count: 250, imported_count: 250 }],
  screening: { reviewers: 2, kappaTitleAbstract: 0.8123, aiScreening: true, pilot: false }, aiUses: ["screening", "extraction"],
  ...over,
});

describe("facts", () => {
  it("gives studies stable keys S1..Sn", () => {
    expect(studies.map((s) => s.key)).toEqual(["S1", "S2"]);
    expect(studies[0].label).toBe("Silva et al. (2020)");
  });
  it("computes the characteristics numbers from the data, never from the model", () => {
    const f = buildFacts("results_characteristics", input()) as any;
    expect(f.totalParticipants).toBe(340);
    expect(f.yearRange).toEqual([2018, 2020]);
    expect(f.countries).toEqual([{ name: "Brasil", n: 2 }]);
  });
  it("carries the flow numbers and the translated exclusion reasons", () => {
    const f = buildFacts("results_selection", input()) as any;
    expect(f.flow.identified).toBe(500);
    expect(f.exclusionReasons).toEqual([{ reason: "Desenho não elegível", n: 30 }, { reason: "other", n: 8 }]);
  });
  it("states that the AI vote was never counted and rounds kappa", () => {
    const f = buildFacts("methods_selection", input()) as any;
    expect(f.aiVoteCounted).toBe(false);
    expect(f.agreementKappaTitleAbstract).toBe(0.81);
  });
});

describe("deterministic sections", () => {
  it("writes the registration statement and asks the author for amendments", () => {
    const t = autoText("registration", input());
    expect(t).toContain("CRD42026000001");
    expect(t).toContain("01/03/2026");
    expect(t).toContain("[descreva");
  });
  it("says it was not registered when there is no registry number", () => {
    expect(autoText("registration", input({ review: { ...review, registry: {} } as ReviewRecord }))).toContain("não foi registrada");
  });
  it("lists each source with date, method and result count", () => {
    const t = autoText("methods_sources", input());
    expect(t).toContain("PubMed / MEDLINE (05/03/2026; consulta direta; 300 resultados)");
    expect(t).toContain("Embase (06/03/2026; exportação importada; 250 resultados)");
    expect(t).toContain("120 duplicatas removidas");
  });
  it("declares exactly the AI uses that happened, and none when there were none", () => {
    const used = autoText("declarations", input());
    expect(used).toContain("segunda opinião na triagem");
    expect(used).toContain("propor valores de extração");
    expect(used).not.toContain("rascunhar");
    expect(autoText("declarations", input({ aiUses: [] }))).toContain("não foram usadas ferramentas de IA");
  });
});

describe("draft verification", () => {
  const facts = buildFacts("results_selection", input());
  const keys = new Set(["S1", "S2"]);

  it("accepts numbers that come from the facts", () => {
    expect(verifyDraft("Foram identificados 500 registros e 120 duplicatas foram removidas [S1].", facts, keys)).toEqual([]);
  });
  it("flags a number that is not in the facts", () => {
    expect(verifyDraft("Foram identificados 512 registros.", facts, keys)).toEqual([{ type: "unsupported_number", snippet: "512" }]);
  });
  it("accepts decimal commas and points as the same number", () => {
    expect(verifyDraft("kappa de 0,81", buildFacts("methods_selection", input()), keys)).toEqual([]);
  });
  it("flags citations of studies that are not in the review, and ignores the digits inside valid keys", () => {
    const issues = verifyDraft("Como mostrado [S1, S9].", facts, keys);
    expect(issues).toEqual([{ type: "unknown_citation", snippet: "S9" }]);
  });
  it("reports each unsupported number once", () => {
    expect(verifyDraft("777 e de novo 777 e 888", facts, keys).map((i) => i.snippet)).toEqual(["777", "888"]);
  });
  it("collects every number in the facts, including those inside text", () => {
    expect(allowedNumbers({ a: "entre 2015 e 2025", b: [3.5, { c: 7 }] })).toEqual(new Set(["2015", "2025", "3.5", "7"]));
  });
});

describe("citations and references", () => {
  it("renders author-year and numbered styles, numbering by first appearance", () => {
    expect(renderCitations("Visto em [S1, S2].", studies, "author-year", [])).toBe("Visto em (Silva et al., 2020; Roe, 2018).");
    const order: string[] = [];
    expect(renderCitations("A [S2] e depois [S1, S2].", studies, "numbered", order)).toBe("A [1] e depois [2, 1].");
    expect(order).toEqual(["S2", "S1"]);
  });
  it("drops a citation of an unknown study instead of printing a fake one", () => {
    expect(renderCitations("x [S9] y", studies, "author-year", [])).toBe("x  y");
  });
  it("lists references alphabetically, or in citation order when numbered", () => {
    const extra = { a: { journal: "Lancet", doi: "10.1/x" } };
    expect(referenceList(studies, extra, null)[0]).toMatch(/^Roe, P\./);
    const numbered = referenceList(studies, extra, ["S1"]);
    expect(numbered[0]).toBe("1. Silva, J, Lee, K. Metformin and dementia in older adults. Lancet. 2020. doi:10.1/x");
  });
});
