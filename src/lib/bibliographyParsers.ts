/**
 * Client-side parsers for RIS and BibTeX bibliography formats
 * Maps imported records to the Paper interface used in systematic reviews
 */

interface ImportedPaper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  source?: string;
  doi?: string;
  url?: string;
  journal?: string;
}

// ─── RIS Parser ───
// Tags: TY (type), TI/T1 (title), AU/A1 (author), AB/N2 (abstract),
//       PY/Y1/DA (year), DO (doi), UR (url), JO/JF/T2 (journal), ER (end)
export function parseRIS(text: string): ImportedPaper[] {
  const papers: ImportedPaper[] = [];
  const entries = text.split(/\nER\s*-/);

  for (const entry of entries) {
    const lines = entry.split("\n");
    let title = "";
    const authors: string[] = [];
    let abstract = "";
    let year: number | undefined;
    let doi = "";
    let url = "";
    let journal = "";

    for (const line of lines) {
      const match = line.match(/^([A-Z][A-Z0-9])\s{2}-\s?(.*)/);
      if (!match) continue;
      const [, tag, value] = match;
      const v = value.trim();

      switch (tag) {
        case "TI":
        case "T1":
          title = title ? `${title} ${v}` : v;
          break;
        case "AU":
        case "A1":
          if (v) authors.push(v);
          break;
        case "AB":
        case "N2":
          abstract = abstract ? `${abstract} ${v}` : v;
          break;
        case "PY":
        case "Y1":
        case "DA":
          const yr = parseInt(v.slice(0, 4));
          if (!isNaN(yr) && yr > 1800 && yr < 2100) year = yr;
          break;
        case "DO":
          doi = v;
          break;
        case "UR":
          url = v;
          break;
        case "JO":
        case "JF":
        case "T2":
          if (!journal) journal = v;
          break;
      }
    }

    if (title.trim()) {
      papers.push({
        id: crypto.randomUUID(),
        title: title.trim(),
        authors: authors.length > 0 ? authors : undefined,
        year,
        abstract: abstract || undefined,
        source: "imported_ris",
        doi: doi || undefined,
        url: url || undefined,
        journal: journal || undefined,
      });
    }
  }

  return papers;
}

// ─── BibTeX Parser ───
export function parseBibTeX(text: string): ImportedPaper[] {
  const papers: ImportedPaper[] = [];
  // Match @type{key, ... }
  const entryRegex = /@\w+\{[^@]*?\n\}/gs;
  const entries = text.match(entryRegex) || [];

  for (const entry of entries) {
    const getField = (name: string): string => {
      const re = new RegExp(`${name}\\s*=\\s*[{"]([\\s\\S]*?)[}"]`, "i");
      const m = entry.match(re);
      return m ? m[1].replace(/\s+/g, " ").trim() : "";
    };

    const title = getField("title").replace(/[{}]/g, "");
    if (!title) continue;

    const authorRaw = getField("author");
    const authors = authorRaw
      ? authorRaw.split(/\s+and\s+/i).map((a) => a.replace(/[{}]/g, "").trim())
      : undefined;

    const yearStr = getField("year");
    const year = yearStr ? parseInt(yearStr) : undefined;

    papers.push({
      id: crypto.randomUUID(),
      title,
      authors,
      year: year && year > 1800 && year < 2100 ? year : undefined,
      abstract: getField("abstract") || undefined,
      source: "imported_bibtex",
      doi: getField("doi") || undefined,
      url: getField("url") || undefined,
      journal: getField("journal").replace(/[{}]/g, "") || getField("booktitle").replace(/[{}]/g, "") || undefined,
    });
  }

  return papers;
}

// ─── CSV Parser (simple) ───
export function parseCSV(text: string): ImportedPaper[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const findCol = (...names: string[]) =>
    headers.findIndex((h) => names.some((n) => h.includes(n)));

  const titleIdx = findCol("title", "titulo", "título");
  const authorIdx = findCol("author", "autor");
  const yearIdx = findCol("year", "ano", "publication_year");
  const abstractIdx = findCol("abstract", "resumo");
  const doiIdx = findCol("doi");
  const urlIdx = findCol("url", "link");
  const journalIdx = findCol("journal", "source", "revista");

  if (titleIdx === -1) return [];

  const papers: ImportedPaper[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split (handles basic quoted fields)
    const cells = lines[i].match(/(".*?"|[^,]*),?/g)?.map((c) =>
      c.replace(/,\s*$/, "").replace(/^"|"$/g, "").trim()
    ) || [];

    const title = cells[titleIdx];
    if (!title) continue;

    const yearStr = yearIdx >= 0 ? cells[yearIdx] : "";
    const yr = yearStr ? parseInt(yearStr) : undefined;

    papers.push({
      id: crypto.randomUUID(),
      title,
      authors: authorIdx >= 0 && cells[authorIdx] ? cells[authorIdx].split(/;\s*|,\s*and\s+/) : undefined,
      year: yr && yr > 1800 && yr < 2100 ? yr : undefined,
      abstract: abstractIdx >= 0 ? cells[abstractIdx] || undefined : undefined,
      source: "imported_csv",
      doi: doiIdx >= 0 ? cells[doiIdx] || undefined : undefined,
      url: urlIdx >= 0 ? cells[urlIdx] || undefined : undefined,
      journal: journalIdx >= 0 ? cells[journalIdx] || undefined : undefined,
    });
  }

  return papers;
}

// ─── Deduplication ───
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export interface DuplicateGroup {
  keep: ImportedPaper;
  duplicates: ImportedPaper[];
}

export function findDuplicates(
  papers: ImportedPaper[],
  threshold = 0.85
): { unique: ImportedPaper[]; duplicateGroups: DuplicateGroup[] } {
  const normalized = papers.map((p) => ({
    paper: p,
    normTitle: normalizeTitle(p.title),
    doi: p.doi?.toLowerCase().trim(),
  }));

  const used = new Set<number>();
  const duplicateGroups: DuplicateGroup[] = [];
  const unique: ImportedPaper[] = [];

  for (let i = 0; i < normalized.length; i++) {
    if (used.has(i)) continue;

    const dupsOfI: ImportedPaper[] = [];

    for (let j = i + 1; j < normalized.length; j++) {
      if (used.has(j)) continue;

      // Exact DOI match
      if (normalized[i].doi && normalized[j].doi && normalized[i].doi === normalized[j].doi) {
        dupsOfI.push(normalized[j].paper);
        used.add(j);
        continue;
      }

      // Fuzzy title match
      if (jaccardSimilarity(normalized[i].normTitle, normalized[j].normTitle) >= threshold) {
        dupsOfI.push(normalized[j].paper);
        used.add(j);
      }
    }

    if (dupsOfI.length > 0) {
      duplicateGroups.push({ keep: normalized[i].paper, duplicates: dupsOfI });
    }

    unique.push(normalized[i].paper);
    used.add(i);
  }

  return { unique, duplicateGroups };
}

// Auto-detect file format
export function detectAndParse(text: string, fileName: string): ImportedPaper[] {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "ris" || text.match(/^TY\s{2}-/m)) return parseRIS(text);
  if (ext === "bib" || text.match(/@\w+\{/)) return parseBibTeX(text);
  if (ext === "csv") return parseCSV(text);
  // Try RIS first, then BibTeX
  const ris = parseRIS(text);
  if (ris.length > 0) return ris;
  const bib = parseBibTeX(text);
  if (bib.length > 0) return bib;
  return parseCSV(text);
}
