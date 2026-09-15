import { describe, expect, it } from "vitest";
import { Finding } from "./findings";
import {
  buildArticleHtml,
  extractSections,
  findingsContextText,
  findingsTable,
  qualityNotes,
} from "./report";

const confirmed: Finding = {
  key: "cmp|pressao|grupo",
  kind: "comparison",
  file: "dados.csv",
  title: "pressao difere entre os 2 grupos de grupo",
  detail: "Teste: Teste t de Student · p = <0,0001 · q (FDR) = <0,0001 · g de Hedges = 1,87 (grande) · n = 160",
  significant: true,
  severity: "warning",
  question: "Compare pressao entre os grupos.",
  columns: ["pressao", "grupo"],
  p: 0.00001,
  q: 0.00002,
  effect: 1.8682,
  effectName: "g de Hedges",
  magnitude: "grande",
  label: "Teste t de Student",
  because: "2 grupos independentes, normais e com variâncias homogêneas (regra student_t)",
  n: 160,
};

const lead: Finding = {
  ...confirmed,
  key: "cor|idade|pressao",
  kind: "correlation",
  title: "idade pode ter correlação fraca com pressao",
  significant: false,
  q: 0.19,
  effect: 0.12,
  effectName: "r de Pearson",
  magnitude: "fraca",
  label: "Correlação de Pearson",
};

const quality: Finding = {
  key: "quality|dados.csv|0",
  kind: "quality",
  file: "dados.csv",
  title: "Coluna renda tem 45% de valores ausentes",
  detail: "Detectado no perfil do arquivo.",
  significant: false,
  severity: "warning",
  question: "Investigue.",
  columns: [],
};

describe("extractSections", () => {
  it("numbers figures and tables across the whole conversation", () => {
    const sections = extractSections([
      { role: "user", content: "compare" },
      {
        role: "assistant",
        content: "A diferença é grande.",
        output_content: `__DATATABLE_START__${JSON.stringify({ columns: ["g", "n"], data: [{ g: "A", n: 80 }] })}__DATATABLE_END__`,
      },
    ]);
    expect(sections.map((s) => s.type)).toEqual(["text", "table"]);
    expect(sections[1].tableNumber).toBe(1);
    expect(sections[1].rows).toEqual([["A", "80"]]);
  });
});

describe("findingsTable", () => {
  it("returns null when there is nothing but data-quality findings", () => {
    expect(findingsTable([quality])).toBeNull();
  });

  it("puts the rule, the q and the effect size in the table, not in a footnote", () => {
    const table = findingsTable([confirmed])!;
    expect(table.headers).toContain("q (FDR)");
    expect(table.headers).toContain("Tamanho de efeito");
    expect(table.rows[0]).toContain("Teste t de Student");
    expect(table.rows[0].join(" ")).toContain("g de Hedges = 1,87 (grande)");
    expect(table.rows[0]).toContain("Confirmado");
    expect(table.notes.join(" ")).toContain("Benjamini-Hochberg");
    expect(table.notes.join(" ")).toContain("regra student_t");
  });

  it("marks an unconfirmed finding as a lead", () => {
    const table = findingsTable([lead])!;
    expect(table.rows[0]).toContain("Pista");
  });

  it("drops findings the researcher dismissed", () => {
    expect(findingsTable([{ ...confirmed, dismissed: true }])).toBeNull();
  });
});

describe("buildArticleHtml", () => {
  const html = buildArticleHtml({
    title: "Efeito do tratamento",
    author: "Pesquisador",
    date: "15 de setembro de 2026",
    files: [{ file_name: "dados.csv" }],
    sections: extractSections([{ role: "assistant", content: "A pressão caiu no grupo tratado." }]),
    findings: [confirmed, lead, quality],
  });

  it("writes a methods section that says how the test was chosen", () => {
    expect(html).toContain("<h2>Métodos</h2>");
    expect(html).toContain("dados.csv");
    expect(html).toContain("regra determinística");
  });

  it("reports data quality before the results computed over it", () => {
    expect(html.indexOf("Qualidade dos dados")).toBeLessThan(html.indexOf("<h2>Resultados</h2>"));
    expect(html).toContain("45% de valores ausentes");
  });

  it("carries the honesty chain into the findings table", () => {
    expect(html).toContain("Achados automáticos");
    expect(html).toContain("q (FDR)");
    expect(html).toContain("Benjamini-Hochberg");
    expect(html).toContain("Pista");
  });

  it("escapes content instead of letting it become markup", () => {
    const risky = buildArticleHtml({
      title: "A & B",
      date: "hoje",
      files: [],
      sections: [{ type: "text", content: "<script>alert(1)</script>" }],
      findings: [],
    });
    expect(risky).toContain("A &amp; B");
    expect(risky).not.toContain("<script>");
  });
});

describe("findingsContextText", () => {
  it("labels each status so the writing model cannot flatten them", () => {
    const text = findingsContextText([confirmed, lead, quality]);
    expect(text).toContain("CONFIRMADO:");
    expect(text).toContain("PISTA");
    expect(text).toContain("hipótese a investigar, não resultado");
    expect(text).toContain("QUALIDADE DOS DADOS:");
    expect(text).toContain("q (FDR)");
  });

  it("is empty when every finding was dismissed", () => {
    expect(findingsContextText([{ ...confirmed, dismissed: true }])).toBe("");
  });
});

describe("qualityNotes", () => {
  it("separates data-quality findings from the statistical ones", () => {
    expect(qualityNotes([confirmed, quality])).toEqual(["Coluna renda tem 45% de valores ausentes"]);
  });
});
