import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ReviewRecord } from "@/lib/review/protocol";
import { reasonsFor, reconcileAll, type DecisionRow, type Phase, type Vote } from "@/lib/review/screening";
import { loadCandidateIds, loadDecisions, loadRecords, saveVote, type ScreenRecord } from "@/lib/review/screeningApi";

interface Props {
  review: ReviewRecord;
  phase: Phase;
  userId: string;
  reviewerIds: string[];
  names: Map<string, string>;
  locale: "pt" | "en";
  closed: boolean;
  onChanged: () => void;
}

/** Disagreements between reviewers, settled by the adjudicator. Only adjudicators can read the votes this needs. */
export function ScreeningConflicts({ review, phase, userId, reviewerIds, names, locale, closed, onChanged }: Props) {
  const pt = locale === "pt";
  const [rows, setRows] = useState<{ record: ScreenRecord; votes: DecisionRow[] }[] | null>(null);
  const [reasonFor, setReasonFor] = useState<Record<string, string>>({});
  const reasons = reasonsFor(review.review_type);

  const load = useCallback(async () => {
    const [ids, decisions] = await Promise.all([loadCandidateIds(review.id, phase), loadDecisions(review.id, phase)]);
    const rec = reconcileAll(ids, decisions, phase, reviewerIds);
    const conflictIds = ids.filter((id) => rec.get(id)?.status === "conflict");
    const records = await loadRecords(conflictIds.slice(0, 50));
    setRows(records.map((record) => ({ record, votes: decisions.filter((d) => d.record_id === record.id && d.source === "human") })));
  }, [review.id, phase, reviewerIds]);
  useEffect(() => { load().catch((e) => { console.error(e); setRows([]); }); }, [load]);

  const settle = async (recordId: string, decision: Vote) => {
    if (phase === "full_text" && decision === "exclude" && !reasonFor[recordId]) { toast.error(pt ? "Escolha o motivo da exclusão." : "Choose the exclusion reason."); return; }
    try {
      await saveVote({ reviewId: review.id, recordId, phase, decision, reasonCode: decision === "exclude" && phase === "full_text" ? reasonFor[recordId] : null, userId, source: "adjudication" });
      setRows((r) => (r ?? []).filter((x) => x.record.id !== recordId));
      onChanged();
    } catch (e) { console.error(e); toast.error(pt ? "Não foi possível salvar a decisão." : "Could not save the decision."); }
  };

  const label = (v: string) => ({ include: pt ? "Incluir" : "Include", exclude: pt ? "Excluir" : "Exclude", maybe: pt ? "Talvez" : "Maybe" } as Record<string, string>)[v] ?? v;

  if (rows === null) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "Nenhum desacordo em aberto nesta fase." : "No open disagreements in this phase."}</p>;

  return (
    <ul className="space-y-3">
      {rows.map(({ record, votes }) => (
        <li key={record.id} className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="break-words text-sm font-semibold">{record.title}</h3>
          <p className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{record.abstract || (pt ? "Sem resumo." : "No abstract.")}</p>
          <ul className="space-y-0.5 text-xs">
            {votes.map((v) => <li key={v.user_id ?? v.decision}><span className="font-medium">{names.get(v.user_id ?? "") ?? "—"}:</span> {label(v.decision)}{v.reason_code ? ` (${reasons.find((r) => r.code === v.reason_code)?.label[locale] ?? v.reason_code})` : ""}</li>)}
          </ul>
          {!closed && (
            <div className="flex flex-wrap items-center gap-2">
              {phase === "full_text" && (
                <select aria-label={pt ? "Motivo" : "Reason"} className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={reasonFor[record.id] ?? ""} onChange={(e) => setReasonFor({ ...reasonFor, [record.id]: e.target.value })}>
                  <option value="">{pt ? "Motivo, se excluir…" : "Reason, if excluding…"}</option>
                  {reasons.map((r) => <option key={r.code} value={r.code}>{r.label[locale]}</option>)}
                </select>
              )}
              <Button size="sm" onClick={() => settle(record.id, "include")}>{pt ? "Decidir: incluir" : "Decide: include"}</Button>
              <Button size="sm" variant="outline" onClick={() => settle(record.id, "exclude")}>{pt ? "Decidir: excluir" : "Decide: exclude"}</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
