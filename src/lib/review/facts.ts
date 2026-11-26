import { TOOLS } from "./appraisal";
import type { AppraisalInput, Theme } from "./artifacts";
import { studyLabel } from "./artifacts";
import type { Data, FieldSpec } from "./extraction";
import { CERTAINTY_LABEL, certaintyOf, downgradeReasons, type GradeEntry } from "./grade";
import type { ReviewRecord } from "./protocol";
import type { PrismaCounts } from "./screening";
import type { Cmo, SynthesisState } from "./synthesis";
import type { ReviewTypeDef } from "./types";

export interface StudyFact { id: string; key: string; label: string; title: string; year: number | null; authors: string[] }

export interface FactsInput {
  locale: "pt" | "en";
  def: ReviewTypeDef;
  review: ReviewRecord;
  studies: StudyFact[];
  fields: FieldSpec[];
  extraction: Map<string, Data>;
  appraisals: AppraisalInput[];
  grade: GradeEntry[];
  themes: Theme[];
  assign: Record<string, string[]>;
  synthesis: SynthesisState;
  prisma: PrismaCounts;
  reasonLabels: Record<string, string>;
  searches: { source: string; label: string; method: string; query: string; run_at: string; results_count: number | null; imported_count: number }[];
  screening: { reviewers: number; kappaTitleAbstract: number | null; aiScreening: boolean; pilot: boolean };
  aiUses: string[];
  /** Later review types. */
  shortcuts?: string[];
  cmo?: Cmo[];
  programTheory?: string;
  overlap?: { cca: number | null; unique: number; inclusions: number; reviews: number } | null;
}

/** Assigns S1..Sn in a stable order, so a draft's [S3] always means the same study. */
export function withKeys(rows: { id: string; title: string; year: number | null; authors: string[] }[]): StudyFact[] {
  return rows.map((r, i) => ({ ...r, key: `S${i + 1}`, label: studyLabel(r) }));
}

