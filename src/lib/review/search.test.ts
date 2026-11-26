import { describe, expect, it } from "vitest";
import { dedupeKey, groupDuplicates, normalizeDoi, normalizeTitle, summarize, type DedupeRecord } from "./dedupe";
import { toRecords } from "./importer";
import { renderQuery, type QueryBlock } from "./query";

const blocks: QueryBlock[] = [
  { id: "p", label: "P", terms: ["older adults", "elderly"], headings: ["Aged"] },
  { id: "i", label: "I", terms: ["metformin"], headings: ["Metformin"] },
  { id: "o", label: "O", terms: ["dementia", "alzheimer*"], headings: [] },
];

describe("renderQuery", () => {
  it("builds a PubMed string with tiab terms, MeSH headings and a date range", () => {
    const q = renderQuery(blocks, "pubmed", { yearMin: 2015, yearMax: 2025 });
    expect(q.text).toContain('("older adults"[tiab] OR elderly[tiab] OR "Aged"[MeSH Terms])');
    expect(q.text).toContain("alzheimer*[tiab]");
    expect(q.text.endsWith("2015:2025[dp]")).toBe(true);
    expect(q.text.split(" AND ").length).toBe(4);
  });

  it("uses Scopus and Web of Science field syntax", () => {
    expect(renderQuery(blocks, "scopus", { yearMin: 2015, yearMax: 2025 }).text).toContain('TITLE-ABS-KEY("older adults" OR elderly OR Aged)');
    expect(renderQuery(blocks, "scopus", { yearMin: 2015, yearMax: 2025 }).text).toContain("PUBYEAR > 2014 AND PUBYEAR < 2026");
    expect(renderQuery(blocks, "wos", { yearMin: 2015, yearMax: 2025 }).text).toContain("PY=(2015-2025)");
  });

  it("builds numbered Ovid lines and combines them", () => {
    const q = renderQuery(blocks, "ovid");
    expect(q.text).toMatch(/^1\. \("older adults" or elderly\)\.ti,ab,kf\./);
    expect(q.text).toContain("exp Aged/");
    expect(q.text.trim().split("\n").pop()).toMatch(/and/);
  });

  it("skips empty blocks and says so when nothing is left", () => {
    const empty = renderQuery([{ id: "x", label: "x", terms: [" "], headings: [] }], "pubmed");
    expect(empty.text).toBe("");
    expect(empty.notes.length).toBe(1);
    expect(renderQuery([...blocks, { id: "z", label: "z", terms: [], headings: [] }], "simple").text.split(" AND ").length).toBe(3);
  });

  it("strips quotes typed by the user so the string cannot break", () => {
    expect(renderQuery([{ id: "a", label: "a", terms: ['he said "x"'], headings: [] }], "simple").text).toBe('("he said x")');
  });

  it("always warns when a dialect needs checking by hand", () => {
    for (const s of ["ovid", "ebsco", "bvs", "scopus", "wos"] as const) expect(renderQuery(blocks, s).notes.length).toBeGreaterThan(0);
  });
});

