import { describe, it, expect } from "vitest";
import { buildHistory, summarizeOutput } from "./conversationContext";

function tablePayload(title: string, columns: string[], data: Record<string, unknown>[]) {
  return `__DATATABLE_START__${JSON.stringify({ title, columns, data })}__DATATABLE_END__`;
}

describe("summarizeOutput", () => {
  it("replaces base64 figures with a placeholder", () => {
    const out = `Antes\n[IMG]data:image/png;base64,${"A".repeat(5000)}[/IMG]\nDepois`;
    const summary = summarizeOutput(out);

    expect(summary).toContain("[figura gerada]");
    expect(summary).not.toContain("AAAA");
    expect(summary.length).toBeLessThan(200);
  });

  it("renders a table as readable rows the model can reason over", () => {
    const out = tablePayload("Resultado do Teste t", ["Métrica", "Valor"], [
      { "Métrica": "t", Valor: "2.31" },
      { "Métrica": "p-valor", Valor: "0.024" },
    ]);
    const summary = summarizeOutput(out);

    expect(summary).toContain("Tabela: Resultado do Teste t");
    expect(summary).toContain("Métrica | Valor");
    expect(summary).toContain("p-valor | 0.024");
  });

  it("truncates long tables but states the real row count", () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ id: String(i), v: String(i * 2) }));
    const summary = summarizeOutput(tablePayload("Grande", ["id", "v"], data), { maxTableRows: 5 });

    expect(summary).toContain("+45 linha(s) não exibida(s); total 50");
    expect(summary).not.toContain("49 | 98");
  });

  it("names charts instead of dumping their data", () => {
    const chart = `__DATACHART_START__${JSON.stringify({
      kind: "bar",
      title: "Casos por ano",
      data: Array.from({ length: 200 }, (_, i) => ({ ano: i })),
    })}__DATACHART_END__`;
    const summary = summarizeOutput(chart);

    expect(summary).toBe("[gráfico bar: Casos por ano]");
  });

  it("keeps both ends when stdout is long", () => {
    const out = `CABECALHO_INICIAL\n${"x".repeat(5000)}\nCONCLUSAO_FINAL`;
    const summary = summarizeOutput(out, { maxTextChars: 400 });

    expect(summary).toContain("CABECALHO_INICIAL");
    expect(summary).toContain("CONCLUSAO_FINAL");
    expect(summary).toContain("[...saída truncada...]");
  });

  it("survives a malformed table payload", () => {
    const summary = summarizeOutput("__DATATABLE_START__{nao é json__DATATABLE_END__");
    expect(summary).toBe("[tabela ilegível]");
  });
});

describe("buildHistory", () => {
  it("carries the code and results of past assistant turns", () => {
    const history = buildHistory([
      { role: "user", content: "Rode uma ANOVA" },
      {
        role: "assistant",
        content: "## ANOVA One-Way",
        code_block: "f, p = stats.f_oneway(a, b)",
        output_content: tablePayload("ANOVA", ["F", "p"], [{ F: "4.12", p: "0.018" }]),
      },
    ]);

    expect(history).toHaveLength(2);
    const assistant = history[1].content;
    expect(assistant).toContain("f_oneway");
    expect(assistant).toContain("Resultado da execução:");
    expect(assistant).toContain("4.12");
  });

  it("does not attach code or output to user messages", () => {
    const history = buildHistory([
      { role: "user", content: "oi", code_block: "x = 1", output_content: "saida" },
    ]);
    expect(history[0].content).toBe("oi");
  });

  it("keeps only the most recent messages", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: `m${i}` }));
    const history = buildHistory(messages, { maxMessages: 4 });

    expect(history).toHaveLength(4);
    expect(history[0].content).toBe("m26");
    expect(history[3].content).toBe("m29");
  });

  it("truncates very long prose", () => {
    const history = buildHistory([{ role: "user", content: "y".repeat(3000) }], {
      maxContentChars: 100,
    });
    expect(history[0].content).toHaveLength(103);
    expect(history[0].content.endsWith("...")).toBe(true);
  });

  it("handles an assistant turn that produced no output", () => {
    const history = buildHistory([
      { role: "assistant", content: "Qual variável usar?", code_block: null, output_content: null },
    ]);
    expect(history[0].content).toBe("Qual variável usar?");
  });
});
