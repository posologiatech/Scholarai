import { describe, it, expect } from "vitest";
import {
  applyInterpretation,
  buildScanCode,
  parseScanOutput,
  qualityFindings,
  rankFindings,
  suggestionsFromFindings,
  Finding,
} from "./findings";
import { CompactProfile } from "./profile";

const comparison = {
  key: "comparison|dados.csv|pressao|tratamento",
  kind: "comparison",
  file: "dados.csv",
  outcome: "pressao",
  group: "tratamento",
  test: "student_t",
  label: "Teste t de Student",
  because: "2 grupos independentes, normais e com variancias homogeneas",
  p: 0.00001,
  q: 0.0004,
  effect: 1.21,
  effect_name: "g de Hedges",
  magnitude: "grande",
  n: 180,
  n_groups: 2,
  levels: ["placebo", "ativo"],
  centres: [140.2, 128.1],
  centre_measure: "media",
  highest: "placebo",
  lowest: "ativo",
  significant: true,
};

function payload(findings: unknown[], extra: Record<string, unknown> = {}) {
  const body = JSON.stringify({ findings, totalTested: 42, totalSignificant: 1, ...extra });
  return `algum aviso do pandas\n__DATAFINDINGS_START__${body}__DATAFINDINGS_END__\n`;
}

describe("parseScanOutput", () => {
  it("reads the payload out of surrounding stdout", () => {
    const summary = parseScanOutput(payload([comparison]))!;
    expect(summary.totalTested).toBe(42);
    expect(summary.findings).toHaveLength(1);
    const finding = summary.findings[0];
    expect(finding.kind).toBe("comparison");
    expect(finding.significant).toBe(true);
    expect(finding.columns).toEqual(["pressao", "tratamento"]);
    expect(finding.title).toContain("pressao");
    expect(finding.title).toContain("tratamento");
    expect(finding.title).toContain("placebo");
    expect(finding.question).toContain("Compare pressao");
  });

  it("carries the rule and both p and q into the detail line", () => {
    const finding = parseScanOutput(payload([comparison]))!.findings[0];
    expect(finding.detail).toContain("Teste t de Student");
    expect(finding.detail).toContain("q (FDR)");
    expect(finding.detail).toContain("g de Hedges");
    expect(finding.detail).toContain("Regra:");
  });

  it("drops findings the correction pushed past a coin flip", () => {
    const noise = { ...comparison, q: 0.7, significant: false };
    expect(parseScanOutput(payload([noise]))!.findings).toHaveLength(0);
  });

  it("keeps a non-significant lead that is still worth a look", () => {
    const lead = { ...comparison, q: 0.12, significant: false };
    const finding = parseScanOutput(payload([lead]))!.findings[0];
    expect(finding.significant).toBe(false);
    expect(finding.title).toContain("pode diferir");
  });

  it("describes a correlation with its direction and strength", () => {
    const correlation = {
      key: "correlation|dados.csv|idade|peso",
      kind: "correlation",
      file: "dados.csv",
      var_a: "idade",
      var_b: "peso",
      test: "spearman",
      label: "Correlacao de Spearman",
      because: "duas numericas com pelo menos uma nao normal",
      p: 0.001,
      q: 0.01,
      effect: -0.42,
      effect_name: "coeficiente",
      magnitude: "moderado",
      direction: "negativa",
      n: 200,
      significant: true,
    };
    const finding = parseScanOutput(payload([correlation]))!.findings[0];
    expect(finding.title).toContain("negativa");
    expect(finding.question).toContain("dispersão");
  });

  it("returns null when the markers are absent", () => {
    expect(parseScanOutput("nenhum marcador aqui")).toBeNull();
  });

  it("returns null on a truncated payload instead of throwing", () => {
    expect(parseScanOutput("__DATAFINDINGS_START__{\"findings\": [__DATAFINDINGS_END__")).toBeNull();
  });

  it("surfaces an error the scan reported about itself", () => {
    const summary = parseScanOutput(payload([], { error: "ValueError: x" }))!;
    expect(summary.error).toContain("ValueError");
    expect(summary.findings).toEqual([]);
  });
});

describe("buildScanCode", () => {
  it("appends the call with the excluded columns as a literal", () => {
    const code = buildScanCode("def run_scan(a, b): pass", { "dados.csv": ["id"] });
    expect(code).toContain("def run_scan");
    expect(code).toContain('run_scan(dfs, {"dados.csv":["id"]})');
  });
});

