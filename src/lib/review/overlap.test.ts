import { describe, expect, it } from "vitest";
import { overlapOf, studyKey } from "./overlap";

describe("studyKey", () => {
  it("treats the same DOI written three ways as one study", () => {
    const k = studyKey("10.1000/ABC.1");
    expect(studyKey("https://doi.org/10.1000/abc.1")).toBe(k);
    expect(studyKey("Silva J. Metformin and dementia. Lancet 2020. doi:10.1000/abc.1.")).toBe(k);
  });
  it("recognises a PubMed id and a title, and ignores blanks and fragments", () => {
    expect(studyKey("PMID: 12345678")).toBe("pmid:12345678");
    expect(studyKey("Metformin and the Risk of Dementia: a trial!")).toBe(studyKey("metformin and the risk of dementia a trial"));
    expect(studyKey("   ")).toBeNull();
    expect(studyKey("n/a")).toBeNull();
  });
});

describe("overlapOf (corrected covered area)", () => {
  it("is 0% when no study appears in two reviews", () => {
    const o = overlapOf([{ id: "a", label: "A", studies: ["10.1/a", "10.1/b"] }, { id: "b", label: "B", studies: ["10.1/c", "10.1/d"] }]);
    expect(o).toMatchObject({ reviews: 2, unique: 4, inclusions: 4, cca: 0, band: "slight" });
  });
  it("is 100% when every review includes exactly the same studies", () => {
    const o = overlapOf([{ id: "a", label: "A", studies: ["10.1/a", "10.1/b"] }, { id: "b", label: "B", studies: ["10.1/a", "10.1/b"] }]);
    expect(o.cca).toBe(100);
    expect(o.band).toBe("very_high");
  });
  it("matches a worked example: 2 of 4 studies shared by 2 reviews gives (6-4)/(8-4) = 50%", () => {
    const o = overlapOf([{ id: "a", label: "A", studies: ["10.1/a", "10.1/b", "10.1/c"] }, { id: "b", label: "B", studies: ["10.1/a", "10.1/b", "10.1/d"] }]);
    expect(o).toMatchObject({ unique: 4, inclusions: 6 });
    expect(o.cca).toBe(50);
  });
  it("counts a study listed twice in one review once", () => {
    const o = overlapOf([{ id: "a", label: "A", studies: ["10.1/a", "https://doi.org/10.1/a"] }, { id: "b", label: "B", studies: ["10.1/z"] }]);
    expect(o.inclusions).toBe(2);
  });
  it("cannot compute with a single review, and reports reviews with no list instead of diluting the result", () => {
    expect(overlapOf([{ id: "a", label: "A", studies: ["10.1/a"] }]).cca).toBeNull();
    const o = overlapOf([{ id: "a", label: "A", studies: ["10.1/a"] }, { id: "b", label: "B", studies: ["10.1/a"] }, { id: "c", label: "C", studies: [] }]);
    expect(o.missing).toEqual(["c"]);
    expect(o.reviews).toBe(2);
    expect(o.cca).toBe(100);
  });
  it("orders the matrix by how many reviews include each study", () => {
    const o = overlapOf([{ id: "a", label: "A", studies: ["10.1/a", "10.1/b"] }, { id: "b", label: "B", studies: ["10.1/b"] }]);
    expect(o.matrix[0].inReviews.sort()).toEqual(["a", "b"]);
  });
  it("bands follow the published thresholds", () => {
    const mk = (shared: number) => overlapOf([
      { id: "a", label: "A", studies: Array.from({ length: 100 }, (_, i) => `10.1/x${i}`) },
      { id: "b", label: "B", studies: Array.from({ length: 100 }, (_, i) => (i < shared ? `10.1/x${i}` : `10.1/y${i}`)) },
    ]);
    expect(mk(5).band).toBe("slight");      // (200-195)/(390-195)=2.6%
    expect(mk(10).band).toBe("moderate");   // 5.3%, just above the 5% limit
    expect(mk(15).band).toBe("moderate");   // 8.1%
    expect(mk(25).band).toBe("high");       // 14.3%
    expect(mk(40).band).toBe("very_high");  // 25%
  });
});
