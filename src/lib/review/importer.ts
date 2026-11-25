import { detectAndParse } from "@/lib/bibliographyParsers";
import { dedupeKey, normalizeDoi } from "./dedupe";

export interface NewRecord {
  review_id: string;
  search_id: string;
  source: string;
  external_id: string | null;
  doi: string | null;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  journal: string | null;
  url: string | null;
  study_design: string | null;
  dedupe_key: string | null;
}

export interface RawPaper {
  id?: string;
  title?: string;
  authors?: string[];
  year?: number | null;
  abstract?: string | null;
  doi?: string | null;
  url?: string | null;
  journal?: string | null;
  studyType?: string | null;
}

/** Maps parsed or harvested papers to review_records rows; drops entries without a title. */
export function toRecords(papers: RawPaper[], ctx: { reviewId: string; searchId: string; source: string }): NewRecord[] {
  const out: NewRecord[] = [];
  for (const p of papers) {
    const title = p.title?.trim();
    if (!title) continue;
    const authors = (p.authors ?? []).filter(Boolean);
    const year = typeof p.year === "number" && p.year > 1000 ? p.year : null;
    out.push({
      review_id: ctx.reviewId,
      search_id: ctx.searchId,
      source: ctx.source,
      external_id: p.id ?? null,
      doi: normalizeDoi(p.doi),
      title,
      authors,
      year,
      abstract: p.abstract?.trim() || null,
      journal: p.journal ?? null,
      url: p.url ?? null,
      study_design: p.studyType ?? null,
      dedupe_key: dedupeKey({ title, year, authors }),
    });
  }
  return out;
}

export function parseExport(text: string, fileName: string): RawPaper[] {
  return detectAndParse(text, fileName);
}
