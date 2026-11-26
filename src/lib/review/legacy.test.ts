import { describe, expect, it } from "vitest";
import { mapLegacy, sourceOf, type LegacyReview } from "./legacy";

const legacy = (over: Partial<LegacyReview> = {}): LegacyReview => ({
  id: "L1", user_id: "u", research_question: "Metformina reduz demência em idosos?", status: "complete",
  papers: [
    { id: "p1", title: "Metformin and dementia in older adults", authors: ["Silva, J", { name: "Lee, K" }], year: 2020, abstract: "Abstract", source: "pubmed", doi: "https://doi.org/10.1/A", journal: "Lancet" },
    { id: "p2", title: "Statins in the elderly: a randomised trial", authors: ["Roe, P"], year: 2018, source: "openalex" },
    { id: "p3", title: "Imported from a file about something else", authors: [], year: null, source: "imported_ris" },
    { id: "p4", title: "   ", source: "pubmed" },
  ],
  screening_criteria: [{ id: "c1", name: "Tema", description: "Relacionado a demência", enabled: true }, { id: "c2", name: "Off", description: "x", enabled: false }],
  screening_results: { p1: {}, p2: {} }, included_paper_ids: ["p1"],
  extraction_columns: [{ id: "col1", name: "Tamanho da amostra" }, { id: "col2", name: "Dose diária" }],
  extraction_results: { p1: { col1: "240", col2: "" }, p2: { col1: "" }, ghost: { col1: "9" } },
  report_content: "Primeiro parágrafo <b>com html</b>.\n\nSegundo.", pico: { population: "Idosos", intervention: "Metformina", outcome: "Demência" },
  search_strategy: "a AND b", prospero_id: "CRD42026000001", protocol_locked_at: "2026-03-01T00:00:00Z", protocol_locked_by: "u", protocol_document: "# Protocolo",
  research_project_id: "proj", created_at: "2026-02-01T00:00:00Z", ...over,
});

describe("mapLegacy", () => {
  const m = mapLegacy(legacy(), "2026-11-26T00:00:00Z");

  it("turns papers into records, drops untitled ones and says so", () => {
    expect(m.records).toHaveLength(3);
    expect(m.warnings.join(" ")).toContain("1 registro(s) sem título");
    expect(m.records[0]).toMatchObject({ legacyId: "p1", doi: "10.1/a", authors: ["Silva, J", "Lee, K"], source: "pubmed" });
    expect(m.records[0].dedupe_key).toContain("metformin");
  });
  it("keeps the final inclusion decision and marks the rest as excluded at screening", () => {
    expect(m.records.map((r) => r.screen_status)).toEqual(["included", "ta_excluded", "ta_excluded"]);
    expect(m.review.stage_state.screening).toEqual({ ta_closed_at: "2026-11-26T00:00:00Z", ft_closed_at: "2026-11-26T00:00:00Z" });
  });
  it("is honest about what the old model never stored", () => {
    const w = m.warnings.join(" ");
    expect(w).toContain("não guardava o motivo nem a fase");
    expect(w).toContain("votos individuais");
    expect(w).toContain("rascunho");
  });
  it("keeps the protocol as it was and does not lock one that was not", () => {
    expect(m.review).toMatchObject({ protocol_locked_at: "2026-03-01T00:00:00Z", registry: { id: "CRD42026000001" }, framework: { population: "Idosos", intervention: "Metformina", outcome: "Demência" } });
    const open = mapLegacy(legacy({ protocol_locked_at: null }));
    expect(open.review.protocol_locked_at).toBeNull();
    expect(open.warnings.join(" ")).toContain("não estava congelado");
  });
  it("carries enabled screening criteria as inclusion criteria", () => {
    expect(m.review.eligibility).toEqual([{ kind: "include", text: "Tema: Relacionado a demência" }]);
  });
  it("groups the search log by source, mapping imported files to one legacy import", () => {
    expect(m.searches).toEqual([{ source: "pubmed", count: 1 }, { source: "openalex", count: 1 }, { source: "legacy_import", count: 1 }]);
    expect((m.review.stage_state.strategy as { sources: string[] }).sources).toEqual(["pubmed", "openalex"]);
    expect(sourceOf({ id: "x", source: "imported_endnote" })).toBe("legacy_import");
  });
  it("turns extraction columns into team fields and keeps only real values, for known papers", () => {
    expect(m.extraction.fields.map((f) => f.label)).toEqual(["Tamanho da amostra", "Dose diária"]);
    expect(m.extraction.rows).toEqual([{ legacyId: "p1", data: { x_tamanho_da_amostra: "240" } }]);
  });
  it("keeps the old report for the writing editor, escaped", () => {
    expect(m.reportHtml).toBe("<p>Primeiro parágrafo &lt;b&gt;com html&lt;/b&gt;.</p><p>Segundo.</p>");
    expect(mapLegacy(legacy({ report_content: "  " })).reportHtml).toBeNull();
  });
  it("leaves a review that was never screened as pending", () => {
    const draft = mapLegacy(legacy({ screening_results: {}, included_paper_ids: [] }));
    expect(draft.records.every((r) => r.screen_status === "pending")).toBe(true);
    expect(draft.review.stage_state.screening).toEqual({});
    expect(draft.warnings.join(" ")).not.toContain("votos individuais");
  });
  it("copes with empty or missing fields", () => {
    const empty = mapLegacy(legacy({ papers: null, extraction_columns: null, extraction_results: null, screening_criteria: null, pico: null, report_content: null }));
    expect(empty.records).toEqual([]);
    expect(empty.review.eligibility).toEqual([]);
    expect(empty.review.framework).toEqual({});
  });
  it("gives unique field keys to columns with the same name", () => {
    const d = mapLegacy(legacy({ extraction_columns: [{ id: "a", name: "Dose" }, { id: "b", name: "Dose" }] }));
    expect(new Set(d.extraction.fields.map((f) => f.key)).size).toBe(2);
  });
});
