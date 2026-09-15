import { describe, it, expect } from "vitest";
import {
  MAX_PLAN_STEPS,
  buildStepMessage,
  buildSynthesisMessage,
  extractPlanArray,
  formatPlanAnnouncement,
  formatStepHeading,
  normalizePlan,
} from "./analysisPlan";

const twoSteps = [
  { title: "Preparo", goal: "Tratar ausentes e códigos sentinela." },
  { title: "Teste", goal: "Comparar idade entre os grupos." },
];

describe("normalizePlan", () => {
  it("keeps a well-formed plan", () => {
    expect(normalizePlan(twoSteps)).toEqual(twoSteps);
  });

  it("rejects anything that is not a usable plan", () => {
    expect(normalizePlan(null)).toEqual([]);
    expect(normalizePlan("etapa 1, etapa 2")).toEqual([]);
    expect(normalizePlan([])).toEqual([]);
    // One step is a normal answer, not a plan.
    expect(normalizePlan([{ title: "A", goal: "B" }])).toEqual([]);
  });

  it("accepts a plain list of strings", () => {
    const plan = normalizePlan(["Descrever os dados", "Comparar os grupos"]);
    expect(plan).toEqual([
      { title: "Descrever os dados", goal: "Descrever os dados" },
      { title: "Comparar os grupos", goal: "Comparar os grupos" },
    ]);
  });

  it("fills in the missing half of a step", () => {
    const plan = normalizePlan([{ title: "Só título" }, { description: "Só descrição" }]);
    expect(plan).toEqual([
      { title: "Só título", goal: "Só título" },
      { title: "Só descrição", goal: "Só descrição" },
    ]);
  });

  it("drops empty and duplicated steps", () => {
    const plan = normalizePlan([
      { title: "A", goal: "Comparar os grupos." },
      { title: "  ", goal: "  " },
      { title: "C", goal: "comparar os grupos." },
      { title: "D", goal: "Ajustar por idade." },
    ]);
    expect(plan.map((s) => s.title)).toEqual(["A", "D"]);
  });

  it("caps the number of steps", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `T${i}`, goal: `Etapa ${i}` }));
    expect(normalizePlan(many)).toHaveLength(MAX_PLAN_STEPS);
  });

  it("collapses whitespace so a heading stays on one line", () => {
    const plan = normalizePlan([{ title: "A\n  B", goal: "x" }, { title: "C", goal: "y" }]);
    expect(plan[0].title).toBe("A B");
  });
});

describe("extractPlanArray", () => {
  it("finds the array inside a reply whose JSON is truncated", () => {
    const raw = `{"explanation": "...", "plan": [{"title": "A", "goal": "a"}, {"title": "B", "goal": "b"}], "code": nu`;
    expect(normalizePlan(extractPlanArray(raw))).toHaveLength(2);
  });

  it("is not fooled by a bracket inside a string", () => {
    const raw = `{"plan": [{"title": "df[0]", "goal": "usar df[\\"col\\"]"}, {"title": "B", "goal": "b"}]}`;
    const plan = normalizePlan(extractPlanArray(raw));
    expect(plan).toHaveLength(2);
    expect(plan[0].title).toBe("df[0]");
  });

  it("returns null while the array is still arriving", () => {
    expect(extractPlanArray(`{"plan": [{"title": "A"`)).toBeNull();
    expect(extractPlanArray(`{"explanation": "sem plano"}`)).toBeNull();
  });
});

describe("prompt text", () => {
  it("announces every step with its number", () => {
    const text = formatPlanAnnouncement(twoSteps);
    expect(text).toContain("2 etapas");
    expect(text).toContain("1. **Preparo**");
    expect(text).toContain("2. **Teste**");
  });

  it("labels a step with its position", () => {
    expect(formatStepHeading(twoSteps[1], 1, 2)).toBe("### Etapa 2 de 2 — Teste");
  });

  it("tells the model which step it is on and what is still to come", () => {
    const msg = buildStepMessage("Os grupos diferem?", twoSteps, 0);
    expect(msg).toContain("Os grupos diferem?");
    expect(msg).toContain("ETAPA 1 DE 2");
    expect(msg).toContain("Tratar ausentes");
    expect(msg).toContain("2. Teste");
  });

  it("does not resend a huge pasted block once per step", () => {
    const pasted = `Analise isto${String.fromCharCode(10)}${"col_a,col_b" + String.fromCharCode(10).repeat(1)}`.padEnd(9000, "x");
    const msg = buildStepMessage(pasted, twoSteps, 0);
    expect(msg.length).toBeLessThan(3000);
    expect(msg).toContain("Analise isto");
    expect(msg).toContain("omitido");
  });

  it("marks the last step as the last one", () => {
    expect(buildStepMessage("q", twoSteps, 1)).toContain("última etapa");
  });

  it("asks the synthesis to answer from the results, without code", () => {
    const msg = buildSynthesisMessage("Os grupos diferem?", twoSteps);
    expect(msg).toContain("SÍNTESE FINAL");
    expect(msg).toContain("não gere código");
  });
});
