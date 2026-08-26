import { supabase } from "@/integrations/supabase/client";

export interface CoauthorPaper {
  title?: string;
  authors?: unknown;
  [key: string]: unknown;
}

export interface AuthorPapers {
  count: number;
  papers: string[];
}

export interface CoauthorEdgeInfo {
  weight: number;
  sharedPapers: string[];
}

/** Same corpus CoauthorshipNetwork.tsx graphs: papers from saved searches + the papers table, deduped by DOI/title. */
export async function fetchCoauthorCorpus(): Promise<CoauthorPaper[]> {
  const { data: searches } = await supabase
    .from("saved_searches")
    .select("papers")
    .order("created_at", { ascending: false })
    .limit(50);

  const allPapers: CoauthorPaper[] = [];
  if (searches) {
    for (const s of searches) {
      if (Array.isArray(s.papers)) allPapers.push(...(s.papers as CoauthorPaper[]));
    }
  }

  const { data: dbPapers } = await supabase
    .from("papers")
    .select("title, authors, year, doi")
    .limit(500);
  if (dbPapers) allPapers.push(...(dbPapers as CoauthorPaper[]));

  const seen = new Set<string>();
  return allPapers.filter((p) => {
    const doi = p.doi as string | undefined;
    const key = doi || (p.title as string | undefined)?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Normalizes an author entry (string or {name}/{lastName} object) to a plain trimmed name. */
export function normalizeAuthorEntry(a: unknown): string {
  const obj = a as { name?: string; lastName?: string } | null;
  const name = typeof a === "string" ? a : obj?.name || obj?.lastName || "";
  return String(name).trim().replace(/\s+/g, " ");
}

/** Builds per-author paper counts and pairwise co-authorship edges from a paper corpus. */
export function buildCoauthorGraph(papers: CoauthorPaper[]) {
  const authorPapers: Record<string, AuthorPapers> = {};
  const edgeMap: Record<string, CoauthorEdgeInfo> = {};

  for (const paper of papers) {
    const authors = Array.isArray(paper.authors)
      ? (paper.authors as unknown[]).map(normalizeAuthorEntry).filter(Boolean)
      : [];
    const pTitle = (paper.title as string) || "?";

    for (const a of authors) {
      if (!authorPapers[a]) authorPapers[a] = { count: 0, papers: [] };
      authorPapers[a].count++;
      authorPapers[a].papers.push(pTitle);
    }

    for (let i = 0; i < authors.length; i++) {
      for (let j = i + 1; j < authors.length; j++) {
        const key = [authors[i], authors[j]].sort().join("|||");
        if (!edgeMap[key]) edgeMap[key] = { weight: 0, sharedPapers: [] };
        edgeMap[key].weight++;
        edgeMap[key].sharedPapers.push(pTitle);
      }
    }
  }

  return { authorPapers, edgeMap };
}

/** Strips diacritics/punctuation and collapses whitespace for loose name comparison. */
export function normalizeAuthorName(name: string): string {
  return name
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Last whitespace-separated token — a reasonable surname guess for "First [Middle] Last" names. */
function surnameOf(normalized: string): string {
  const parts = normalized.split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function firstInitialOf(normalized: string): string {
  const parts = normalized.split(" ").filter(Boolean);
  return parts.length ? parts[0][0] : "";
}

/**
 * Loose match: exact normalized name, or same surname + same first initial
 * (handles "John Smith" vs "J. Smith" style variation between sources).
 */
export function namesLooselyMatch(a: string, b: string): boolean {
  const na = normalizeAuthorName(a);
  const nb = normalizeAuthorName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const surnameA = surnameOf(na);
  const surnameB = surnameOf(nb);
  return !!surnameA && surnameA === surnameB && firstInitialOf(na) === firstInitialOf(nb);
}
