import { normalizeDoi, normalizeTitle } from "./dedupe";

export interface ReviewPrimaryList { id: string; label: string; studies: string[] }

/**
 * One key per primary study, however it was written: a DOI, a PubMed id or a title. Two lines that
 * name the same study must land on the same key or the overlap is under-counted.
 */
export function studyKey(line: string): string | null {
  const raw = line.trim();
  if (!raw) return null;
  const doi = normalizeDoi(raw.replace(/^.*?(10\.\d{4,9}\/\S+).*$/i, "$1"));
  if (doi) return `doi:${doi}`;
  const pmid = raw.match(/^(?:pmid:?\s*)?(\d{6,9})$/i);
  if (pmid) return `pmid:${pmid[1]}`;
  const title = normalizeTitle(raw);
  return title.length >= 10 ? `t:${title}` : null;
}

export interface Overlap {
  /** Reviews that listed at least one primary study. */
  reviews: number;
  /** Distinct primary studies. */
  unique: number;
  /** Every inclusion counted, so a study in three reviews counts three times. */
  inclusions: number;
  /** Corrected covered area, in percent; null when it cannot be computed (one review, or no repetition possible). */
  cca: number | null;
  band: "slight" | "moderate" | "high" | "very_high" | null;
  matrix: { key: string; display: string; inReviews: string[] }[];
  /** Reviews with an empty list, which the CCA silently ignores. */
  missing: string[];
}

/** Corrected covered area (Pieper et al., 2014): (N - r) / (r * c - r), as a percentage. */
export function overlapOf(lists: ReviewPrimaryList[]): Overlap {
  const missing = lists.filter((l) => l.studies.every((s) => !studyKey(s))).map((l) => l.id);
  const used = lists.filter((l) => !missing.includes(l.id));
  const byKey = new Map<string, { display: string; inReviews: Set<string> }>();
  for (const l of used) {
    for (const line of l.studies) {
      const k = studyKey(line);
      if (!k) continue;
      const e = byKey.get(k) ?? byKey.set(k, { display: line.trim().slice(0, 140), inReviews: new Set() }).get(k)!;
      e.inReviews.add(l.id);
    }
  }
  const r = byKey.size, c = used.length;
  const N = [...byKey.values()].reduce((n, e) => n + e.inReviews.size, 0);
  const denom = r * c - r;
  const cca = c >= 2 && denom > 0 ? Math.round(((N - r) / denom) * 1000) / 10 : null;
  const band = cca === null ? null : cca <= 5 ? "slight" : cca <= 10 ? "moderate" : cca <= 15 ? "high" : "very_high";
  return {
    reviews: c, unique: r, inclusions: N, cca, band, missing,
    matrix: [...byKey.entries()].map(([key, e]) => ({ key, display: e.display, inReviews: [...e.inReviews] })).sort((a, b) => b.inReviews.length - a.inReviews.length),
  };
}

export const BAND_LABEL: Record<NonNullable<Overlap["band"]>, { pt: string; en: string }> = {
  slight: { pt: "leve (0 a 5%)", en: "slight (0 to 5%)" }, moderate: { pt: "moderada (6 a 10%)", en: "moderate (6 to 10%)" },
  high: { pt: "alta (11 a 15%)", en: "high (11 to 15%)" }, very_high: { pt: "muito alta (acima de 15%)", en: "very high (above 15%)" },
};
