import { describe, expect, it } from "vitest";
import { briefingFacts, briefingToText, buildBriefing } from "./briefing";
import { Finding } from "./findings";
import { CompactProfile } from "./profile";

const profile: CompactProfile = {
  basedOnRows: 160,
  totalRows: 160,
  sampled: false,
  quality: 82,
  duplicateRows: 2,
  columns: [
    { name: "id", type: "numeric", missingPct: 0, unique: 160, role: "id" },
    { name: "grupo", type: "categorical", missingPct: 0, unique: 2, levels: [{ value: "A", count: 80 }, { value: "B", count: 80 }] },
    {
      name: "pressao",
      type: "numeric",
      missingPct: 1.2,
      unique: 140,
      stats: { mean: 130.5, median: 129, std: 12.3, min: 100, max: 165, skew: 0.1, outliers: 2 },
    },
  ],
  correlations: [{ a: "pressao", b: "idade", r: 0.42, n: 158 }],
  warnings: [{ severity: "warning", message: "Coluna renda tem 45% de valores ausentes" }],
};

const confirmed: Finding = {
  key: "cmp|pressao|grupo",
  kind: "comparison",
  file: "dados.csv",
  title: "pressao difere entre os 2 grupos de grupo",
  detail: "Teste: Teste t de Student · p = <0,0001 · q (FDR) = <0,0001 · g de Hedges = 1,87 (grande) · n = 160",
  significant: true,
  severity: "warning",
  question: "Compare pressao entre os grupos de grupo.",
  columns: ["pressao", "grupo"],
  q: 0.00001,
  effect: 1.87,
};

const lead: Finding = {
  ...confirmed,
  key: "cmp|idade|grupo",
  title: "idade pode diferir entre os 2 grupos de grupo",
  significant: false,
  q: 0.18,
  effect: 0.2,
};

describe("buildBriefing", () => {
  it("returns null without a profile, rather than guessing from the file name", () => {
    expect(buildBriefing("dados.csv", undefined, [])).toBeNull();
  });

  it("describes the file from the profile that was already computed", () => {
    const briefing = buildBriefing("dados.csv", profile, [])!;
    expect(briefing.headline).toContain("160");
    expect(briefing.headline).toContain("82/100");

    const overview = briefing.sections[0].lines.join(" ");
    // The identifier is named as excluded, not silently counted as analysable.
    expect(overview).toContain("id");
    expect(overview).toContain("2 coluna(s) analisável(is)");
  });

  it("carries the profile's warnings and duplicate rows into the cautions", () => {
    const lines = buildBriefing("dados.csv", profile, [])!
      .sections.find((s) => s.title === "Cuidados antes de analisar")!.lines.join(" ");
    expect(lines).toContain("45% de valores ausentes");
    expect(lines).toContain("duplicada");
  });

  it("keeps the evidence line of a confirmed finding, q and effect included", () => {
    const section = buildBriefing("dados.csv", profile, [confirmed])!
      .sections.find((s) => s.title === "O que a varredura já encontrou")!;
    const text = section.lines.join(" ");
    expect(text).toContain("q (FDR)");
    expect(text).toContain("g de Hedges = 1,87");
  });

  it("never states a lead as a result", () => {
    const section = buildBriefing("dados.csv", profile, [lead])!
      .sections.find((s) => s.title === "O que a varredura já encontrou")!;
    const text = section.lines.join(" ");
    expect(text).toContain("hipótese a investigar");
    expect(text).not.toContain("sobreviveram");
  });

  it("only takes findings of the file it is briefing", () => {
    const other: Finding = { ...confirmed, key: "other", file: "outro.csv" };
    const briefing = buildBriefing("dados.csv", profile, [other])!;
    expect(briefing.sections.some((s) => s.title === "O que a varredura já encontrou")).toBe(false);
  });

  it("flattens into facts the model can rewrite but not recompute", () => {
    const facts = briefingFacts(buildBriefing("dados.csv", profile, [confirmed])!);
    expect(facts).toContain("Arquivo: dados.csv");
    expect(facts).toContain("## Variáveis");
    expect(facts).toContain("q (FDR)");
  });

  it("renders as text with the written paragraphs above the facts", () => {
    const text = briefingToText(buildBriefing("dados.csv", profile, [])!, "Parágrafo escrito.");
    expect(text.indexOf("Parágrafo escrito.")).toBeLessThan(text.indexOf("O que há no arquivo"));
  });
});