const count = <T,>(xs: T[], f: (x: T) => string | null) => {
  const m = new Map<string, number>();
  for (const x of xs) { const k = f(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
};

export function buildFacts(section: string, c: FactsInput): Record<string, unknown> {
  const fw = Object.fromEntries(c.def.framework.fields.map((f) => [f.label[c.locale], c.review.framework?.[f.key] ?? ""]).filter(([, v]) => v));
  const years = c.studies.map((s) => s.year).filter((y): y is number => !!y);
  const get = (id: string, key: string) => c.extraction.get(id)?.[key];
  const hasField = (k: string) => c.fields.some((f) => f.key === k);
  const sampleKey = hasField("sample_size") ? "sample_size" : null;
  const sizes = sampleKey ? c.studies.map((s) => Number(String(get(s.id, sampleKey) ?? "").replace(/[^\d.]/g, ""))).filter((n) => Number.isFinite(n) && n > 0) : [];
  const gradeRows = c.grade.filter((g) => g.outcome.trim()).map((g) => {
    const cert = certaintyOf(g);
    return { outcome: g.outcome, studies: g.studies, design: g.design, effect: g.effect, certainty: cert ? CERTAINTY_LABEL[cert][c.locale] : null, downgradedFor: downgradeReasons(g, c.locale), notes: g.notes };
  });
  const robByTool = [...new Set(c.appraisals.map((a) => a.tool))].map((t) => ({
    tool: TOOLS[t].name,
    perStudy: c.appraisals.filter((a) => a.tool === t).map((a) => ({ study: c.studies.find((s) => s.id === a.record_id)?.key, overall: a.overall, domains: Object.fromEntries(Object.entries(a.domains).map(([k, v]) => [k, v.judgement])) })),
    overallCounts: count(c.appraisals.filter((a) => a.tool === t), (a) => a.overall),
  }));
  const themes = c.themes.map((t) => ({ theme: t.name, studies: c.studies.filter((s) => c.assign[s.id]?.includes(t.id)).map((s) => s.key) }));
  const findingKey = ["findings", "key_findings", "effect"].find(hasField);

  switch (section) {
    case "abstract":
      return { question: c.review.question, framework: fw, reviewType: c.def.label[c.locale], sources: c.searches.map((s) => s.label), flow: c.prisma, studiesIncluded: c.studies.length, yearRange: years.length ? [Math.min(...years), Math.max(...years)] : null,
        synthesisMethod: c.synthesis.method ?? null, certainty: gradeRows, themes, studies: c.studies.map(({ key, label }) => ({ key, label })) };
    case "objectives": return { question: c.review.question, framework: fw };
    case "methods_eligibility": return { framework: fw, include: c.review.eligibility.filter((e) => e.kind === "include").map((e) => e.text), exclude: c.review.eligibility.filter((e) => e.kind === "exclude").map((e) => e.text) };
    case "methods_selection":
      return { declaredShortcuts: c.shortcuts ?? [], phases: ["title and abstract", "full text"], reviewers: c.screening.reviewers, independentDuplicate: c.screening.reviewers >= 2, agreementKappaTitleAbstract: c.screening.kappaTitleAbstract !== null ? Number(c.screening.kappaTitleAbstract.toFixed(2)) : null,
        aiUsedAsSecondOpinion: c.screening.aiScreening, aiVoteCounted: false, calibrationPilot: c.screening.pilot, exclusionReasonsRecorded: true, duplicatesRemoved: c.prisma.duplicatesRemoved };
    case "methods_extraction":
      return { fields: c.fields.map((f) => f.label), studies: c.studies.length, reviewers: c.screening.reviewers, aiProposedValues: c.aiUses.includes("extraction"), everyValueCheckedByAReviewer: true, notReportedMarkedAs: "N/R", aiProposalsRequiredAQuoteFromTheText: true };
    case "methods_rob": return { toolsUsed: robByTool.map((r) => ({ tool: r.tool, studies: r.perStudy.length })), appraisalRequired: c.def.appraisal.required, aiSuggestedJudgements: c.aiUses.includes("extraction") };
    case "methods_synthesis": return { declaredShortcuts: c.shortcuts ?? [], overlap: c.overlap ?? null, method: c.synthesis.method ?? null, justification: c.synthesis.justification ?? "", themes: themes.map((t) => t.theme), approach: c.def.synthesis[c.locale] };
    case "methods_certainty": return { framework: "GRADE", domains: ["risk of bias", "inconsistency", "indirectness", "imprecision", "publication bias"], outcomesRated: gradeRows.length };
    case "results_selection": return { flow: c.prisma, exclusionReasons: Object.entries(c.prisma.excludedReasons).map(([k, n]) => ({ reason: c.reasonLabels[k] ?? k, n })) };
    case "results_characteristics":
      return { studies: c.studies.length, yearRange: years.length ? [Math.min(...years), Math.max(...years)] : null, totalParticipants: sizes.length ? sizes.reduce((a, b) => a + b, 0) : null, studiesReportingSampleSize: sizes.length,
        countries: hasField("country") ? count(c.studies, (s) => (get(s.id, "country") as string | undefined)?.trim() || null) : [], designs: count(c.studies, (s) => ((get(s.id, "design") ?? get(s.id, "method")) as string | undefined)?.trim() || null),
        perStudy: c.studies.map((s) => ({ key: s.key, label: s.label, ...Object.fromEntries(c.fields.slice(0, 6).map((f) => [f.label, get(s.id, f.key) ?? ""])) })) };
    case "results_rob": return { tools: robByTool };
    case "results_findings":
      return { programTheory: c.programTheory ?? "", configurations: c.cmo ?? [], overlap: c.overlap ?? null, perStudy: c.studies.map((s) => ({ key: s.key, label: s.label, findings: findingKey ? get(s.id, findingKey) ?? "" : "", outcomes: get(s.id, "outcomes") ?? "" })), themes, gaps: c.synthesis.gaps ?? "", conclusions: c.synthesis.conclusions ?? "" };
    case "results_certainty": return { outcomes: gradeRows };
    case "limitations":
      return { declaredShortcuts: c.shortcuts ?? [], robOverall: robByTool.map((r) => ({ tool: r.tool, counts: r.overallCounts })), certainty: gradeRows.map((g) => ({ outcome: g.outcome, certainty: g.certainty, downgradedFor: g.downgradedFor })), sourcesSearched: c.searches.length, studies: c.studies.length,
        singleReviewer: c.screening.reviewers < 2, aiUsed: c.aiUses };
    default: return {};
  }
}

// ───────── deterministic sections ─────────

const fmtDate = (iso: string, locale: "pt" | "en") => new Date(iso).toLocaleDateString(locale === "pt" ? "pt-BR" : "en-GB");

export function autoText(section: string, c: FactsInput): string {
  const pt = c.locale === "pt";
  const r = c.review;
  if (section === "registration") {
    const reg = c.def.registry;
    const lines: string[] = [];
    lines.push(r.registry?.id
      ? (pt ? `A revisão foi registrada em ${reg?.name ?? "uma plataforma de registro"} sob o número ${r.registry.id}.` : `The review was registered on ${reg?.name ?? "a registry"} under number ${r.registry.id}.`)
      : (pt ? "A revisão não foi registrada em plataforma pública." : "The review was not registered in a public registry."));
    if (r.protocol_locked_at) lines.push(pt ? `O protocolo, com a pergunta, os critérios de elegibilidade e a estratégia, foi definido e congelado em ${fmtDate(r.protocol_locked_at, c.locale)}, antes da busca e da triagem.` : `The protocol, with the question, eligibility criteria and strategy, was defined and locked on ${fmtDate(r.protocol_locked_at, c.locale)}, before searching and screening.`);
    lines.push(pt ? "Alterações em relação ao protocolo: [descreva ou escreva \"nenhuma\"]." : "Amendments to the protocol: [describe or write \"none\"].");
    return lines.join(" ");
  }
  if (section === "methods_sources") {
    if (c.searches.length === 0) return pt ? "[Nenhuma busca registrada ainda.]" : "[No searches logged yet.]";
    const list = c.searches.map((s) => {
      const date = fmtDate(s.run_at, c.locale);
      const how = s.method === "api" ? (pt ? "consulta direta" : "direct query") : s.method === "manual" ? (pt ? "busca manual" : "manual search") : (pt ? "exportação importada" : "imported export");
      return `${s.label} (${date}; ${how}${s.results_count != null ? `; ${s.results_count} ${pt ? "resultados" : "results"}` : `; ${s.imported_count} ${pt ? "registros" : "records"}`})`;
    }).join("; ");
    const dedupe = pt
      ? `Os registros foram reunidos e as duplicatas removidas automaticamente quando o DOI, ou o título com o ano e o primeiro autor, coincidiam; títulos apenas parecidos foram conferidos manualmente (${c.prisma.duplicatesRemoved} duplicatas removidas).`
      : `Records were pooled and duplicates removed automatically when the DOI, or the title with year and first author, matched; merely similar titles were checked manually (${c.prisma.duplicatesRemoved} duplicates removed).`;
    return pt ? `Foram pesquisadas as seguintes fontes: ${list}. As estratégias de busca completas de cada fonte, com filtros e limites, estão no Apêndice. ${dedupe}`
              : `The following sources were searched: ${list}. The full search strategies for each source, with filters and limits, are in the Appendix. ${dedupe}`;
  }
  if (section === "declarations") {
    const uses = c.aiUses;
    const names: Record<string, [string, string]> = {
      screening: ["como segunda opinião na triagem por título e resumo (a sugestão aparecia só depois do voto do revisor e não contou como voto)", "as a second opinion in title and abstract screening (the suggestion appeared only after the reviewer voted and did not count as a vote)"],
      extraction: ["para propor valores de extração de dados e julgamentos de avaliação crítica, cada um com citação do texto e conferido por um revisor humano", "to propose data-extraction values and critical-appraisal judgements, each with a quote from the text and checked by a human reviewer"],
      drafting: ["para rascunhar seções do manuscrito a partir de fatos calculados pelo sistema; o autor revisou e aprovou o texto", "to draft manuscript sections from facts computed by the system; the author reviewed and approved the text"],
    };
    const used = uses.filter((u) => names[u]).map((u) => names[u][pt ? 0 : 1]);
    const ai = used.length
      ? (pt ? `Uso de inteligência artificial: ferramentas de IA foram usadas ${used.join("; ")}. Nenhuma decisão de inclusão, nenhum dado extraído e nenhuma conclusão foi aceito sem conferência humana.` : `Use of artificial intelligence: AI tools were used ${used.join("; ")}. No inclusion decision, extracted datum or conclusion was accepted without human checking.`)
      : (pt ? "Uso de inteligência artificial: não foram usadas ferramentas de IA." : "Use of artificial intelligence: no AI tools were used.");
    return pt ? `Financiamento: [informe]\nConflitos de interesse: [informe]\nDisponibilidade de dados: [informe onde estão os dados e os materiais]\n${ai}`
              : `Funding: [state]\nCompeting interests: [state]\nData availability: [state where data and materials are available]\n${ai}`;
  }
  return "";
}

// ───────── verification and citation rendering ─────────

const CITE = /\[(S\d+(?:\s*[,;]\s*S\d+)*)\]/g;
const NUM = /\d+(?:[.,]\d+)?/g;
const norm = (n: string) => String(Number(n.replace(",", ".")));

/** Every number that appears anywhere in the facts, written the way a draft could repeat it. */
export function allowedNumbers(facts: unknown): Set<string> {
  const set = new Set<string>();
  const text = JSON.stringify(facts) ?? "";
  for (const m of text.match(NUM) ?? []) set.add(norm(m));
  return set;
}

export interface Issue { type: "unsupported_number" | "unknown_citation"; snippet: string }

/** Numbers in a draft must come from the facts, and every [S#] must be a study of this review. */
export function verifyDraft(text: string, facts: unknown, validKeys: Set<string>): Issue[] {
  const issues: Issue[] = [];
  for (const m of text.matchAll(CITE)) for (const k of m[1].split(/[,;]/).map((x) => x.trim())) if (!validKeys.has(k)) issues.push({ type: "unknown_citation", snippet: k });
  const allowed = allowedNumbers(facts);
  const body = text.replace(CITE, " ");
  const seen = new Set<string>();
  for (const m of body.matchAll(NUM)) {
    const n = norm(m[0]);
    if (!allowed.has(n) && !seen.has(n)) { seen.add(n); issues.push({ type: "unsupported_number", snippet: m[0] }); }
  }
  return issues;
}

/** Turns [S1, S3] into (Silva et al., 2020; Lee, 2019) or [1, 3], numbering by first appearance across the manuscript. */
export function renderCitations(text: string, studies: StudyFact[], style: "author-year" | "numbered", order: string[]): string {
  const byKey = new Map(studies.map((s) => [s.key, s]));
  return text.replace(CITE, (_all, group: string) => {
    const keys = group.split(/[,;]/).map((x) => x.trim()).filter((k) => byKey.has(k));
    if (!keys.length) return "";
    if (style === "numbered") {
      return `[${keys.map((k) => { if (!order.includes(k)) order.push(k); return order.indexOf(k) + 1; }).join(", ")}]`;
    }
    return `(${keys.map((k) => { const s = byKey.get(k)!; const a = s.authors[0]?.split(",")[0]?.trim(); return a ? `${a}${s.authors.length > 1 ? " et al." : ""}, ${s.year ?? "s.d."}` : `${s.title.slice(0, 30)}, ${s.year ?? "s.d."}`; }).join("; ")})`;
  });
}

export function referenceList(studies: StudyFact[], extra: Record<string, { journal?: string | null; doi?: string | null }>, order: string[] | null): string[] {
  const used = order ? order.map((k) => studies.find((s) => s.key === k)).filter(Boolean) as StudyFact[] : [...studies].sort((a, b) => a.label.localeCompare(b.label));
  return used.map((s, i) => {
    const e = extra[s.id] ?? {};
    const authors = s.authors.length ? (s.authors.length > 6 ? `${s.authors.slice(0, 6).join(", ")}, et al.` : s.authors.join(", ")) : "";
    return `${order ? `${i + 1}. ` : ""}${authors ? `${authors}. ` : ""}${s.title.replace(/\.$/, "")}. ${e.journal ? `${e.journal}. ` : ""}${s.year ?? ""}.${e.doi ? ` doi:${e.doi}` : ""}`.replace(/\s+/g, " ").trim();
  });
}
