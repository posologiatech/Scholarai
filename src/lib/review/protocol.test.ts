import { describe, expect, it } from "vitest";
import { buildProtocolDocument, type ReviewRecord } from "./protocol";
import { buildReviewState } from "./state";
import { currentStage, evaluateGate, frameworkName, getReviewType } from "./types";

const base: ReviewRecord = {
  id: "r1", owner_id: "u1", review_type: "scoping", title: "Telessaúde", question: "O que se sabe sobre telessaúde na APS?",
  area: "health", locale: "pt", definition_version: "0.1.0",
  framework: { population: "Adultos", concept: "Telessaúde", context: "Atenção primária" },
  eligibility: [{ kind: "include", text: "Estudos de 2015 a 2025" }, { kind: "exclude", text: "Editoriais" }],
  registry: {}, protocol_document: null, protocol_locked_at: null, protocol_locked_by: null,
  current_stage: "scope", stage_state: {}, research_project_id: null, created_at: "", updated_at: "",
};

describe("buildReviewState", () => {
  it("flattens the framework into dotted gate fields", () => {
    expect(buildReviewState(base).fields["framework.concept"]).toBe("Telessaúde");
  });

  it("moves a scoping review from scope to protocol once title and area exist", () => {
    const def = getReviewType("scoping")!;
    expect(currentStage(def, buildReviewState(base)).key).toBe("protocol");
  });

  it("only lets the protocol stage pass once locked", () => {
    const def = getReviewType("scoping")!;
    const stage = def.stages.find((s) => s.key === "protocol")!;
    expect(evaluateGate(stage, buildReviewState(base)).missing.map((m) => m.pt)).toEqual(["Congelar o protocolo"]);
    expect(evaluateGate(stage, buildReviewState({ ...base, protocol_locked_at: "2026-11-25T00:00:00Z" })).ok).toBe(true);
  });

  it("starts an integrative review at problem identification", () => {
    const def = getReviewType("integrative")!;
    const r: ReviewRecord = { ...base, review_type: "integrative", framework: {} };
    expect(currentStage(def, buildReviewState(r)).key).toBe("scope");
  });
});

describe("framework name", () => {
  it("shows a translated label for types without an acronym, the acronym otherwise", () => {
    expect(frameworkName(getReviewType("integrative")!, "pt")).toBe("Problema, população e variáveis");
    expect(frameworkName(getReviewType("integrative")!, "en")).toBe("Problem, population and variables");
    expect(frameworkName(getReviewType("scoping")!, "pt")).toBe("PCC");
  });
});

describe("buildProtocolDocument", () => {
  const def = getReviewType("scoping")!;
  const doc = buildProtocolDocument(def, base, "2026-11-25T12:00:00.000Z");

  it("records the question, PCC and both criteria kinds", () => {
    expect(doc).toContain("telessaúde na APS");
    expect(doc).toContain("**Conceito:** Telessaúde");
    expect(doc).toContain("### Inclusão");
    expect(doc).toContain("- Editoriais");
  });

  it("stamps the lock time and the definition version", () => {
    expect(doc).toContain("2026-11-25T12:00:00.000Z");
    expect(doc).toContain("0.1.0");
  });

  it("marks empty fields instead of omitting them", () => {
    const empty = buildProtocolDocument(def, { ...base, framework: {}, eligibility: [] }, "2026-11-25T12:00:00.000Z");
    expect(empty).toContain("**População:** —");
  });
});
