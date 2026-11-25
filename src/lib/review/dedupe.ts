export interface DedupeRecord {
  id: string;
  title: string;
  year?: number | null;
  authors?: string[] | null;
  doi?: string | null;
  abstract?: string | null;
}

export type DuplicateReason = "doi" | "title_year_author" | "similar_title";

export interface DuplicateGroup {
  keepId: string;
  duplicateIds: string[];
  reason: DuplicateReason;
  /** "certain" groups are safe to merge automatically; "check" ones need a human decision. */
  confidence: "certain" | "check";
}

export function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const d = doi.toLowerCase().trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "").replace(/[\s.;,]+$/, "");
  return d.startsWith("10.") ? d : null;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAuthorKey(authors?: string[] | null): string {
  const a = authors?.[0];
  if (!a) return "";
  const name = a.includes(",") ? a.split(",")[0] : a.trim().split(/\s+/).pop() ?? "";
  return normalizeTitle(name).replace(/\s/g, "");
}

/** Stable key stored on each record: same title + year + first author collapses to one row. */
export function dedupeKey(r: Pick<DedupeRecord, "title" | "year" | "authors">): string | null {
  const t = normalizeTitle(r.title);
  if (t.length < 12) return null; // too short to be trusted as an identity
  return `${t}|${r.year ?? ""}|${firstAuthorKey(r.authors)}`;
}

/** Dice coefficient on character bigrams: tolerant of typos and plural/singular differences. */
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); }
  return m;
}
function dice(a: Map<string, number>, b: Map<string, number>): number {
  let inter = 0, na = 0, nb = 0;
  for (const v of a.values()) na += v;
  for (const v of b.values()) nb += v;
  for (const [g, v] of a) inter += Math.min(v, b.get(g) ?? 0);
  return na + nb === 0 ? 0 : (2 * inter) / (na + nb);
}

/** Richest record wins: abstract and DOI matter most for the later stages. */
const richness = (r: DedupeRecord) => (r.abstract?.length ? 2 : 0) + (normalizeDoi(r.doi) ? 1 : 0) + (r.authors?.length ? 0.5 : 0);

/**
 * Groups duplicates in three passes of decreasing certainty: same DOI, same normalized
 * title+year+first author, then a similar title in the same year window. Only the last needs
 * a human. The fuzzy pass is blocked by the title's opening characters to stay near-linear on
 * thousands of records, so a duplicate whose title differs in its first words is not caught.
 */
export function groupDuplicates(records: DedupeRecord[], similarity = 0.92): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const taken = new Set<string>();
  const byId = new Map(records.map((r) => [r.id, r]));

  const collect = (key: (r: DedupeRecord) => string | null, reason: DuplicateReason) => {
    const buckets = new Map<string, DedupeRecord[]>();
    for (const r of records) {
      if (taken.has(r.id)) continue;
      const k = key(r);
      if (!k) continue;
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(r);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => richness(b) - richness(a));
      const [keep, ...dups] = sorted;
      // Same title but different DOIs can be a preprint and its article, or an erratum: ask.
      const dois = new Set(sorted.map((r) => normalizeDoi(r.doi)).filter(Boolean));
      groups.push({ keepId: keep.id, duplicateIds: dups.map((d) => d.id), reason, confidence: dois.size > 1 ? "check" : "certain" });
      for (const r of sorted) taken.add(r.id);
    }
  };

  collect((r) => normalizeDoi(r.doi), "doi");
  collect((r) => dedupeKey(r), "title_year_author");

  // Fuzzy pass
  const blocks = new Map<string, DedupeRecord[]>();
  for (const r of records) {
    if (taken.has(r.id)) continue;
    const t = normalizeTitle(r.title);
    if (t.length < 12) continue;
    const k = t.slice(0, 14);
    (blocks.get(k) ?? blocks.set(k, []).get(k)!).push(r);
  }
  for (const list of blocks.values()) {
    if (list.length < 2) continue;
    // Precompute once per record; pairs whose lengths differ a lot cannot reach the threshold.
    const prep = list.map((r) => { const t = normalizeTitle(r.title); return { r, len: t.length, grams: bigrams(t) }; });
    const used = new Set<string>();
    for (let i = 0; i < prep.length; i++) {
      if (used.has(prep[i].r.id)) continue;
      const dups: DedupeRecord[] = [];
      for (let j = i + 1; j < prep.length; j++) {
        if (used.has(prep[j].r.id)) continue;
        const yi = prep[i].r.year, yj = prep[j].r.year;
        if (yi && yj && Math.abs(yi - yj) > 1) continue;
        if (Math.min(prep[i].len, prep[j].len) / Math.max(prep[i].len, prep[j].len) < similarity - 0.1) continue;
        if (dice(prep[i].grams, prep[j].grams) >= similarity) dups.push(prep[j].r);
      }
      if (dups.length) {
        const all = [prep[i].r, ...dups].sort((a, b) => richness(b) - richness(a));
        groups.push({ keepId: all[0].id, duplicateIds: all.slice(1).map((d) => d.id), reason: "similar_title", confidence: "check" });
        all.forEach((r) => used.add(r.id));
      }
    }
  }
  // Defensive: a group must refer to known records.
  return groups.filter((g) => byId.has(g.keepId));
}

/** "check" groups count as removed only once the user accepted them (by the kept record's id). */
export function summarize(total: number, groups: DuplicateGroup[], accepted: Set<string> = new Set()) {
  const removed = groups.reduce((n, g) => n + (g.confidence === "certain" || accepted.has(g.keepId) ? g.duplicateIds.length : 0), 0);
  return { identified: total, removed, remaining: total - removed };
}
