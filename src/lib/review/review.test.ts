import { describe, expect, it } from "vitest";
import { accessSummary, recommendSources, SOURCES } from "./databases";
import { AVAILABLE_TYPES, currentStage, evaluateGate, getReviewType, validateDefinition } from "./types";
import type { ReviewState } from "./types";

const empty: ReviewState = { fields: {}, metrics: {}, flags: {} };

describe("review type definitions", () => {
  it.each(AVAILABLE_TYPES.map((t) => [t.id, t] as const))("%s is a valid definition", (_id, def) => {
    expect(validateDefinition(def)).toEqual([]);
  });

  it("all eight review types are registered", () => {
    expect(AVAILABLE_TYPES.map((t) => t.id).sort()).toEqual(["integrative", "narrative", "qualitative", "rapid", "realist", "scoping", "systematic", "umbrella"]);
  });

  it("records who signed off the first three definitions and keeps the newer ones flagged until they are signed off", () => {
    for (const t of AVAILABLE_TYPES.filter((x) => ["systematic", "scoping", "integrative"].includes(x.id))) {
      expect(t.review.status).toBe("verified");
      expect(t.review.verifiedBy).toBeTruthy();
      expect(t.review.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const t of AVAILABLE_TYPES.filter((x) => !["systematic", "scoping", "integrative"].includes(x.id))) expect(t.review.status).toBe("pending-expert-review");
  });

  it("uses the right question framework per type", () => {
    expect(getReviewType("systematic")!.framework.name).toBe("PICO");
    expect(getReviewType("scoping")!.framework.name).toBe("PCC");
    expect(getReviewType("scoping")!.reportingGuideline.id).toBe("prisma-scr");
  });

  it("requires appraisal for systematic and integrative but not for scoping", () => {
    expect(getReviewType("systematic")!.appraisal.required).toBe(true);
    expect(getReviewType("integrative")!.appraisal.required).toBe(true);
    expect(getReviewType("scoping")!.appraisal.required).toBe(false);
  });

  it("only systematic reviews require dual screening", () => {
    expect(getReviewType("systematic")!.screening.dual).toBe("required");
    expect(getReviewType("scoping")!.screening.dual).toBe("recommended");
  });

  it("rejects a broken definition", () => {
    const broken = { ...getReviewType("scoping")!, stages: getReviewType("scoping")!.stages.slice().reverse() };
    expect(validateDefinition(broken)).toContain("stages out of order");
  });
});

describe("gate engine", () => {
  const sys = getReviewType("systematic")!;

  it("blocks the first stage on an empty review and says what is missing", () => {
    const stage = currentStage(sys, empty);
    expect(stage.key).toBe("scope");
    expect(evaluateGate(stage, empty).missing.length).toBeGreaterThan(0);
  });

  it("advances once the scope fields are filled", () => {
    const state: ReviewState = { ...empty, fields: { title: "Metformina", area: "pharmacy" } };
    expect(currentStage(sys, state).key).toBe("protocol");
  });

  it("does not treat blank strings or empty lists as filled", () => {
    const stage = sys.stages[0];
    expect(evaluateGate(stage, { ...empty, fields: { title: "  ", area: [] } }).ok).toBe(false);
  });

  it("lets an optional stage be skipped only by an explicit flag", () => {
    const def = { ...sys, stages: sys.stages.map((s) => (s.key === "synthesis" ? { ...s, optional: true } : s)) };
    const done: ReviewState = {
      fields: { title: "x", area: "x", "framework.population": "x", "framework.intervention": "x", "framework.outcome": "x", eligibility: ["x"], protocol_locked_at: "x" },
      metrics: { sources_selected: 3, searches_logged: 3, records: 10, reviewers: 2, title_abstract_done_pct: 100, open_conflicts_zero: 1, full_text_done_pct: 100, extraction_verified_pct: 100, appraisal_done_pct: 100 },
      flags: { strategy_approved: true, duplicates_reviewed: true },
    };
    expect(currentStage(def, done).key).toBe("synthesis");
    expect(currentStage(def, { ...done, flags: { ...done.flags, "skip:synthesis": true } }).key).toBe("writing");
  });
});

describe("source catalogue and recommender", () => {
  it("has unique ids", () => {
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });

  it("marks sources behind bot challenges as import-only", () => {
    for (const id of ["scielo", "lilacs", "cochrane_central"]) expect(SOURCES.find((s) => s.id === id)!.access).toBe("import");
  });

  it("never marks a licensed database as integrated", () => {
    for (const id of ["embase", "scopus", "wos", "cinahl", "psycinfo"]) expect(SOURCES.find((s) => s.id === id)!.access).toBe("import");
  });

  it("recommends MEDLINE, Embase and CENTRAL as core for a health systematic review", () => {
    const core = recommendSources("systematic", "health").filter((r) => r.tier === "core").map((r) => r.source.id);
    expect(core).toEqual(expect.arrayContaining(["pubmed", "embase", "cochrane_central"]));
  });

  it("adds grey literature for scoping and no duplicates in any recommendation", () => {
    const recs = recommendSources("scoping", "nursing");
    const ids = recs.map((r) => r.source.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("bdtd");
    expect(accessSummary(recs).integrated).toBeGreaterThan(0);
  });
});
