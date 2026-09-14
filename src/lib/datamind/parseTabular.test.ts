import { describe, it, expect } from "vitest";
import {
  decodeBuffer,
  detectEncoding,
  normalizeHeaders,
  parseCSVBuffer,
  parseCSVText,
  sniffDelimiter,
} from "./parseTabular";

function toBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("sniffDelimiter", () => {
  it("detects a comma-delimited file", () => {
    expect(sniffDelimiter("a,b,c\n1,2,3\n4,5,6")).toBe(",");
  });

  it("detects a semicolon-delimited file", () => {
    expect(sniffDelimiter("a;b;c\n1;2;3\n4;5;6")).toBe(";");
  });

  it("prefers the delimiter that is consistent across rows, not the most frequent", () => {
    // Commas appear more often, but only the semicolon splits every row evenly.
    const text = [
      "nome;observacao",
      "Ana;mora em Recife, trabalha de manhã, gosta de café",
      "Bruno;mora em Olinda, estuda à noite, tem dois filhos",
    ].join("\n");
    expect(sniffDelimiter(text)).toBe(";");
  });

  it("detects tab-delimited files", () => {
    expect(sniffDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });
});

describe("parseCSVText", () => {
  it("keeps commas that live inside quoted fields", () => {
    const table = parseCSVText('nome,cidade\n"Silva, Ana",Recife');
    expect(table.columns).toEqual(["nome", "cidade"]);
    expect(table.rows[0]).toEqual({ nome: "Silva, Ana", cidade: "Recife" });
  });

  it("counts rows correctly when a quoted field contains a newline", () => {
    const table = parseCSVText('id,nota\n1,"linha um\nlinha dois"\n2,ok');
    expect(table.totalRows).toBe(2);
    expect(table.rows[0].nota).toBe("linha um\nlinha dois");
  });

  it("parses a pt-BR export: semicolon delimiter with decimal commas", () => {
    const text = ["paciente;idade;peso", "Ana;62;71,5", "Bruno;45;88,2", "Carla;70;59,8"].join("\n");
    const table = parseCSVText(text);

    expect(table.dialect.delimiter).toBe(";");
    expect(table.dialect.decimal).toBe(",");
    expect(table.columns).toEqual(["paciente", "idade", "peso"]);
    expect(table.decimalNormalizedColumns).toEqual(["peso"]);
    expect(table.rows.map((r) => r.peso)).toEqual(["71.5", "88.2", "59.8"]);
    // Integers stay untouched — there is no comma to rewrite.
    expect(table.rows[0].idade).toBe("62");
  });

  it("normalizes thousand-grouped decimals", () => {
    const text = ["item;valor", "a;1.234,56", "b;2.000,10", "c;987,00"].join("\n");
    const table = parseCSVText(text);
    expect(table.rows.map((r) => r.valor)).toEqual(["1234.56", "2000.10", "987.00"]);
  });

  it("leaves text columns with commas alone", () => {
    const text = ["dose;descricao", "10;1,5 mg ao dia", "20;2,5 mg ao dia", "30;3,5 mg ao dia"].join("\n");
    const table = parseCSVText(text);
    expect(table.decimalNormalizedColumns).not.toContain("descricao");
    expect(table.rows[0].descricao).toBe("1,5 mg ao dia");
  });

  it("does not rewrite a column that is already dot-decimal", () => {
    const text = ["a,b", "1.5,x", "2.5,y", "3.5,z"].join("\n");
    const table = parseCSVText(text);
    expect(table.dialect.decimal).toBe(".");
    expect(table.rows.map((r) => r.a)).toEqual(["1.5", "2.5", "3.5"]);
  });

  it("reports truncation without losing the real row count", () => {
    const rows = Array.from({ length: 10 }, (_, i) => `${i},v${i}`).join("\n");
    const table = parseCSVText(`id,valor\n${rows}`, { maxRows: 4 });
    expect(table.rows).toHaveLength(4);
    expect(table.totalRows).toBe(10);
    expect(table.truncated).toBe(true);
  });

  it("honours a dialect that was already detected", () => {
    const text = "a|b\n1|2";
    const table = parseCSVText(text, {
      dialect: { delimiter: "|", decimal: ".", encoding: "utf-8" },
    });
    expect(table.columns).toEqual(["a", "b"]);
    expect(table.rows[0]).toEqual({ a: "1", b: "2" });
  });
});

describe("normalizeHeaders", () => {
  it("names empty columns and suffixes duplicates", () => {
    expect(normalizeHeaders(["idade", "", "idade", "idade"])).toEqual([
      "idade",
      "coluna_2",
      "idade_2",
      "idade_3",
    ]);
  });

  it("trims whitespace around names", () => {
    expect(normalizeHeaders([" peso ", "altura\t"])).toEqual(["peso", "altura"]);
  });
});

describe("encoding", () => {
  it("detects utf-8", () => {
    const bytes = Array.from(new TextEncoder().encode("medicação,dose\nlosartana,50"));
    expect(detectEncoding(toBuffer(bytes))).toBe("utf-8");
  });

  it("detects latin-1 and decodes accented characters", () => {
    // "medicação" written by Excel in cp1252: ç = 0xE7, ã = 0xE3.
    const bytes = [0x6d, 0x65, 0x64, 0x69, 0x63, 0x61, 0xe7, 0xe3, 0x6f, 0x2c, 0x64, 0x6f, 0x73, 0x65];
    const buffer = toBuffer(bytes);
    expect(detectEncoding(buffer)).toBe("latin-1");
    expect(decodeBuffer(buffer, "latin-1")).toBe("medicação,dose");
  });

  it("strips a UTF-8 BOM so it does not stick to the first header", () => {
    const bytes = Array.from(new TextEncoder().encode("﻿id,nome\n1,Ana"));
    const table = parseCSVBuffer(toBuffer(bytes));
    expect(table.columns).toEqual(["id", "nome"]);
  });

  it("carries the detected encoding on the dialect", () => {
    const bytes = [0x61, 0x3b, 0x62, 0x0a, 0xe7, 0x3b, 0x32];
    const table = parseCSVBuffer(toBuffer(bytes));
    expect(table.dialect.encoding).toBe("latin-1");
    expect(table.dialect.delimiter).toBe(";");
  });
});
