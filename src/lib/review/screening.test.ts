import { describe, expect, it } from "vitest";
import { agreement, normalize, prismaCounts, reasonsFor, reconcile, reconcileAll, summarizePhase, type DecisionRow, type Phase, type Vote } from "./screening";

const d = (record_id: string, user_id: string | null, decision: Vote, over: Partial<DecisionRow> = {}): DecisionRow => ({
  record_id, user_id, decision, phase: "title_abstract", reason_code: null, source: "human", ...over,
});
const R = ["u1", "u2"];

describe("reconcile", () => {
  it("stays pending until every reviewer has voted", () => {
    expect(reconcile([d("a", "u1", "include")], "title_abstract", R).status).toBe("pending");
  });

  it("treats include and maybe as agreement at title/abstract", () => {
    const r = reconcile([d("a", "u1", "include"), d("a", "u2", "maybe")], "title_abstract", R);
    expect(r).toMatchObject({ status: "agreed", outcome: "advance" });
  });

  it("flags include versus exclude as a conflict", () => {
    expect(reconcile([d("a", "u1", "include"), d("a", "u2", "exclude")], "title_abstract", R).status).toBe("conflict");
  });

  it("lets an adjudication settle a conflict", () => {
    const r = reconcile([d("a", "u1", "include"), d("a", "u2", "exclude"), d("a", "adj", "exclude", { source: "adjudication" })], "title_abstract", R);
    expect(r).toMatchObject({ status: "adjudicated", outcome: "exclude" });
  });

  it("ignores AI rows and votes from people who are not reviewers", () => {
    const votes = [d("a", null, "include", { source: "ai" }), d("a", "stranger", "include"), d("a", "u1", "exclude")];
    expect(reconcile(votes, "title_abstract", ["u1"])).toMatchObject({ status: "agreed", outcome: "exclude" });
    expect(reconcile(votes, "title_abstract", R).status).toBe("pending");
  });

  it("with one reviewer, that reviewer decides alone", () => {
    expect(reconcile([d("a", "u1", "exclude")], "title_abstract", ["u1"])).toMatchObject({ status: "agreed", outcome: "exclude" });
  });

  it("carries the first reviewer's exclusion reason at full text", () => {
    const ft = (u: string) => d("a", u, "exclude", { phase: "full_text", reason_code: u === "u1" ? "wrong_design" : "wrong_outcome" });
    expect(reconcile([ft("u1"), ft("u2")], "full_text", R)).toMatchObject({ status: "agreed", outcome: "exclude", reasonCode: "wrong_design" });
  });

  it("ignores votes from another phase", () => {
    expect(reconcile([d("a", "u1", "include", { phase: "full_text" })], "title_abstract", ["u1"]).status).toBe("pending");
  });
});

describe("phase summary", () => {
  const votes = [
    d("a", "u1", "include"), d("a", "u2", "include"),
    d("b", "u1", "exclude"), d("b", "u2", "exclude"),
    d("c", "u1", "include"), d("c", "u2", "exclude"),
    d("d", "u1", "include"),
  ];
  const s = summarizePhase(reconcileAll(["a", "b", "c", "d", "e"], votes, "title_abstract", R));

  it("counts every state", () => {
    expect(s).toMatchObject({ total: 5, advance: 1, exclude: 1, conflicts: 1, pending: 2 });
  });
  it("cannot be closed while anything is pending or in conflict", () => {
    expect(s.closable).toBe(false);
  });
  it("can be closed once all are decided", () => {
    const done = summarizePhase(reconcileAll(["a", "b"], votes, "title_abstract", R));
    expect(done.closable).toBe(true);
  });
  it("an empty phase is not closable", () => {
    expect(summarizePhase(new Map()).closable).toBe(false);
  });
});

describe("agreement", () => {
  it("is null with fewer than two reviewers and perfect when they always agree", () => {
    expect(agreement([], "title_abstract", ["u1"]).kappa).toBeNull();
    const votes = [d("a", "u1", "include"), d("a", "u2", "include"), d("b", "u1", "exclude"), d("b", "u2", "exclude")];
    expect(agreement(votes, "title_abstract", R)).toEqual({ kappa: 1, compared: 2 });
  });
  it("only compares records both reviewers voted on", () => {
    expect(agreement([d("a", "u1", "include"), d("b", "u2", "include")], "title_abstract", R).compared).toBe(0);
  });
});

describe("normalize", () => {
  it("collapses maybe into advance only at title/abstract", () => {
    const ph = (p: Phase) => normalize(p, "maybe");
    expect(ph("title_abstract")).toBe("advance");
    expect(ph("full_text")).toBe("maybe");
  });
});

describe("prismaCounts", () => {
  const rows = [
    { duplicate_of: "x", screen_status: "pending" as const, exclusion_reason_code: null },
    { duplicate_of: null, screen_status: "ta_excluded" as const, exclusion_reason_code: null },
    { duplicate_of: null, screen_status: "ft_excluded" as const, exclusion_reason_code: "wrong_design" },
    { duplicate_of: null, screen_status: "ft_excluded" as const, exclusion_reason_code: "wrong_design" },
    { duplicate_of: null, screen_status: "ft_excluded" as const, exclusion_reason_code: null },
    { duplicate_of: null, screen_status: "included" as const, exclusion_reason_code: null },
  ];
  it("derives every PRISMA number from record status", () => {
    expect(prismaCounts(rows)).toEqual({
      identified: 6, duplicatesRemoved: 1, screened: 5, excludedScreening: 1,
      includedFullText: 4, excludedFullText: 3, finalIncluded: 1, excludedReasons: { wrong_design: 2, other: 1 },
    });
  });
  it("balances: identified = duplicates + screened, assessed = excluded + included", () => {
    const c = prismaCounts(rows);
    expect(c.identified).toBe(c.duplicatesRemoved + c.screened);
    expect(c.includedFullText).toBe(c.excludedFullText + c.finalIncluded);
  });
});

describe("exclusion reasons", () => {
  it("offers comparator only to effectiveness-style reviews and context to scoping", () => {
    expect(reasonsFor("systematic").some((r) => r.code === "wrong_comparator")).toBe(true);
    expect(reasonsFor("scoping").some((r) => r.code === "wrong_comparator")).toBe(false);
    expect(reasonsFor("scoping").some((r) => r.code === "wrong_context")).toBe(true);
    expect(reasonsFor("systematic").some((r) => r.code === "other")).toBe(true);
  });
});
