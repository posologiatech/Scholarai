import { dedupeKey, normalizeDoi } from "./dedupe";
import { slugKey, type CustomField } from "./extraction";
import type { EligibilityItem } from "./protocol";

/** A row of the original systematic_reviews table, as far as the migration reads it. */
export interface LegacyReview {
  id: string;
  user_id: string;
  research_question: string;
  status: string;
  papers: LegacyPaper[] | null;
  screening_criteria: { id?: string; name?: string; description?: string; enabled?: boolean }[] | null;
  screening_results: Record<string, unknown> | null;
  included_paper_ids: string[] | null;
  extraction_columns: { id: string; name: string; enabled?: boolean }[] | null;
  extraction_results: Record<string, Record<string, string>> | null;
  report_content: string | null;
  pico: { population?: string; intervention?: string; comparison?: string; outcome?: string } | null;
  search_strategy: string | null;
  prospero_id: string | null;
  protocol_locked_at: string | null;
  protocol_locked_by: string | null;
  protocol_document: string | null;
  research_project_id: string | null;
  created_at: string;
}

export interface LegacyPaper {
  id: string; title?: string; authors?: unknown[]; year?: number | null; abstract?: string | null;
  source?: string; doi?: string | null; url?: string | null; journal?: string | null; studyType?: string | null;
}

export interface MigratedRecord {
  legacyId: string;
  source: string;
  doi: string | null;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  journal: string | null;
  url: string | null;
  study_design: string | null;
  dedupe_key: string | null;
  screen_status: "pending" | "ta_excluded" | "included";
}

export interface Migration {
  review: {
    title: string; question: string; framework: Record<string, string>; eligibility: EligibilityItem[]; registry: { id?: string };
    protocol_document: string | null; protocol_locked_at: string | null; protocol_locked_by: string | null; research_project_id: string | null;
    stage_state: Record<string, unknown>;
  };
  searches: { source: string; count: number }[];
  records: MigratedRecord[];
  extraction: { fields: CustomField[]; rows: { legacyId: string; data: Record<string, string> }[] };
  reportHtml: string | null;
  warnings: string[];
}

const SOURCE_ALIASES: Record<string, string> = { semantic_scholar: "semantic_scholar", pubmed: "pubmed", openalex: "openalex", europe_pmc: "europe_pmc", crossref: "crossref", core: "core", clinical_trials: "clinical_trials" };

/** Imported files carry sources such as "imported_ris"; everything unknown is kept as an import. */
export function sourceOf(p: LegacyPaper): string {
  const s = (p.source ?? "").toLowerCase();
  return SOURCE_ALIASES[s] ?? (s.startsWith("imported") ? "legacy_import" : s || "legacy_import");
}

const authorName = (a: unknown): string => (typeof a === "string" ? a : typeof a === "object" && a && "name" in a ? String((a as { name?: string }).name ?? "") : "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/**
 * Maps a legacy review onto the new model without losing the decisions it holds:
 * papers become records, the final inclusion list becomes the screening outcome, custom extraction
 * columns become team fields. What the old model never stored (per-reviewer votes, exclusion
 * reasons, the stage a paper was excluded in) is reported in `warnings`, not invented.
 */
export function mapLegacy(l: LegacyReview, now = new Date().toISOString()): Migration {
  const warnings: string[] = [];
  const papers = (l.papers ?? []).filter((p) => p && p.id && p.title?.trim());
  const dropped = (l.papers ?? []).length - papers.length;
  if (dropped > 0) warnings.push(`${dropped} registro(s) sem título foram ignorados.`);

  const included = new Set(l.included_paper_ids ?? []);
  const screened = included.size > 0 || Object.keys(l.screening_results ?? {}).length > 0;
  const records: MigratedRecord[] = papers.map((p) => {
    const authors = (p.authors ?? []).map(authorName).filter(Boolean);
    const year = typeof p.year === "number" && p.year > 1000 ? p.year : null;
    return {
      legacyId: p.id, source: sourceOf(p), doi: normalizeDoi(p.doi), title: p.title!.trim(), authors, year, abstract: p.abstract?.trim() || null,
      journal: p.journal ?? null, url: p.url ?? null, study_design: p.studyType ?? null, dedupe_key: dedupeKey({ title: p.title!, year, authors }),
      screen_status: included.has(p.id) ? "included" : screened ? "ta_excluded" : "pending",
    };
  });
  if (screened) warnings.push("A revisão antiga não guardava o motivo nem a fase de cada exclusão: os não incluídos foram marcados como excluídos na triagem, e o fluxograma não separa título/resumo de texto completo.");
  if (screened) warnings.push("Os votos individuais dos revisores não foram migrados; o resultado final de inclusão foi mantido.");

  const bySource = new Map<string, number>();
  for (const r of records) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);

  const taken = new Set<string>();
  const fields: CustomField[] = (l.extraction_columns ?? []).filter((c) => c.id && c.name?.trim()).map((c) => {
    const key = slugKey(c.name, taken); taken.add(key);
    return { key, label: c.name.trim(), kind: "text" as const, legacyId: c.id } as CustomField & { legacyId: string };
  });
  const colKey = new Map(fields.map((f) => [(f as CustomField & { legacyId: string }).legacyId, f.key]));
  const recordIds = new Set(records.map((r) => r.legacyId));
  const rows = Object.entries(l.extraction_results ?? {}).filter(([id]) => recordIds.has(id)).map(([legacyId, vals]) => ({
    legacyId, data: Object.fromEntries(Object.entries(vals ?? {}).filter(([cid, v]) => colKey.has(cid) && String(v ?? "").trim()).map(([cid, v]) => [colKey.get(cid)!, String(v)])),
  })).filter((r) => Object.keys(r.data).length > 0);
  if (rows.length) warnings.push("Os dados de extração foram migrados como rascunho: a revisão antiga não distinguia o que um revisor conferiu do que a IA propôs.");

  const crit = (l.screening_criteria ?? []).filter((c) => c.enabled !== false && (c.name || c.description));
  const eligibility: EligibilityItem[] = crit.map((c) => ({ kind: "include", text: [c.name, c.description].filter(Boolean).join(": ") }));
  if (!l.protocol_locked_at) warnings.push("O protocolo não estava congelado na revisão antiga e continua sem congelar: congele-o na etapa Pergunta e protocolo.");

  const closed = screened ? now : undefined;
  return {
    review: {
      title: l.research_question.slice(0, 120), question: l.research_question,
      framework: Object.fromEntries(Object.entries({ population: l.pico?.population, intervention: l.pico?.intervention, comparison: l.pico?.comparison, outcome: l.pico?.outcome }).filter(([, v]) => v)) as Record<string, string>,
      eligibility, registry: l.prospero_id ? { id: l.prospero_id } : {},
      protocol_document: l.protocol_document, protocol_locked_at: l.protocol_locked_at, protocol_locked_by: l.protocol_locked_by, research_project_id: l.research_project_id,
      stage_state: {
        migrated: { from: l.id, at: now, status: l.status },
        strategy: { sources: [...bySource.keys()].filter((s) => s !== "legacy_import"), blocks: [], filters: {} },
        screening: closed ? { ta_closed_at: closed, ft_closed_at: closed } : {},
        extraction: { fields: fields.map(({ key, label, kind }) => ({ key, label, kind })) },
        flags: { ...(records.length > 0 ? { strategy_approved: true } : {}) },
      },
    },
    searches: [...bySource].map(([source, count]) => ({ source, count })),
    records, extraction: { fields, rows },
    reportHtml: l.report_content?.trim() ? l.report_content.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") : null,
    warnings,
  };
}
