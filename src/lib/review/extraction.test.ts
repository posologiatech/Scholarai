import { describe, expect, it } from "vitest";
import { guessTool, isComplete, isImplemented, mmatCounts, starTotal, suggestOverall, TOOLS } from "./appraisal";
import { acceptable, completeness, fieldsFor, slugKey, validateValue, type FieldSpec } from "./extraction";
import type { ReviewRecord } from "./protocol";
import { getReviewType } from "./types";

const base = { locale: "pt", stage_state: {} } as unknown as ReviewRecord;

describe("extraction fields", () => {
  it("combines the type's fields with the team's own, in the user's language", () => {
    const def = getReviewType("scoping")!;
    const r = { ...base, stage_state: { extraction: { fields: [{ key: "x_dose", label: "Dose", kind: "text" }] } } } as unknown as ReviewRecord;
    const f = fieldsFor(def, r);
    expect(f.length).toBe(def.extractionFields.length + 1);
    expect(f[0].label).toBe("Autores e ano");
    expect(f.at(-1)).toMatchObject({ key: "x_dose", custom: true });
  });

  it("builds unique keys for new fields, even for accents and repeats", () => {
    const taken = new Set<string>();
    const a = slugKey("Dose diária", taken); taken.add(a);
    const b = slugKey("Dose diária", taken);
    expect(a).toBe("x_dose_diaria");
    expect(b).toBe("x_dose_diaria_2");
    expect(slugKey("???", new Set())).toBe("x_campo");
  });
});

describe("accepting AI proposals", () => {
  const fields: FieldSpec[] = [{ key: "a", label: "A", kind: "text" }, { key: "b", label: "B", kind: "text" }, { key: "c", label: "C", kind: "text" }];
  const proposals = { a: { value: "1", quote: "q", verified: true }, b: { value: "2", quote: "q", verified: false }, c: { value: "3", quote: "q", verified: true } };

  it("offers only verified proposals for fields still empty", () => {
    expect(acceptable(fields, { c: "mine" }, proposals)).toEqual(["a"]);
  });
  it("never offers an unverified proposal in bulk", () => {
    expect(acceptable(fields, {}, proposals)).not.toContain("b");
  });
  it("counts filled fields, with N/R counting as filled", () => {
    expect(completeness(fields, { a: "x", b: "N/R", c: "  " })).toEqual({ filled: 2, total: 3 });
  });
});

describe("value validation", () => {
  it("accepts decimal commas and blanks, rejects text in numeric fields", () => {
    expect(validateValue("number", "12,5")).toBeNull();
    expect(validateValue("number", "")).toBeNull();
    expect(validateValue("number", "many")).toBe("number");
  });
  it("only accepts listed choices", () => {
    expect(validateValue("choice", "rct", ["rct", "cohort"])).toBeNull();
    expect(validateValue("choice", "other", ["rct", "cohort"])).toBe("choice");
  });
});

describe("appraisal tools", () => {
  const rob = (v: Record<string, string>) => suggestOverall("rob2", v);
  const all = (v: string) => Object.fromEntries(TOOLS.rob2.items.map((i) => [i.key, v]));

  it("RoB 2: all low is low, any high is high, otherwise some concerns", () => {
    expect(rob(all("low"))).toBe("low");
    expect(rob({ ...all("low"), D3: "some" })).toBe("some");
    expect(rob({ ...all("some"), D1: "high" })).toBe("high");
  });
  it("does not suggest anything until every domain is answered", () => {
    expect(rob({ D1: "low" })).toBeNull();
  });
  it("ROBINS-I takes the worst domain and ignores 'no information' unless it is all there is", () => {
    const d = (v: string) => Object.fromEntries(TOOLS["robins-i"].items.map((i) => [i.key, v]));
    expect(suggestOverall("robins-i", { ...d("low"), D2: "serious", D5: "ni" })).toBe("serious");
    expect(suggestOverall("robins-i", d("ni"))).toBe("ni");
  });
  it("QUADAS-2: unclear beats low, high beats unclear", () => {
    const d = (v: string) => Object.fromEntries(TOOLS.quadas2.items.map((i) => [i.key, v]));
    expect(suggestOverall("quadas2", { ...d("low"), D2: "unclear" })).toBe("unclear");
    expect(suggestOverall("quadas2", { ...d("unclear"), D2: "high" })).toBe("high");
  });
  it("NOS totals stars and MMAT reports counts, never a single score", () => {
    expect(starTotal({ S1: "star", S2: "none", S3: "star" })).toEqual({ stars: 2, max: 9 });
    expect(mmatCounts({ S1: "yes", S2: "cant", "2.1": "no" })).toEqual({ yes: 1, no: 1, cant: 1 });
    expect(suggestOverall("mmat", { S1: "yes" })).toBeNull();
  });
  it("completeness: RoB 2 also needs the overall judgement", () => {
    expect(isComplete("rob2", all("low"), null)).toBe(false);
    expect(isComplete("rob2", all("low"), "low")).toBe(true);
  });
  it("MMAT needs the screening questions and every criterion of one design category", () => {
    const cat2 = { "2.1": "yes", "2.2": "yes", "2.3": "no", "2.4": "yes", "2.5": "cant" };
    expect(isComplete("mmat", { S1: "yes", S2: "yes", "2.1": "yes" }, null)).toBe(false);
    expect(isComplete("mmat", { S1: "yes", S2: "yes", ...cat2 }, null)).toBe(true);
    expect(isComplete("mmat", cat2, null)).toBe(false);
  });
  it("guesses a tool from the study design and respects what the review allows", () => {
    expect(guessTool("Randomized Controlled Trial", ["rob2", "mmat"])).toBe("rob2");
    expect(guessTool("Cohort study", ["mmat", "nos"])).toBe("nos");
    expect(guessTool("randomised trial", ["mmat"])).toBe("mmat");
    expect(guessTool(null, ["casp", "mmat"])).toBe("casp");
    expect(guessTool("Systematic review with meta-analysis", ["amstar2"])).toBe("amstar2");
    expect(guessTool("Qualitative interview study", ["casp", "mmat"])).toBe("casp");
  });
  it("knows which tools exist, and rejects one that does not", () => {
    for (const t of ["rob2", "robins-i", "nos", "quadas2", "mmat", "amstar2", "casp"]) expect(isImplemented(t)).toBe(true);
    expect(isImplemented("grade")).toBe(false);
  });
});
