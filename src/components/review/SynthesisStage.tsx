import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { GradeEditor } from "./GradeEditor";
import { MethodChooser } from "./MethodChooser";
import { RealistPanel } from "./RealistPanel";
import { UmbrellaPanel } from "./UmbrellaPanel";
import { ThemeMatrix } from "./ThemeMatrix";
import { Button } from "@/components/ui/button";
import { SOURCES } from "@/lib/review/databases";
import { primaryLists, type Ctx } from "@/lib/review/artifacts";
import { fieldsFor } from "@/lib/review/extraction";
import { loadIncluded, loadMyAppraisals, loadMyExtractions, type AppraisalRow, type ExtractionRow, type IncludedRecord } from "@/lib/review/extractionApi";
import type { ReviewRecord } from "@/lib/review/protocol";
import { listSearches, type SearchRow } from "@/lib/review/records";
import { loadStatusRows } from "@/lib/review/screeningApi";
import type { ScreenStatus } from "@/lib/review/screening";
import { getSynthesis, loadExcluded, withSynthesis, type Method } from "@/lib/review/synthesis";
import { getFlags, withFlags } from "@/lib/review/strategy";
import type { ReviewTypeDef } from "@/lib/review/types";
import { cn } from "@/lib/utils";

type Tab = "synthesis" | "artifacts";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  userId: string;
  locale: "pt" | "en";
  onChange: (patch: Partial<ReviewRecord>) => void;
}

interface Loaded {
  records: IncludedRecord[]; extractions: ExtractionRow[]; appraisals: AppraisalRow[]; searches: SearchRow[];
  excluded: Awaited<ReturnType<typeof loadExcluded>>;
  statusRows: { duplicate_of: string | null; screen_status: ScreenStatus; exclusion_reason_code: string | null }[];
}

