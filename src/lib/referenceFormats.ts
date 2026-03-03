// ── RIS / BibTeX conversion utilities ──

export interface PaperRef {
  title: string;
  authors?: any; // string[] or jsonb
  year?: number | null;
  doi?: string | null;
  journal?: string | null;
  abstract?: string | null;
  url?: string | null;
  source?: string | null;
}

function authorList(authors: any): string[] {
  if (!authors) return [];
  if (Array.isArray(authors)) return authors.map((a: any) => (typeof a === "string" ? a : a.name || ""));
  return [];
}

// ── Export to RIS ──
export function papersToRIS(papers: PaperRef[]): string {
  return papers
    .map((p) => {
      const lines: string[] = [];
      lines.push("TY  - JOUR");
      lines.push(`TI  - ${p.title}`);
      authorList(p.authors).forEach((a) => lines.push(`AU  - ${a}`));
      if (p.year) lines.push(`PY  - ${p.year}`);
      if (p.journal) lines.push(`JO  - ${p.journal}`);
      if (p.doi) lines.push(`DO  - ${p.doi}`);
      if (p.url) lines.push(`UR  - ${p.url}`);
      if (p.abstract) lines.push(`AB  - ${p.abstract}`);
      lines.push("ER  - ");
      return lines.join("\n");
    })
    .join("\n\n");
}

// ── Export to BibTeX ──
export function papersToBibTeX(papers: PaperRef[]): string {
  return papers
    .map((p, i) => {
      const authors = authorList(p.authors);
      const key = `ref${i + 1}_${(p.year || "nd")}`;
      const lines: string[] = [];
      lines.push(`@article{${key},`);
      lines.push(`  title = {${p.title}},`);
      if (authors.length) lines.push(`  author = {${authors.join(" and ")}},`);
      if (p.year) lines.push(`  year = {${p.year}},`);
      if (p.journal) lines.push(`  journal = {${p.journal}},`);
      if (p.doi) lines.push(`  doi = {${p.doi}},`);
      if (p.url) lines.push(`  url = {${p.url}},`);
      if (p.abstract) lines.push(`  abstract = {${p.abstract}},`);
      lines.push("}");
      return lines.join("\n");
    })
    .join("\n\n");
}

// ── Export to CSV ──
export function papersToCSV(papers: PaperRef[]): string {
  const header = "Title,Authors,Year,Journal,DOI,URL";
  const rows = papers.map((p) => {
    const esc = (s?: string | null) => `"${(s || "").replace(/"/g, '""')}"`;
    return [
      esc(p.title),
      esc(authorList(p.authors).join("; ")),
      p.year || "",
      esc(p.journal),
      esc(p.doi),
      esc(p.url),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

// ── Parse RIS ──
export function parseRIS(content: string): PaperRef[] {
  const entries = content.split(/\nER\s+-/);
  return entries
    .map((entry) => {
      const lines = entry.split("\n").filter((l) => l.trim());
      const paper: PaperRef = { title: "" };
      const authors: string[] = [];
      for (const line of lines) {
        const match = line.match(/^([A-Z][A-Z0-9])\s+-\s+(.*)$/);
        if (!match) continue;
        const [, tag, val] = match;
        switch (tag) {
          case "TI": case "T1": paper.title = val.trim(); break;
          case "AU": case "A1": authors.push(val.trim()); break;
          case "PY": case "Y1": paper.year = parseInt(val) || null; break;
          case "JO": case "JF": case "T2": paper.journal = val.trim(); break;
          case "DO": paper.doi = val.trim(); break;
          case "UR": paper.url = val.trim(); break;
          case "AB": paper.abstract = val.trim(); break;
        }
      }
      paper.authors = authors;
      return paper;
    })
    .filter((p) => p.title);
}

// ── Parse BibTeX ──
export function parseBibTeX(content: string): PaperRef[] {
  const entries = content.match(/@\w+\{[^@]+/g) || [];
  return entries
    .map((entry) => {
      const paper: PaperRef = { title: "" };
      const getField = (name: string) => {
        const rx = new RegExp(`${name}\\s*=\\s*[{"]([^}"]*)[}"]`, "i");
        return rx.exec(entry)?.[1]?.trim() || null;
      };
      paper.title = getField("title") || "";
      const authStr = getField("author");
      paper.authors = authStr ? authStr.split(" and ").map((a) => a.trim()) : [];
      const yr = getField("year");
      paper.year = yr ? parseInt(yr) : null;
      paper.journal = getField("journal");
      paper.doi = getField("doi");
      paper.url = getField("url");
      paper.abstract = getField("abstract");
      return paper;
    })
    .filter((p) => p.title);
}

// ── Parse CSV (simple) ──
export function parseCSV(content: string): PaperRef[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const titleIdx = header.split(",").findIndex((h) => h.includes("title"));
  if (titleIdx < 0) return [];

  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]*)"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").trim()) || [];
    return {
      title: cols[titleIdx] || "",
      authors: cols[1] ? cols[1].split(";").map((a) => a.trim()) : [],
      year: cols[2] ? parseInt(cols[2]) || null : null,
      journal: cols[3] || null,
      doi: cols[4] || null,
      url: cols[5] || null,
    } as PaperRef;
  }).filter((p) => p.title);
}

// ── Download helper ──
export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
