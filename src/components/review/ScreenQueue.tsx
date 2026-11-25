import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Sparkles, Square, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ReviewRecord } from "@/lib/review/protocol";
import { normalize, reasonsFor, type DecisionRow, type Phase, type Vote } from "@/lib/review/screening";
import { aiScreen, loadCandidateIds, loadDecisions, loadRecords, saveVote, type ScreenRecord } from "@/lib/review/screeningApi";

interface Props {
  review: ReviewRecord;
  phase: Phase;
  userId: string;
  locale: "pt" | "en";
  closed: boolean;
  onProgress: () => void;
}

const PREFETCH = 5;

export function ScreenQueue({ review, phase, userId, locale, closed, onProgress }: Props) {
  const pt = locale === "pt";
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [mine, setMine] = useState<Map<string, DecisionRow>>(new Map());
  const [ai, setAi] = useState<Map<string, DecisionRow>>(new Map());
  const [cache, setCache] = useState<Map<string, ScreenRecord>>(new Map());
  const [prioritize, setPrioritize] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [last, setLast] = useState<{ id: string; vote: Vote } | null>(null);
  const [aiRun, setAiRun] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef(false);

  const load = useCallback(async () => {
    const [ids, decisions] = await Promise.all([loadCandidateIds(review.id, phase), loadDecisions(review.id, phase)]);
    setCandidates(ids);
    setMine(new Map(decisions.filter((d) => d.source === "human" && d.user_id === userId).map((d) => [d.record_id, d])));
    setAi(new Map(decisions.filter((d) => d.source === "ai").map((d) => [d.record_id, d])));
  }, [review.id, phase, userId]);
  useEffect(() => { setCandidates(null); load().catch((e) => { console.error(e); toast.error(pt ? "Erro ao carregar a triagem" : "Failed to load screening"); }); }, [load, pt]);

  const queue = useMemo(() => {
    const open = (candidates ?? []).filter((id) => !mine.has(id));
    if (!prioritize) return open;
    return [...open].sort((a, b) => (ai.get(b)?.ai_score ?? -1) - (ai.get(a)?.ai_score ?? -1));
  }, [candidates, mine, prioritize, ai]);

  // Keep the next few records' details loaded.
  const head = queue.slice(0, PREFETCH).join(",");
  useEffect(() => {
    const need = queue.slice(0, PREFETCH).filter((id) => !cache.has(id));
    if (need.length === 0) return;
    loadRecords(need).then((rows) => setCache((c) => { const n = new Map(c); rows.forEach((r) => n.set(r.id, r)); return n; })).catch(console.error);
  }, [head]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[0] ? cache.get(queue[0]) : undefined;
  const reasons = reasonsFor(review.review_type);
  const needsReason = phase === "full_text";

  const vote = useCallback(async (v: Vote) => {
    if (!current || saving || closed) return;
    if (phase === "full_text" && v === "exclude" && !reason) { toast.error(pt ? "Escolha o motivo da exclusão." : "Choose the exclusion reason."); return; }
    setSaving(true);
    try {
      const code = v === "exclude" && phase === "full_text" ? reason : null;
      await saveVote({ reviewId: review.id, recordId: current.id, phase, decision: v, reasonCode: code, userId, source: "human" });
      setMine((m) => new Map(m).set(current.id, { record_id: current.id, phase, decision: v, reason_code: code, source: "human", user_id: userId }));
      setLast({ id: current.id, vote: v });
      setReason("");
      onProgress();
    } catch (e) {
      console.error(e);
      toast.error(pt ? "Não foi possível salvar o voto." : "Could not save the vote.");
    } finally { setSaving(false); }
  }, [current, saving, closed, phase, reason, review.id, userId, onProgress, pt]);

  // i / m / e shortcuts, ignored while typing or choosing a reason.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "i") void vote("include");
      else if (e.key === "e") void vote("exclude");
      else if (e.key === "m" && phase === "title_abstract") void vote("maybe");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vote, phase]);

  const undo = () => {
    if (!last) return;
    setMine((m) => { const n = new Map(m); n.delete(last.id); return n; });
    setLast(null);
  };

  const runAi = async () => {
    const todo = (candidates ?? []).filter((id) => !ai.has(id));
    if (todo.length === 0) { toast.info(pt ? "A IA já avaliou todos os registros." : "AI has already assessed every record."); return; }
    stop.current = false;
    setAiRun({ done: 0, total: todo.length });
    try {
      for (let i = 0; i < todo.length && !stop.current; i += 10) {
        await aiScreen(review.id, todo.slice(i, i + 10));
        setAiRun({ done: Math.min(i + 10, todo.length), total: todo.length });
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (pt ? "Falha na IA." : "AI failed."));
    } finally { setAiRun(null); }
  };

  if (candidates === null) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (candidates.length === 0) {
    return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{phase === "title_abstract" ? (pt ? "Nenhum registro para triar. Conclua a busca e a deduplicação." : "No records to screen. Finish the search and duplicate check.") : (pt ? "Nenhum registro chegou ao texto completo ainda." : "No records have reached full text yet.")}</p>;
  }

  const total = candidates.length;
  const done = candidates.filter((id) => mine.has(id)).length;
  const lastRec = last ? cache.get(last.id) : undefined;
  const lastAi = last ? ai.get(last.id) : undefined;
  const voteLabel = (v: string) => ({ include: pt ? "incluir" : "include", exclude: pt ? "excluir" : "exclude", maybe: pt ? "talvez" : "maybe" } as Record<string, string>)[v] ?? v;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{pt ? "Seu progresso" : "Your progress"}</span><span>{done} / {total}</span></div>
        <Progress value={(done / total) * 100} aria-label={pt ? "Progresso da triagem" : "Screening progress"} />
      </div>

      {phase === "title_abstract" && !closed && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-3 text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{pt ? "A IA pode dar uma segunda opinião. A sugestão só aparece depois que você vota, para não influenciar sua decisão, e nunca conta como voto." : "AI can give a second opinion. Its suggestion shows only after you vote, so it can't sway you, and it never counts as a vote."}</span>
          {aiRun ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { stop.current = true; }}><Square className="h-3 w-3" />{aiRun.done}/{aiRun.total}</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={runAi}>{pt ? "Pedir sugestões da IA" : "Ask AI for suggestions"}</Button>
          )}
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={prioritize} onChange={(e) => setPrioritize(e.target.checked)} />{pt ? "Priorizar a fila pela IA" : "Order queue by AI"}</label>
        </div>
      )}

      {closed && <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "Esta fase está fechada. Peça ao dono para reabri-la se precisar alterar votos." : "This phase is closed. Ask the owner to reopen it to change votes."}</p>}

      {!closed && queue.length === 0 && <p className="rounded-md border border-border p-4 text-sm">{pt ? "Você votou em todos os registros desta fase." : "You have voted on every record in this phase."}</p>}

      {!closed && queue.length > 0 && !current && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

      {!closed && current && (
        <article className="space-y-3 rounded-lg border border-border p-4" aria-live="polite">
          <header className="space-y-1">
            <h3 className="break-words text-base font-semibold leading-snug">{current.title}</h3>
            <p className="break-words text-xs text-muted-foreground">
              {current.authors.slice(0, 6).join("; ")}{current.authors.length > 6 ? " et al." : ""} · {current.year ?? "s/d"}{current.journal ? ` · ${current.journal}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{current.source}</Badge>
              {(current.url || current.doi) && <a className="inline-flex items-center gap-1 underline" target="_blank" rel="noreferrer" href={current.url ?? `https://doi.org/${current.doi}`}>{pt ? "Abrir o artigo" : "Open the paper"}<ExternalLink className="h-3 w-3" /></a>}
            </div>
          </header>
          <p className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{current.abstract || (pt ? "Sem resumo disponível. Julgue pelo título e, na dúvida, escolha Talvez." : "No abstract available. Judge by the title and choose Maybe when unsure.")}</p>

          {needsReason && (
            <div className="space-y-1.5">
              <label htmlFor="exclusion-reason" className="text-xs font-medium">{pt ? "Motivo, se for excluir" : "Reason, if excluding"}</label>
              <select id="exclusion-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">{pt ? "Selecione…" : "Select…"}</option>
                {reasons.map((r) => <option key={r.code} value={r.code}>{r.label[locale]}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={() => vote("include")}>{pt ? "Incluir" : "Include"} <kbd className="ml-1 text-[10px] opacity-70">I</kbd></Button>
            {phase === "title_abstract" && <Button disabled={saving} variant="secondary" onClick={() => vote("maybe")}>{pt ? "Talvez" : "Maybe"} <kbd className="ml-1 text-[10px] opacity-70">M</kbd></Button>}
            <Button disabled={saving} variant="outline" onClick={() => vote("exclude")}>{pt ? "Excluir" : "Exclude"} <kbd className="ml-1 text-[10px] opacity-70">E</kbd></Button>
          </div>
        </article>
      )}

      {last && lastRec && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-3 text-xs">
          <span className="min-w-0 break-words">
            {pt ? "Anterior: " : "Previous: "}<span className="font-medium">{lastRec.title.slice(0, 80)}</span> — {pt ? "você: " : "you: "}{voteLabel(last.vote)}
            {lastAi && <> · <span title={lastAi.ai_score != null ? `${Math.round(lastAi.ai_score * 100)}%` : undefined}>{pt ? "IA sugeriu: " : "AI suggested: "}{voteLabel(lastAi.decision)}</span>{normalize(phase, lastAi.decision) !== normalize(phase, last.vote) && <Badge variant="outline" className="ml-1">{pt ? "diverge" : "differs"}</Badge>}</>}
          </span>
          {!closed && <Button size="sm" variant="ghost" className="gap-1" onClick={undo}><Undo2 className="h-3 w-3" />{pt ? "Mudar voto" : "Change vote"}</Button>}
        </div>
      )}
    </div>
  );
}
