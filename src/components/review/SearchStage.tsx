import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DuplicatePanel } from "./DuplicatePanel";
import { SOURCES } from "@/lib/review/databases";
import { toRecords, parseExport } from "@/lib/review/importer";
import type { ReviewRecord } from "@/lib/review/protocol";
import { renderQuery } from "@/lib/review/query";
import { createSearch, harvest, HarvestKeyError, insertRecords, listSearches, updateSearch, type ReviewMetrics, type SearchRow } from "@/lib/review/records";
import { getFlags, getStrategy, HARVESTABLE, withFlags } from "@/lib/review/strategy";
import type { ReviewTypeDef } from "@/lib/review/types";
import { useAuth } from "@/hooks/useAuth";
import { logEvent } from "@/lib/review/api";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  locale: "pt" | "en";
  canEdit: boolean;
  metrics: ReviewMetrics | null;
  onChange: (patch: Partial<ReviewRecord>) => void;
  onDataChanged: () => void;
}

const DEFAULT_CAP = 3000;

export function SearchStage({ def, review, locale, canEdit, metrics, onChange, onDataChanged }: Props) {
  const pt = locale === "pt";
  const { user } = useAuth();
  const strategy = getStrategy(review, def);
  const approved = getFlags(review).strategy_approved === true;
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [running, setRunning] = useState<{ source: string; fetched: number; total: number | null } | null>(null);
  const [cap, setCap] = useState(DEFAULT_CAP);
  const [importing, setImporting] = useState<string | null>(null);
  const [form, setForm] = useState({ interface: "", reported: "" });
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => { setSearches(await listSearches(review.id)); onDataChanged(); }, [review.id, onDataChanged]);
  useEffect(() => { listSearches(review.id).then(setSearches).catch(console.error); }, [review.id]);

  const queryFor = (id: string) => {
    const s = SOURCES.find((x) => x.id === id)!;
    return renderQuery(strategy.blocks, s.syntax, strategy.filters).text;
  };

  // New records invalidate any duplicate check already confirmed.
  const invalidateDuplicates = () => onChange(withFlags(review, { duplicates_reviewed: false }));

  const run = async (source: string) => {
    if (!user) return;
    const query = queryFor(source);
    if (!query.trim()) { toast.error(pt ? "A string desta base está vazia." : "This database's string is empty."); return; }
    const controller = new AbortController();
    abort.current = controller;
    setRunning({ source, fetched: 0, total: null });
    let searchId: string | null = null;
    try {
      const s = await createSearch({
        review_id: review.id, source, method: "api", interface: "review-harvest", query, filters: strategy.filters as Record<string, unknown>,
        results_count: null, notes: null, created_by: user.id,
      });
      searchId = s.id;
      const r = await harvest({
        reviewId: review.id, source, query, searchId: s.id, cap, signal: controller.signal,
        toRows: (papers) => toRecords(papers.filter((p) => !strategy.filters.yearMin || !p.year || p.year >= strategy.filters.yearMin).filter((p) => !strategy.filters.yearMax || !p.year || p.year <= strategy.filters.yearMax), { reviewId: review.id, searchId: s.id, source }),
        onProgress: (p) => setRunning({ source, fetched: p.fetched, total: p.total }),
      });
      await updateSearch(s.id, { results_count: r.total, imported_count: r.fetched, notes: r.truncated ? (pt ? `Coleta interrompida em ${r.fetched} de ${r.total ?? "?"} resultados.` : `Collection stopped at ${r.fetched} of ${r.total ?? "?"} results.`) : null });
      await logEvent(review.id, user.id, "search_run", { source, fetched: r.fetched, total: r.total, truncated: r.truncated });
      invalidateDuplicates();
      toast.success(pt ? `${r.fetched} registros coletados` : `${r.fetched} records collected`);
      if (r.truncated && r.total && r.fetched < r.total) toast.warning(pt ? "Nem todos os resultados foram coletados. Refine a estratégia ou aumente o limite." : "Not all results were collected. Refine the strategy or raise the limit.");
    } catch (e) {
      console.error(e);
      if (searchId) await updateSearch(searchId, { notes: pt ? "Coleta falhou antes de terminar." : "Collection failed before finishing." }).catch(() => {});
      toast.error(e instanceof HarvestKeyError
        ? (pt ? "O OpenAlex exige uma chave de API para coletar neste volume. Configure OPENALEX_API_KEY nas funções do projeto ou importe a exportação." : "OpenAlex requires an API key at this volume. Set OPENALEX_API_KEY on the project's functions or import an export.")
        : (pt ? "Falha na coleta. O que já foi baixado foi mantido." : "Collection failed. What was already downloaded was kept."));
    } finally {
      setRunning(null);
      abort.current = null;
      await refresh();
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !importing || !user) return;
    const source = importing;
    try {
      const papers = parseExport(await file.text(), file.name);
      if (papers.length === 0) { toast.error(pt ? "Nenhum registro encontrado no arquivo. Use RIS, BibTeX ou CSV." : "No records found. Use RIS, BibTeX or CSV."); return; }
      const query = queryFor(source);
      const s = await createSearch({
        review_id: review.id, source, method: SOURCES.find((x) => x.id === source)?.access === "manual" ? "manual" : "import",
        interface: form.interface || null, query, filters: strategy.filters as Record<string, unknown>,
        results_count: form.reported ? Number(form.reported) : null, notes: file.name, created_by: user.id,
      });
      const n = await insertRecords(toRecords(papers, { reviewId: review.id, searchId: s.id, source }));
      await updateSearch(s.id, { imported_count: n });
      await logEvent(review.id, user.id, "search_imported", { source, imported: n, file: file.name });
      invalidateDuplicates();
      toast.success(pt ? `${n} registros importados` : `${n} records imported`);
      setImporting(null);
      setForm({ interface: "", reported: "" });
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(pt ? "Não foi possível importar o arquivo." : "Could not import the file.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (!approved) {
    return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "Aprove a estratégia na etapa anterior para buscar e importar." : "Approve the strategy in the previous stage to search and import."}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-medium">{pt ? "Bases selecionadas" : "Selected databases"}</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="harvest-cap" className="text-xs text-muted-foreground">{pt ? "Limite por base" : "Limit per database"}</Label>
            <Input id="harvest-cap" type="number" min={100} step={100} className="h-8 w-24" value={cap} onChange={(e) => setCap(Math.max(100, Number(e.target.value) || DEFAULT_CAP))} />
          </div>
        </div>
        <ul className="space-y-2">
          {strategy.sources.map((id) => {
            const s = SOURCES.find((x) => x.id === id)!;
            const done = searches.filter((x) => x.source === id);
            const direct = HARVESTABLE.has(id);
            const isRunning = running?.source === id;
            return (
              <li key={id} className="min-w-0 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{s.label}
                      {done.length > 0 ? <Badge variant="secondary">{done.reduce((n, x) => n + x.imported_count, 0)} {pt ? "registros" : "records"}</Badge> : <Badge variant="outline">{pt ? "Pendente" : "Pending"}</Badge>}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      {direct && !isRunning && <Button size="sm" className="gap-1.5" disabled={!!running} onClick={() => run(id)}><Play className="h-3.5 w-3.5" />{done.length ? (pt ? "Buscar de novo" : "Search again") : (pt ? "Executar busca" : "Run search")}</Button>}
                      {isRunning && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => abort.current?.abort()}><Square className="h-3.5 w-3.5" />{pt ? "Parar" : "Stop"}</Button>}
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={!!running} onClick={() => setImporting(importing === id ? null : id)}><FileUp className="h-3.5 w-3.5" />{pt ? "Importar arquivo" : "Import file"}</Button>
                    </div>
                  )}
                </div>
                {isRunning && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite"><Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {running!.fetched} {pt ? "de" : "of"} {running!.total ?? "?"}</p>
                )}
                {!direct && s.access === "integrated" && <p className="mt-2 text-xs text-muted-foreground">{pt ? "A busca direta desta base ainda não está disponível na coleta em volume; exporte e importe." : "Direct search for this database isn't available for bulk collection yet; export and import."}</p>}
                {importing === id && (
                  <div className="mt-3 grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="imp-interface" className="text-xs">{pt ? "Interface usada (ex.: Ovid, Scopus web)" : "Interface used (e.g. Ovid, Scopus web)"}</Label>
                      <Input id="imp-interface" value={form.interface} onChange={(e) => setForm({ ...form, interface: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="imp-reported" className="text-xs">{pt ? "Resultados informados pela base" : "Results reported by the database"}</Label>
                      <Input id="imp-reported" type="number" value={form.reported} onChange={(e) => setForm({ ...form, reported: e.target.value })} /></div>
                    <div className="sm:col-span-2">
                      <input ref={fileInput} type="file" accept=".ris,.bib,.csv,.txt" className="sr-only" id="imp-file" onChange={(e) => onFile(e.target.files?.[0])} />
                      <Button asChild size="sm"><label htmlFor="imp-file" className="cursor-pointer">{pt ? "Escolher arquivo (RIS, BibTeX ou CSV)" : "Choose file (RIS, BibTeX or CSV)"}</label></Button>
                      <p className="mt-2 text-xs text-muted-foreground">{pt ? "Informe quantos resultados a base mostrou: a diferença para o que for importado aparece no relatório." : "Enter how many results the database showed: any gap with what is imported shows in the report."}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {searches.some((s) => s.results_count != null && s.imported_count < s.results_count) && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
          {pt ? "Algumas buscas têm menos registros do que a base informou. Confira o registro de buscas abaixo antes de seguir." : "Some searches hold fewer records than the database reported. Check the search log below before continuing."}
        </p>
      )}

      <DuplicatePanel review={review} locale={locale} canEdit={canEdit} metrics={metrics} onChange={onChange} onDataChanged={onDataChanged} />

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{pt ? "Registro de buscas" : "Search log"}</h3>
        {searches.length === 0 ? <p className="text-sm text-muted-foreground">{pt ? "Nenhuma busca registrada." : "No searches logged."}</p> : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-muted/50 text-left"><tr>{[pt ? "Base" : "Source", pt ? "Data" : "Date", pt ? "Método" : "Method", pt ? "Informados" : "Reported", pt ? "Importados" : "Imported"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{searches.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2">{SOURCES.find((x) => x.id === s.source)?.label ?? s.source}</td>
                  <td className="px-3 py-2">{new Date(s.run_at).toLocaleString(pt ? "pt-BR" : "en-US")}</td>
                  <td className="px-3 py-2">{s.method}</td>
                  <td className="px-3 py-2">{s.results_count ?? "—"}</td>
                  <td className="px-3 py-2">{s.imported_count}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