describe("dedupe", () => {
  it("normalizes DOIs from several shapes and rejects non-DOIs", () => {
    expect(normalizeDoi("https://doi.org/10.1000/ABC.1.")).toBe("10.1000/abc.1");
    expect(normalizeDoi("doi: 10.1000/abc.1")).toBe("10.1000/abc.1");
    expect(normalizeDoi("PMC12345")).toBeNull();
  });

  it("ignores case, accents and punctuation in titles", () => {
    expect(normalizeTitle("Efeito da Metformina: um ensaio!")).toBe("efeito da metformina um ensaio");
  });

  it("does not trust very short titles as identity", () => {
    expect(dedupeKey({ title: "Editorial", year: 2020, authors: ["A"] })).toBeNull();
  });

  const recs: DedupeRecord[] = [
    { id: "a", title: "Metformin and the risk of dementia in older adults", year: 2020, authors: ["Silva, J"], doi: "10.1/x", abstract: null },
    { id: "b", title: "Metformin and the risk of dementia in older adults", year: 2020, authors: ["Silva, J"], doi: "https://doi.org/10.1/X", abstract: "Full abstract" },
    { id: "c", title: "Aspirin for primary prevention of cardiovascular events", year: 2019, authors: ["Lee, K"], doi: null, abstract: null },
    { id: "d", title: "Aspirin for primary prevention of cardiovascular events", year: 2019, authors: ["Lee, K"], doi: null, abstract: "Has abstract" },
    { id: "e", title: "Statins in the elderly: a randomised trial of outcomes", year: 2018, authors: ["Roe, P"], doi: null, abstract: null },
    { id: "f", title: "Statins in the elderly: a randomised trial of outcome", year: 2018, authors: ["Roe, P."], doi: null, abstract: null },
    { id: "g", title: "Completely unrelated paper about soil chemistry", year: 2018, authors: ["Zed"], doi: null, abstract: null },
  ];

  it("groups by DOI first and keeps the record with an abstract", () => {
    const g = groupDuplicates(recs).find((x) => x.reason === "doi")!;
    expect(g.keepId).toBe("b");
    expect(g.duplicateIds).toEqual(["a"]);
    expect(g.confidence).toBe("certain");
  });

  it("merges same title, year and first author without a DOI as certain", () => {
    const g = groupDuplicates(recs).find((x) => x.reason === "title_year_author")!;
    expect(g.keepId).toBe("d");
    expect(g.confidence).toBe("certain");
  });

  it("flags a near-identical title for human review and leaves unrelated ones alone", () => {
    const groups = groupDuplicates(recs);
    const fuzzy = groups.find((x) => x.reason === "similar_title")!;
    expect(fuzzy.confidence).toBe("check");
    expect(new Set([fuzzy.keepId, ...fuzzy.duplicateIds])).toEqual(new Set(["e", "f"]));
    expect(groups.flatMap((x) => [x.keepId, ...x.duplicateIds])).not.toContain("g");
  });

  it("asks a human when equal titles carry different DOIs", () => {
    const g = groupDuplicates([
      { id: "p1", title: "Same long title about a trial of drugs", year: 2020, authors: ["A"], doi: "10.1/pre" },
      { id: "p2", title: "Same long title about a trial of drugs", year: 2020, authors: ["A"], doi: "10.1/final" },
    ]);
    expect(g[0].confidence).toBe("check");
  });

  it("counts review groups as removed only once accepted", () => {
    const groups = groupDuplicates(recs);
    expect(summarize(7, groups).removed).toBe(2);
    expect(summarize(7, groups, new Set(["e", "f"])).removed).toBe(3);
    expect(summarize(7, groups).remaining).toBe(5);
  });

  it("stays fast on a few thousand records", () => {
    const many: DedupeRecord[] = Array.from({ length: 5000 }, (_, i) => ({ id: `r${i}`, title: `Unique study number ${i} about topic ${i * 7}`, year: 2000 + (i % 20), authors: [`Auth${i}`] }));
    const t = performance.now();
    groupDuplicates(many);
    expect(performance.now() - t).toBeLessThan(3000);
  });
});

describe("toRecords", () => {
  it("normalizes DOI, drops untitled entries and fills the dedupe key", () => {
    const rows = toRecords(
      [{ title: "A sufficiently long title here", doi: "https://doi.org/10.5/Z", year: 2021, authors: ["Souza, A"] }, { title: "  " }],
      { reviewId: "r", searchId: "s", source: "embase" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ doi: "10.5/z", source: "embase", review_id: "r", search_id: "s" });
    expect(rows[0].dedupe_key).toContain("souza");
  });
});

describe("dedupe keeps what is already in use", () => {
  it("keeps a screened record even when a new one has the abstract and DOI", () => {
    const [g] = groupDuplicates([
      { id: "old", title: "Same long title about metformin and dementia", year: 2020, authors: ["Silva, J"], doi: null, abstract: null, locked: true },
      { id: "new", title: "Same long title about metformin and dementia", year: 2020, authors: ["Silva, J"], doi: "10.1/x", abstract: "Full abstract" },
    ]);
    expect(g.keepId).toBe("old");
    expect(g.duplicateIds).toEqual(["new"]);
  });
});