const profile: CompactProfile = {
  basedOnRows: 100,
  totalRows: 100,
  sampled: false,
  quality: 80,
  duplicateRows: 3,
  columns: [],
  correlations: [],
  warnings: [
    { severity: "critical", message: "Coluna 'idade' tem 62% de valores ausentes" },
    { severity: "info", message: "Coluna 'uf' tem 27 categorias" },
  ],
};

describe("qualityFindings", () => {
  it("turns each profile warning into a finding plus one for duplicates", () => {
    const findings = qualityFindings(profile, "dados.csv");
    expect(findings).toHaveLength(3);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].significant).toBe(true);
    expect(findings.some((f) => f.title.includes("duplicada"))).toBe(true);
  });

  it("gives every finding a distinct stable key", () => {
    const keys = qualityFindings(profile, "dados.csv").map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(qualityFindings(profile, "dados.csv").map((f) => f.key)).toEqual(keys);
  });

  it("returns nothing without a profile", () => {
    expect(qualityFindings(undefined, "dados.csv")).toEqual([]);
  });
});

describe("rankFindings", () => {
  it("puts data quality first, then confirmed results by effect size", () => {
    const statistical = parseScanOutput(payload([
      { ...comparison, key: "small", effect: 0.3 },
      { ...comparison, key: "big", effect: 1.2 },
      { ...comparison, key: "lead", q: 0.15, significant: false, effect: 2.0 },
    ]))!.findings;
    const ranked = rankFindings([...statistical, ...qualityFindings(profile, "dados.csv")]);
    expect(ranked[0].kind).toBe("quality");
    expect(ranked[0].severity).toBe("critical");
    const statisticalOrder = ranked.filter((f) => f.kind !== "quality").map((f) => f.key);
    expect(statisticalOrder).toEqual(["big", "small", "lead"]);
  });
});

describe("suggestionsFromFindings", () => {
  it("offers the ranked questions without repeating one", () => {
    const duplicated: Finding[] = [
      { ...qualityFindings(profile, "dados.csv")[0] },
      { ...qualityFindings(profile, "dados.csv")[0], key: "other" },
    ];
    expect(suggestionsFromFindings(duplicated)).toHaveLength(1);
  });

  it("respects the limit", () => {
    expect(suggestionsFromFindings(qualityFindings(profile, "dados.csv"), 2)).toHaveLength(2);
  });
});

describe("applyInterpretation", () => {
  const findings = parseScanOutput(payload([
    { ...comparison, key: "a" },
    { ...comparison, key: "b", effect: 0.4 },
  ]))!.findings;

  it("reorders and attaches the model's wording", () => {
    const result = applyInterpretation(findings, [
      { key: "b", headline: "Pressão cai no grupo ativo", why: "Muda a conduta." },
      { key: "a", headline: "Outro achado", why: "" },
    ]);
    expect(result.map((f) => f.key)).toEqual(["b", "a"]);
    expect(result[0].interpretation?.headline).toBe("Pressão cai no grupo ativo");
    expect(result[0].interpretation?.why).toBe("Muda a conduta.");
  });

  it("never lets the model change the numbers", () => {
    const result = applyInterpretation(findings, [
      { key: "a", headline: "p = 0,9 e nada aqui é real" },
    ]);
    expect(result[0].p).toBe(findings[0].p);
    expect(result[0].significant).toBe(findings[0].significant);
    expect(result[0].detail).toBe(findings[0].detail);
  });

  it("keeps a finding the model ignored, at the end", () => {
    const result = applyInterpretation(findings, [{ key: "b", headline: "só este" }]);
    expect(result.map((f) => f.key)).toEqual(["b", "a"]);
    expect(result[1].interpretation).toBeUndefined();
  });

  it("drops an item for a key that was never sent", () => {
    const result = applyInterpretation(findings, [
      { key: "inventado", headline: "achado fantasma" },
    ]);
    expect(result.map((f) => f.key)).toEqual(["a", "b"]);
    expect(result.some((f) => f.interpretation)).toBe(false);
  });

  it("ignores a repeated key instead of duplicating the finding", () => {
    const result = applyInterpretation(findings, [
      { key: "a", headline: "primeiro" },
      { key: "a", headline: "de novo" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].interpretation?.headline).toBe("primeiro");
  });

  it("survives an empty reply", () => {
    expect(applyInterpretation(findings, []).map((f) => f.key)).toEqual(["a", "b"]);
  });
});
