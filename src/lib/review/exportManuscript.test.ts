import { describe, expect, it } from "vitest";
import { composeManuscript, placeholders, type ExportInput } from "./exportManuscript";
import { withKeys } from "./facts";
import { manuscriptFor } from "./manuscript";
import { prismaFlowSvg } from "./artifacts";
import { getReviewType } from "./types";

const studies = withKeys([
  { id: "a", title: "Metformin and dementia", year: 2020, authors: ["Silva, J", "Lee, K"] },
  { id: "b", title: "Statins in the elderly", year: 2018, authors: ["Roe, P"] },
]);

const base = (over: Partial<ExportInput> = {}): ExportInput => ({
  locale: "pt", title: "Metformina e demência", manuscript: manuscriptFor(getReviewType("systematic")!), studies,
  refExtra: { a: { journal: "Lancet", doi: "10.1/x" } }, citeStyle: "author-year", tables: [], figures: [],
  state: { sections: {
    title: { text: "Metformina e risco de demência: uma revisão sistemática", approved: true },
    abstract: { text: "Foram incluídos 2 estudos [S1, S2].", approved: true },
    results_selection: { text: "Incluímos 2 estudos.", approved: false },
    declarations: { text: "Financiamento: [informe]", approved: true, issues: [{ type: "unsupported_number", snippet: "9" }] },
  } },
  ...over,
});

describe("composeManuscript", () => {
  it("uses the written title, groups sections under part headings and renders author-year citations", () => {
    const c = composeManuscript(base());
    expect(c.blocks[0]).toEqual({ type: "title", text: "Metformina e risco de demência: uma revisão sistemática" });
    expect(c.blocks.filter((b) => b.type === "h1").map((b: any) => b.text)).toEqual(expect.arrayContaining(["Resumo", "Resultados", "Outras informações", "Referências"]));
    expect(c.markdown).toContain("(Silva et al., 2020; Roe, 2018)");
    expect(c.markdown).not.toContain("[S1");
  });
  it("lists references alphabetically for author-year and in citation order for numbered", () => {
    expect(composeManuscript(base()).references[0]).toMatch(/^Roe, P\./);
    const n = composeManuscript(base({ citeStyle: "numbered", state: { sections: { abstract: { text: "Veja [S2] e [S1].", approved: true } } } }));
    expect(n.markdown).toContain("Veja [1] e [2].");
    expect(n.references[0]).toMatch(/^1\. Roe/);
  });
  it("warns about empty, unapproved and flagged sections and unfilled placeholders", () => {
    const w = composeManuscript(base()).warnings.join("\n");
    expect(w).toContain("Seção sem texto: Estratégia".slice(0, 18));
    expect(w).toContain("Seção não aprovada: Seleção dos estudos");
    expect(w).toContain("Seção com pontos a conferir: Financiamento, conflitos, dados e uso de IA (1)");
    expect(w).toContain("Campos ainda por preencher");
    expect(w).not.toContain("Seção não aprovada: Resumo");
  });
  it("finds placeholders but ignores citation keys", () => {
    expect(placeholders("a [informar] b [S1, S2] c [descreva ou escreva \"nenhuma\"]")).toEqual(["[informar]", "[descreva ou escreva \"nenhuma\"]"]);
  });
  it("adds appendices with numbered table captions", () => {
    const c = composeManuscript(base({ tables: [{ title: "Estratégias", table: { head: ["Base"], rows: [["PubMed"]] } }] }));
    expect(c.blocks.some((b) => b.type === "caption" && b.text === "Tabela S1. Estratégias")).toBe(true);
    expect(c.markdown).toContain("| PubMed |");
    expect(c.html).toContain("<th>Base</th>");
  });
  it("escapes manuscript text in the HTML sent to the editor", () => {
    const c = composeManuscript(base({ state: { sections: { abstract: { text: "<script>alert(1)</script>", approved: true } } } }));
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("&lt;script&gt;");
  });
});

describe("prismaFlowSvg", () => {
  it("shows every count and escapes the reasons", () => {
    const f = prismaFlowSvg({ identified: 500, duplicatesRemoved: 120, screened: 380, excludedScreening: 340, includedFullText: 40, excludedFullText: 38, finalIncluded: 2, excludedReasons: { x: 30 } }, { x: "Motivo <b>" }, "pt");
    for (const n of ["n = 500", "n = 120", "n = 380", "n = 340", "n = 40", "n = 2"]) expect(f.svg).toContain(n);
    expect(f.svg).toContain("Excluídos no texto completo: 38");
    expect(f.svg).toContain("Motivo &lt;b&gt;: 30");
    expect(f.svg).not.toContain("<b>");
  });
});
