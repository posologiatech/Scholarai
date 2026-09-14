import { describe, it, expect } from "vitest";
import { compactProfile, detectType, pearson, profileDataset } from "./profile";

function table(columns: string[], rows: Record<string, string>[]) {
  return { columns, rows };
}

describe("detectType", () => {
  it("recognises numeric columns", () => {
    expect(detectType(["1", "2.5", "3", ""])).toBe("numeric");
  });

  it("recognises boolean columns", () => {
    expect(detectType(["sim", "não", "sim"])).toBe("boolean");
  });

  it("recognises dates", () => {
    expect(detectType(["2024-01-05", "2024-02-11", "2024-03-01"])).toBe("datetime");
  });

  it("recognises low-cardinality categoricals", () => {
    const values = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C"));
    expect(detectType(values)).toBe("categorical");
  });
});

describe("missing values", () => {
  it("counts shared NA tokens as missing, not as categories", () => {
    const profile = profileDataset(
      table(["v"], [{ v: "1" }, { v: "" }, { v: "NA" }, { v: "n/a" }, { v: "2" }])
    );
    const col = profile.columns[0];
    expect(col.missing).toBe(3);
    expect(col.count).toBe(2);
  });

  it("does not treat a literal 999 as missing when it is a plausible value", () => {
    // A cost column where 999 sits inside the normal range must stay a real value.
    const rows = Array.from({ length: 40 }, (_, i) => ({ custo: String(900 + i * 5) }));
    const profile = profileDataset(table(["custo"], rows));
    const col = profile.columns[0];
    expect(col.missing).toBe(0);
    expect(col.sentinels).toBeUndefined();
  });
});

describe("sentinel detection", () => {
  it("flags a repeated 999 that sits far outside the column's range", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ idade: String(30 + (i % 40)) })),
      ...Array.from({ length: 5 }, () => ({ idade: "999" })),
    ];
    const profile = profileDataset(table(["idade"], rows));
    const col = profile.columns[0];

    expect(col.sentinels?.[0]).toMatchObject({ value: 999, count: 5 });
    expect(profile.warnings.some((w) => w.severity === "critical" && w.column === "idade")).toBe(true);
  });

  it("ignores a sentinel that appears only once in a large column", () => {
    const rows = [
      ...Array.from({ length: 500 }, (_, i) => ({ idade: String(20 + (i % 60)) })),
      { idade: "999" },
    ];
    const profile = profileDataset(table(["idade"], rows));
    expect(profile.columns[0].sentinels).toBeUndefined();
  });
});

describe("correlations", () => {
  it("pairs values row-wise instead of collapsing each column separately", () => {
    // "b" is missing on the rows where "a" is small. Filtering each column on its
    // own would line up the wrong pairs and invent a correlation.
    const rows = [
      { a: "1", b: "" },
      { a: "2", b: "" },
      { a: "3", b: "3" },
      { a: "4", b: "4" },
      { a: "5", b: "5" },
      { a: "6", b: "6" },
      { a: "7", b: "7" },
    ];
    const profile = profileDataset(table(["a", "b"], rows));
    const pair = profile.correlations.find((c) => c.col1 === "a" && c.col2 === "b");

    expect(pair?.n).toBe(5);
    expect(pair?.value).toBeCloseTo(1, 5);
  });

  it("excludes identifier columns from the correlation scan", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      id: String(i + 1),
      score: String(i * 2),
    }));
    const profile = profileDataset(table(["id", "score"], rows));

    expect(profile.columns.find((c) => c.name === "id")?.isIdCandidate).toBe(true);
    expect(profile.correlations).toHaveLength(0);
  });

  it("computes pearson correctly", () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1, 6);
    expect(pearson([[1, 6], [2, 4], [3, 2]])).toBeCloseTo(-1, 6);
  });
});

describe("structural warnings", () => {
  it("flags constant columns", () => {
    const rows = Array.from({ length: 30 }, () => ({ grupo: "A", v: "1" }));
    const profile = profileDataset(table(["grupo", "v"], rows));
    expect(profile.columns.find((c) => c.name === "grupo")?.isConstant).toBe(true);
    expect(profile.warnings.some((w) => w.column === "grupo")).toBe(true);
  });

  it("flags a binary column whose minority class is too small to compare", () => {
    const rows = [
      ...Array.from({ length: 200 }, () => ({ obito: "nao" })),
      ...Array.from({ length: 4 }, () => ({ obito: "sim" })),
    ];
    const profile = profileDataset(table(["obito"], rows));
    expect(profile.warnings.some((w) => w.column === "obito" && /minoritária/.test(w.message))).toBe(true);
  });

  it("counts duplicate rows", () => {
    const rows = [{ a: "1" }, { a: "1" }, { a: "2" }];
    expect(profileDataset(table(["a"], rows)).duplicateRows).toBe(1);
  });

  it("orders warnings with the most severe first", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ idade: String(30 + (i % 40)), fixo: "x" })),
      ...Array.from({ length: 5 }, () => ({ idade: "999", fixo: "x" })),
    ];
    const profile = profileDataset(table(["idade", "fixo"], rows));
    expect(profile.warnings[0].severity).toBe("critical");
  });
});

describe("duplicate detection", () => {
  it("does not merge cells into a false duplicate", () => {
    // Concatenating without a separator would make both rows hash to "abc".
    const rows = [
      { a: "a", b: "bc" },
      { a: "ab", b: "c" },
    ];
    expect(profileDataset({ columns: ["a", "b"], rows }).duplicateRows).toBe(0);
  });
});

describe("compactProfile", () => {
  it("keeps what the model needs to choose a test, and flags what to avoid", () => {
    const rows = [
      ...Array.from({ length: 60 }, (_, i) => ({
        id: String(i + 1),
        idade: String(40 + (i % 30)),
        sexo: i % 3 === 0 ? "F" : "M",
        fixo: "x",
      })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: String(100 + i), idade: "999", sexo: "F", fixo: "x" })),
    ];
    const compact = compactProfile(profileDataset({ columns: ["id", "idade", "sexo", "fixo"], rows }), 5000);

    const byName = Object.fromEntries(compact.columns.map((c) => [c.name, c]));
    expect(byName.id.role).toBe("id");
    expect(byName.fixo.role).toBe("constant");
    expect(byName.idade.sentinels).toContain(999);
    expect(byName.idade.stats?.mean).toBeGreaterThan(0);
    expect(byName.sexo.levels?.map((l) => l.value).sort()).toEqual(["F", "M"]);

    // The file is bigger than what was profiled, and the payload must say so.
    expect(compact.sampled).toBe(true);
    expect(compact.totalRows).toBe(5000);
    expect(compact.basedOnRows).toBe(65);
  });

  it("stays small enough to resend on every request", () => {
    const columns = Array.from({ length: 40 }, (_, i) => `col_${i}`);
    const rows = Array.from({ length: 2000 }, (_, r) =>
      Object.fromEntries(columns.map((c, i) => [c, String((r * (i + 1)) % 97)]))
    );
    const compact = compactProfile(profileDataset({ columns, rows }));

    expect(JSON.stringify(compact).length).toBeLessThan(60000);
  });
});
