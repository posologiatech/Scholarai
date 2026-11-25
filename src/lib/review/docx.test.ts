import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocx, xmlEscape, type DocBlock } from "./docx";
import { writeFileSync } from "node:fs";

// A 1x1 white PNG.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

const blocks: DocBlock[] = [
  { type: "title", text: "Metformina & demência <uma revisão>" },
  { type: "h1", text: "Métodos" },
  { type: "p", text: "Primeiro parágrafo com \"aspas\" e acentuação.\nSegundo parágrafo." },
  { type: "h2", text: "Busca" },
  { type: "caption", text: "Tabela 1. Estratégias" },
  { type: "table", head: ["Base", "Estratégia"], rows: [["PubMed", "a AND b"], ["Embase", "x < y & z"]] },
  { type: "image", png: PNG, width: 900, height: 400 },
  { type: "pagebreak" },
  { type: "p", text: "Fim\u0001com controle" },
];

describe("buildDocx", () => {
  it("escapes markup and strips characters XML forbids", () => {
    expect(xmlEscape(`a<b>&"c"\u0001`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;");
  });

  it("produces a zip with every part Word requires, each well-formed XML", async () => {
    const zip = await JSZip.loadAsync(await buildDocx(blocks));
    for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels"]) {
      const xml = await zip.file(part)!.async("string");
      const parsed = new DOMParser().parseFromString(xml, "text/xml");
      expect(parsed.getElementsByTagName("parsererror").length, part).toBe(0);
    }
    expect(zip.file("word/media/image1.png")).not.toBeNull();
  });

  it("writes headings with styles, escaped text, table rows and the embedded figure", async () => {
    const zip = await JSZip.loadAsync(await buildDocx(blocks));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain('<w:pStyle w:val="Title"/>');
    expect(doc).toContain("Metformina &amp; demência &lt;uma revisão&gt;");
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
    expect((doc.match(/<w:tr>/g) ?? []).length).toBe(3);
    expect(doc).toContain("<w:tblHeader/>");
    expect(doc).toContain("x &lt; y &amp; z");
    expect(doc).toContain('r:embed="rIdImg1"');
    expect(doc).toContain('w:type="page"');
    expect(doc).not.toContain("\u0001");
  });

  it("splits multi-line paragraphs and scales a wide figure to the page width", async () => {
    const zip = await JSZip.loadAsync(await buildDocx(blocks));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("Primeiro parágrafo");
    expect(doc).toContain("Segundo parágrafo.");
    const m = doc.match(/<wp:extent cx="(\d+)" cy="(\d+)"/)!;
    expect(Number(m[1])).toBeLessThanOrEqual(5760720);
    expect(Number(m[2]) / Number(m[1])).toBeCloseTo(400 / 900, 2);
  });

  it("links the image through the relationships part", async () => {
    const zip = await JSZip.loadAsync(await buildDocx(blocks));
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain('Id="rIdImg1"');
    expect(rels).toContain("media/image1.png");
  });

  it("pads short rows so the table stays rectangular", async () => {
    const zip = await JSZip.loadAsync(await buildDocx([{ type: "table", head: ["a", "b", "c"], rows: [["1"]] }]));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect((doc.match(/<w:tc>/g) ?? []).length).toBe(6);
  });

  it("can write a sample file for opening in Word (set DOCX_OUT)", async () => {
    if (process.env.DOCX_OUT) writeFileSync(process.env.DOCX_OUT, await buildDocx(blocks));
  });
});
