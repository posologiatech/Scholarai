import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PrismaFlowDiagram from "@/components/app/systematic-review/PrismaFlowDiagram";
import { logEvent } from "@/lib/review/api";
import type { ReviewRecord } from "@/lib/review/protocol";
import { agreement, prismaCounts, reasonsFor, reconcileAll, summarizePhase, type Phase } from "@/lib/review/screening";
import { applyOutcomes, loadCandidateIds, loadDecisions, loadStatusRows, revertPhase } from "@/lib/review/screeningApi";
import { getFlags, withFlags } from "@/lib/review/strategy";

export interface ScreeningState { ta_closed_at?: string; ft_closed_at?: string }
export const getScreening = (r: ReviewRecord): ScreeningState => (r.stage_state?.screening as ScreeningState | undefined) ?? {};

interface Props {
  review: ReviewRecord;
  userId: string;
  reviewerIds: string[];
  names: Map<string, string>;
  hasPilotGate: boolean;
  dual: "required" | "recommended" | "optional";
  locale: "pt" | "en";
  refreshKey: number;
  onChange: (patch: Partial<ReviewRecord>) => void;
  onDataChanged: () => void;
}

export function ScreeningSummary({ review, userId, reviewerIds, names, hasPilotGate, dual, locale, refreshKey, onChange, onDataChanged }: Props) {
  const pt = locale === "pt";
  const state = getScreening(review);
  const [busy, setBusy] = useState<Phase | null>(null);
  const [data, setData] = useState<{ summary: Record<Phase, ReturnType<typeof summarizePhase>>; kappa: Record<Phase, { kappa: number | null; compared: number }>; progress: Record<string, number>; counts: ReturnType<typeof prismaCounts> } | null>(null);

  const load = useCallback(async () => {
    const phases: Phase[] = ["title_abstract", "full_text"];
    const entries = await Promise.all(phases.map(async (p) => {
      const [ids, decisions] = await Promise.all([loadCandidateIds(review.id, p), loadDecisions(review.id, p)]);
      return { p, ids, decisions };
    }));
    const summary = {} as Record<Phase, ReturnType<typeof summarizePhase>>;
    const kappa = {} as Record<Phase, { kappa: number | null; compared: number }>;
    const progress: Record<string, number> = {};
    for (const { p, ids, decisions } of entries) {
      summary[p] = summarizePhase(reconcileAll(ids, decisions, p, reviewerIds));
      kappa[p] = agreement(decisions, p, reviewerIds);
      if (p === "title_abstract") for (const d of decisions) if (d.source === "human" && d.user_id) progress[d.user_id] = (progress[d.user_id] ?? 0) + 1;
    }
    setData({ summary, kappa, progress, counts: prismaCounts(await loadStatusRows(review.id)) });
  }, [review.id, reviewerIds]);
  useEffect(() => { load().catch((e) => console.error(e)); }, [load, refreshKey, state.ta_closed_at, state.ft_closed_at]);

  const setScreening = (next: ScreeningState) => onChange({ stage_state: { ...review.stage_state, screening: next } });

  const close = async (phase: Phase) => {
    setBusy(phase);
    try {
      const [ids, decisions] = await Promise.all([loadCandidateIds(review.id, phase), loadDecisions(review.id, phase)]);
      const rec = reconcileAll(ids, decisions, phase, reviewerIds);
      if (!summarizePhase(rec).closable) { toast.error(pt ? "Ainda há registros sem decisão ou em desacordo." : "Some records are undecided or in disagreement."); return; }
      await applyOutcomes(phase, rec);
      const now = new Date().toISOString();
      setScreening(phase === "title_abstract" ? { ...state, ta_closed_at: now } : { ...state, ft_closed_at: now });
      await logEvent(review.id, userId, `screening_${phase}_closed`, { reviewers: reviewerIds.length });
      onDataChanged();
      toast.success(pt ? "Fase fechada." : "Phase closed.");
    } catch (e) { console.error(e); toast.error(pt ? "Não foi possível fechar a fase." : "Could not close the phase."); }
    finally { setBusy(null); }
  };

  const reopen = async (phase: Phase) => {
    setBusy(phase);
    try {
      await revertPhase(review.id, phase);
      setScreening(phase === "title_abstract" ? {} : { ...state, ft_closed_at: undefined });
      await logEvent(review.id, userId, `screening_${phase}_reopened`, {});
      onDataChanged();
    } catch (e) { console.error(e); toast.error(pt ? "Não foi possível reabrir." : "Could not reopen."); }
    finally { setBusy(null); }
  };

  const newRound = async () => {
    setBusy("title_abstract");
    try {
      const cycles = ((review.stage_state?.living as { cycles?: string[] } | undefined)?.cycles) ?? [];
      onChange({ stage_state: { ...review.stage_state, screening: {}, living: { cycles: [...cycles, new Date().toISOString()] }, flags: { ...getFlags(review), duplicates_reviewed: false } } });
      await logEvent(review.id, userId, "living_round_started", { round: cycles.length + 1 });
      onDataChanged();
    } finally { setBusy(null); }
  };

  const reasonLabels = useMemo(() => Object.fromEntries(reasonsFor(review.review_type).map((r) => [r.code, r.label[locale]])), [review.review_type, locale]);
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const c = data.counts;
  const solo = reviewerIds.length < 2;

  const phaseBlock = (phase: Phase, closedAt: string | undefined, enabled: boolean) => {
    const s = data.summary[phase];
    const k = data.kappa[phase];
    return (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{phase === "title_abstract" ? (pt ? "Título e resumo" : "Title and abstract") : (pt ? "Texto completo" : "Full text")}</h3>
          {closedAt && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{pt ? "Fechada" : "Closed"} {new Date(closedAt).toLocaleDateString(pt ? "pt-BR" : "en-US")}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          {pt ? `${s.total} registros · ${s.advance} avançam · ${s.exclude} excluídos · ${s.conflicts} em desacordo · ${s.pending} sem decisão completa`
              : `${s.total} records · ${s.advance} advance · ${s.exclude} excluded · ${s.conflicts} in disagreement · ${s.pending} not fully decided`}
        </p>
        {k.kappa != null && <p className="text-xs">{pt ? "Concordância entre revisores (kappa de Cohen): " : "Inter-reviewer agreement (Cohen's kappa): "}<span className="font-medium">{k.kappa.toFixed(2)}</span> ({k.compared} {pt ? "registros comparados" : "records compared"})</p>}
        {!closedAt ? (
          <Button size="sm" disabled={!enabled || !s.closable || busy !== null} onClick={() => close(phase)} className="gap-2">{busy === phase && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{pt ? "Fechar fase" : "Close phase"}</Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => reopen(phase)} className="gap-2"><RotateCcw className="h-3.5 w-3.5" />{pt ? "Reabrir fase" : "Reopen phase"}</Button>
        )}
        {!closedAt && !s.closable && enabled && <p className="text-xs text-muted-foreground">{pt ? "Para fechar: todos os revisores votaram e não há desacordos em aberto." : "To close: every reviewer has voted and no disagreement is open."}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {solo && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">{dual === "required" ? (pt ? "Este tipo de revisão exige dois revisores: adicione um na aba Equipe." : "This review type requires two reviewers: add one in the Team tab.") : (pt ? "Triagem com um só revisor. Isso fica registrado e deve constar nos métodos." : "Single-reviewer screening. This is recorded and should be reported in the methods.")}</p>}

      {hasPilotGate && (
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={getFlags(review).pilot_done === true} onChange={(e) => onChange(withFlags(review, { pilot_done: e.target.checked }))} />
          <span>{pt ? "Fiz o piloto de calibração: os revisores triaram juntos uma amostra e ajustaram os critérios." : "I ran the calibration pilot: reviewers screened a sample together and adjusted the criteria."}</span></label>
      )}

      {review.is_living && state.ta_closed_at && (
        <div className="space-y-1 rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{pt ? "Revisão viva" : "Living review"}{((review.stage_state?.living as { cycles?: string[] } | undefined)?.cycles ?? []).length > 0 ? ` · ${(review.stage_state?.living as { cycles: string[] }).cycles.length} ${pt ? "rodada(s) de atualização" : "update round(s)"}` : ""}</p>
          <p className="text-xs text-muted-foreground">{pt ? "Para atualizar: inicie uma rodada, repita as buscas na etapa Busca (as duplicatas de estudos já triados são descartadas, nunca o contrário), confira as duplicatas e triagem só os registros novos. As decisões anteriores são mantidas." : "To update: start a round, repeat the searches in the Search stage (duplicates of studies already screened are discarded, never the other way round), check duplicates and screen only the new records. Earlier decisions are kept."}</p>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={newRound}>{pt ? "Iniciar nova rodada de atualização" : "Start a new update round"}</Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {phaseBlock("title_abstract", state.ta_closed_at, true)}
        {phaseBlock("full_text", state.ft_closed_at, !!state.ta_closed_at)}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{pt ? "Progresso por revisor (título e resumo)" : "Progress by reviewer (title and abstract)"}</h3>
        <ul className="text-xs">{reviewerIds.map((id) => <li key={id}>{names.get(id) ?? "—"}: {data.progress[id] ?? 0} / {data.summary.title_abstract.total}</li>)}</ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{pt ? "Fluxograma" : "Flow diagram"}</h3>
        <PrismaFlowDiagram identified={c.identified} duplicatesRemoved={c.duplicatesRemoved} screened={c.screened} excludedScreening={c.excludedScreening}
          includedFullText={c.includedFullText} excludedFullText={c.excludedFullText} finalIncluded={c.finalIncluded}
          excludedReasons={Object.fromEntries(Object.entries(c.excludedReasons).map(([k, v]) => [reasonLabels[k] ?? k, v]))} />
        <p className="text-xs text-muted-foreground">{pt ? "Os números vêm do estado de cada registro, então o fluxograma não pode divergir dos dados." : "Numbers come from each record's stored state, so the diagram cannot disagree with the data."}</p>
      </div>
    </div>
  );
}
