// RIS is the interchange format EndNote (and most other reference managers)
// read and write natively — there's no free public EndNote web API to sync
// against like Zotero/Mendeley, so file import/export is the real integration.

export interface RisPaper {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  journal: string | null;
  source?: string;
}

const authorToLastFirst = (author: string) => {
  if (author.includes(",")) return author.trim();
  const parts = author.trim().split(/\s+/);
  if (parts.length < 2) return author.trim();
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
};

export const papersToRIS = (papers: RisPaper[]): string => {
  const entries = papers.map((p) => {
    const lines = ["TY  - JOUR"];
    (p.authors || []).forEach((a) => {
      const name = typeof a === "string" ? a : (a as { name?: string })?.name || "";
      if (name) lines.push(`AU  - ${authorToLastFirst(name)}`);
    });
    if (p.title) lines.push(`TI  - ${p.title}`);
    if (p.year) lines.push(`PY  - ${p.year}`);
    if (p.journal) lines.push(`JO  - ${p.journal}`);
    if (p.doi) lines.push(`DO  - ${p.doi}`);
    if (p.url) lines.push(`UR  - ${p.url}`);
    if (p.abstract) lines.push(`AB  - ${p.abstract}`);
    lines.push("ER  - ");
    return lines.join("\n");
  });
  return entries.join("\n\n");
};

const RIS_TAG = /^([A-Z][A-Z0-9]) {2}- ?(.*)$/;

export const parseRIS = (text: string): RisPaper[] => {
  const papers: RisPaper[] = [];
  let current: { title: string; authors: string[]; year: number | null; doi: string | null; url: string | null; abstract: string | null; journal: string | null } | null = null;

  const lines = text.split(/\r\n|\r|\n/);
  for (const rawLine of lines) {
    const match = rawLine.match(RIS_TAG);
    if (!match) continue;
    const [, tag, value] = match;

    if (tag === "TY") {
      current = { title: "", authors: [], year: null, doi: null, url: null, abstract: null, journal: null };
      continue;
    }
    if (!current) continue;

    switch (tag) {
      case "TI":
      case "T1":
        current.title = value;
        break;
      case "AU":
      case "A1":
        if (value) current.authors.push(value);
        break;
      case "PY":
      case "Y1": {
        const yearMatch = value.match(/\d{4}/);
        if (yearMatch) current.year = parseInt(yearMatch[0], 10);
        break;
      }
      case "DO":
        current.doi = value || null;
        break;
      case "UR":
      case "L1":
        current.url = value || null;
        break;
      case "AB":
      case "N2":
        current.abstract = value || null;
        break;
      case "JO":
      case "JF":
      case "T2":
        current.journal = value || null;
        break;
      case "ER":
        if (current.title || current.authors.length) {
          papers.push({ ...current, source: "endnote" });
        }
        current = null;
        break;
      default:
        break;
    }
  }

  return papers;
};