export function SynthesisStage({ def, review, userId, locale, onChange }: Props) {
  const pt = locale === "pt";
  const isOwner = review.owner_id === userId;
  const [tab, setTab] = useState<Tab>("synthesis");
  const [data, setData] = useState<Loaded | null>(null);
  const syn = getSynthesis(review);
  const flags = getFlags(review);

  const load = useCallback(async () => {
    const [records, extractions, appraisals, searches, excluded, statusRows] = await Promise.all([
      loadIncluded(review.id), loadMyExtractions(review.id, userId), loadMyAppraisals(review.id, userId), listSearches(review.id), loadExcluded(review.id), loadStatusRows(review.id),
    ]);
    setData({ records, extractions, appraisals, searches, excluded, statusRows });
  }, [review.id, userId]);
  useEffect(() => { if (isOwner) load().catch((e) => { console.error(e); toast.error(pt ? "Erro ao carregar os dados da síntese" : "Failed to load synthesis data"); }); }, [load, isOwner, pt]);

  const fields = useMemo(() => fieldsFor(def, review), [def, review]);
  const ctx: Ctx | null = useMemo(() => data && ({
    locale, reviewType: def.id, fields,
    studies: data.records.map((r) => ({ id: r.id, title: r.title, authors: r.authors, year: r.year })),
    extraction: new Map(data.extractions.map((e) => [e.record_id, e.data])),
    appraisals: data.appraisals,
    searches: data.searches,
    sourceLabel: (id: string) => SOURCES.find((s) => s.id === id)?.label ?? id,
    excluded: data.excluded, themes: syn.themes ?? [], assign: syn.assign ?? {}, grade: syn.grade ?? [],
    cmo: syn.cmo ?? [], shortcuts: (review.stage_state?.rapid as { shortcuts?: string[] } | undefined)?.shortcuts ?? [],
  }), [data, locale, def.id, fields, syn.themes, syn.assign, syn.grade, syn.cmo, review.stage_state?.rapid]);

  if (!isOwner) return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "A síntese é feita pelo dono da revisão." : "Synthesis is done by the review owner."}</p>;
  if (!data || !ctx) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (data.records.length === 0) return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "Ainda não há estudos incluídos para sintetizar." : "There are no included studies to synthesise yet."}</p>;

  const findingKey = fields.find((f) => f.key === "findings" || f.key === "key_findings")?.key;
  const findings = new Map(data.records.map((r) => [r.id, (findingKey && ctx.extraction.get(r.id)?.[findingKey]) || ""]));
  const highRisk = (() => {
    const overall = data.appraisals.filter((a) => a.overall && ["high", "serious", "critical"].includes(a.overall));
    return data.appraisals.length ? new Set(overall.map((a) => a.record_id)).size : null;
  })();
  const set = (patch: Parameters<typeof withSynthesis>[1]) => onChange(withSynthesis(review, patch));

  const tabs: { key: Tab; label: string }[] = [{ key: "synthesis", label: pt ? "Síntese" : "Synthesis" }, { key: "artifacts", label: pt ? "Tabelas e figuras" : "Tables and figures" }];

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{t.label}</button>
        ))}
      </div>

      {tab === "artifacts" && <ArtifactsPanel def={def} ctx={ctx} statusRows={data.statusRows} locale={locale} />}

      {tab === "synthesis" && (def.id === "systematic" || def.id === "rapid") && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "1. Método de síntese" : "1. Synthesis method"}</h3>
            <div className="space-y-2" role="radiogroup" aria-label={pt ? "Método de síntese" : "Synthesis method"}>
              {([["meta_analysis", pt ? "Meta-análise" : "Meta-analysis", pt ? "Os estudos são homogêneos o bastante em população, intervenção e desfecho para combinar os efeitos." : "Studies are similar enough in population, intervention and outcome to pool effects."],
                 ["swim", pt ? "Síntese sem meta-análise (SWiM)" : "Synthesis without meta-analysis (SWiM)", pt ? "Os estudos são heterogêneos ou não relatam dados combináveis; a síntese é estruturada e transparente." : "Studies are heterogeneous or lack poolable data; synthesis is structured and transparent."]] as [Method, string, string][]).map(([v, l, d]) => (
                <label key={v} className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3", syn.method === v ? "border-primary bg-primary/5" : "border-border")}>
                  <input type="radio" name="method" className="mt-1" checked={syn.method === v} onChange={() => set({ method: v })} />
                  <span className="min-w-0"><span className="block text-sm font-medium">{l}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="syn-just" className="text-xs font-medium">{pt ? "Justifique a escolha (mínimo 20 caracteres)" : "Justify the choice (at least 20 characters)"}</label>
              <textarea id="syn-just" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={syn.justification ?? ""} onChange={(e) => set({ justification: e.target.value })} />
            </div>
            {syn.method === "meta_analysis" && (
              <p className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-3 text-xs">
                {pt ? "A combinação dos efeitos, o forest plot e o funnel plot são feitos no módulo de Meta-análise." : "Pooling effects, the forest plot and the funnel plot are done in the Meta-analysis module."}
                <Link to="/meta-analysis" target="_blank" className="inline-flex items-center gap-1 underline">{pt ? "Abrir Meta-análise" : "Open Meta-analysis"}<ExternalLink className="h-3 w-3" /></Link>
              </p>
            )}
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "2. Certeza da evidência (GRADE)" : "2. Certainty of evidence (GRADE)"}</h3>
            <GradeEditor entries={syn.grade ?? []} includedCount={data.records.length} highRiskCount={highRisk} locale={locale} canEdit onChange={(grade) => set({ grade })} />
          </section>
        </div>
      )}

      {tab === "synthesis" && def.id === "scoping" && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "1. Conceitos e lacunas identificados" : "1. Concepts and gaps identified"}</h3>
            <textarea aria-label={pt ? "Conceitos e lacunas" : "Concepts and gaps"} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={syn.gaps ?? ""} onChange={(e) => set({ gaps: e.target.value })}
              placeholder={pt ? "Resuma o que o mapa mostra: onde há muita evidência, onde há pouca e o que falta (mínimo 20 caracteres)." : "Summarise what the map shows: where evidence is plentiful, where it is thin, and what is missing (at least 20 characters)."} />
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "2. Mapeamento temático (opcional)" : "2. Thematic mapping (optional)"}</h3>
            <ThemeMatrix studies={ctx.studies} findings={findings} themes={syn.themes ?? []} assign={syn.assign ?? {}} locale={locale} canEdit onChange={(themes, assign) => set({ themes, assign })} />
          </section>
        </div>
      )}

      {tab === "synthesis" && (def.id === "integrative" || def.id === "qualitative") && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "1. Redução e exibição dos dados" : "1. Data reduction and display"}</h3>
            <ThemeMatrix studies={ctx.studies} findings={findings} themes={syn.themes ?? []} assign={syn.assign ?? {}} locale={locale} canEdit onChange={(themes, assign) => set({ themes, assign })} />
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "2. Comparação constante e conclusões" : "2. Constant comparison and conclusions"}</h3>
            <textarea aria-label={pt ? "Conclusões" : "Conclusions"} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={syn.conclusions ?? ""} onChange={(e) => set({ conclusions: e.target.value })}
              placeholder={pt ? "Compare os padrões entre os estudos e registre as conclusões e como foram verificadas nos dados primários." : "Compare patterns across studies and record the conclusions and how they were checked against the primary data."} />
            {flags.themes_confirmed
              ? <p className="text-sm text-primary">{pt ? "Temas e conclusões confirmados." : "Themes and conclusions confirmed."} <Button variant="link" size="sm" onClick={() => onChange(withFlags(review, { themes_confirmed: false }))}>{pt ? "Reabrir" : "Reopen"}</Button></p>
              : <Button size="sm" disabled={(syn.themes ?? []).length === 0 || (syn.conclusions ?? "").trim().length < 20} onClick={() => onChange(withFlags(review, { themes_confirmed: true }))}>{pt ? "Confirmar temas e conclusões" : "Confirm themes and conclusions"}</Button>}
          </section>
        </div>
      )}

      {tab === "synthesis" && def.id === "umbrella" && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "1. Método de síntese" : "1. Synthesis method"}</h3>
            <MethodChooser method={syn.method} justification={syn.justification ?? ""} locale={locale}
              options={[{ value: "swim", label: pt ? "Síntese estruturada (tabelas e narrativa)" : "Structured synthesis (tables and narrative)", description: pt ? "Descreve os resultados de cada revisão, sem somar efeitos entre elas." : "Describes each review's results without pooling effects between them." },
                        { value: "meta_analysis", label: pt ? "Reanálise quantitativa" : "Quantitative re-analysis", description: pt ? "Reúne estimativas das revisões; exige tratar a sobreposição para não contar o mesmo estudo duas vezes." : "Pools estimates from the reviews; requires handling overlap so the same study is not counted twice." }]}
              onChange={(p) => set(p)} />
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{pt ? "2. Sobreposição de estudos primários" : "2. Overlap of primary studies"}</h3>
            <UmbrellaPanel lists={primaryLists(ctx)} reviewed={!!flags.overlap_reviewed} locale={locale} canEdit onReviewed={(v) => onChange(withFlags(review, { overlap_reviewed: v }))} />
          </section>
        </div>
      )}

      {tab === "synthesis" && def.id === "narrative" && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">{pt ? "Organização temática" : "Thematic organisation"}</h3>
          <ThemeMatrix studies={ctx.studies} findings={findings} themes={syn.themes ?? []} assign={syn.assign ?? {}} locale={locale} canEdit onChange={(themes, assign) => set({ themes, assign })} />
        </section>
      )}

      {tab === "synthesis" && def.id === "realist" && (
        <RealistPanel programTheory={syn.programTheory ?? ""} cmo={syn.cmo ?? []} locale={locale} canEdit onChange={(p) => set(p)} />
      )}
    </div>
  );
}
