import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, Construction, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GatePanel } from "@/components/review/GatePanel";
import { ProtocolStage } from "@/components/review/ProtocolStage";
import { ScopeStage } from "@/components/review/ScopeStage";
import { SearchStage } from "@/components/review/SearchStage";
import { StrategyStage } from "@/components/review/StrategyStage";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { getReview, logEvent, updateReview } from "@/lib/review/api";
import { buildProtocolDocument, type ReviewRecord } from "@/lib/review/protocol";
import { buildReviewState } from "@/lib/review/state";
import { loadMetrics, type ReviewMetrics } from "@/lib/review/records";
import { getStrategy, withFlags } from "@/lib/review/strategy";
import { currentStage, evaluateGate, getReviewType, type StageKey } from "@/lib/review/types";
import { cn } from "@/lib/utils";

/** Stages not built yet and the phase that delivers them. */
const COMING: Partial<Record<StageKey, number>> = { screening: 3, appraisal: 4, synthesis: 5, writing: 6 };

const ReviewDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLanguage();
  const lang = (locale === "pt" ? "pt" : "en") as "pt" | "en";
  const pt = lang === "pt";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [viewing, setViewing] = useState<StageKey | null>(null);
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null);
  const pending = useRef<Partial<ReviewRecord>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!id) return;
    getReview(id)
      .then(setReview)
      .catch(() => { toast.error(pt ? "Revisão não encontrada" : "Review not found"); navigate("/reviews"); })
      .finally(() => setLoading(false));
  }, [id]);

  const flush = useCallback(async () => {
    if (!id || Object.keys(pending.current).length === 0) return;
    const patch = pending.current;
    pending.current = {};
    setSaving("saving");
    try { await updateReview(id, patch); setSaving("saved"); }
    catch (e) {
      console.error(e);
      pending.current = { ...patch, ...pending.current };
      setSaving("idle");
      toast.error(pt ? "Não foi possível salvar. Suas alterações continuam na tela." : "Could not save. Your changes are still on screen.");
    }
  }, [id, pt]);

  const refreshMetrics = useCallback(() => {
    if (id) loadMetrics(id).then(setMetrics).catch((e) => console.error("metrics", e));
  }, [id]);
  useEffect(() => { refreshMetrics(); }, [refreshMetrics]);

  // Save what is still pending when leaving the page.
  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, [flush]);

  const change = (patch: Partial<ReviewRecord>) => {
    setReview((r) => (r ? { ...r, ...patch } : r));
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  const def = review ? getReviewType(review.review_type) : undefined;
  const isOwner = !!review && review.owner_id === user?.id;
  const state = useMemo(() => {
    if (!review) return null;
    const d = getReviewType(review.review_type);
    return buildReviewState(review, {
      sources_selected: d ? getStrategy(review, d).sources.length : 0,
      searches_logged: metrics?.searchedSources ?? 0,
      records: metrics?.total ?? 0,
    });
  }, [review, metrics]);

  if (loading || !review || !state) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!def) {
    return <div className="p-8 text-sm">{pt ? "Tipo de revisão ainda não disponível." : "Review type not available yet."}</div>;
  }

  const resume = currentStage(def, state);
  const active = def.stages.find((s) => s.key === (viewing ?? resume.key)) ?? resume;
  const activeIndex = def.stages.findIndex((s) => s.key === active.key);
  const resumeIndex = def.stages.findIndex((s) => s.key === resume.key);
  const gate = evaluateGate(active, state);

  const lockLabel = def.stages.find((s) => s.key === "protocol")!.gate.find((g) => g.kind === "field" && g.field === "protocol_locked_at")?.label.pt;
  const protocolGate = evaluateGate(def.stages.find((s) => s.key === "protocol")!, state);
  const canLock = protocolGate.missing.every((m) => m.pt === lockLabel) && isOwner;

  const lockProtocol = async () => {
    const lockedAt = new Date().toISOString();
    const doc = buildProtocolDocument(def, review, lockedAt);
    // Flush edits first so the locked snapshot and the stored fields are identical.
    clearTimeout(timer.current);
    await flush();
    const patch = { protocol_locked_at: lockedAt, protocol_locked_by: user!.id, protocol_document: doc };
    try {
      await updateReview(review.id, patch);
      setReview({ ...review, ...patch });
      await logEvent(review.id, user!.id, "protocol_locked", { definition_version: def.version });
      toast.success(pt ? "Protocolo congelado." : "Protocol locked.");
    } catch (e) {
      console.error(e);
      toast.error(pt ? "Não foi possível congelar o protocolo." : "Could not lock the protocol.");
      throw e;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <Link to="/reviews" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />{pt ? "Revisões" : "Reviews"}</Link>
              <h1 className="truncate font-display text-2xl font-bold text-foreground">{review.title || (pt ? "Sem título" : "Untitled")}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{def.label[lang]}</Badge>
                <span className="text-xs text-muted-foreground">{def.reportingGuideline.name}</span>
                {review.protocol_locked_at && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />{pt ? "Protocolo congelado" : "Protocol locked"}</Badge>}
              </div>
            </div>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {saving === "saving" ? (pt ? "Salvando…" : "Saving…") : saving === "saved" ? (<span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />{pt ? "Salvo" : "Saved"}</span>) : ""}
            </span>
          </div>

          {def.review.status === "pending-expert-review" && (
            <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p>{pt
                ? "As etapas e critérios deste tipo de revisão ainda aguardam validação por um especialista contra a versão vigente do guia. Confira o método antes de usá-lo em um trabalho para publicação."
                : "This review type's stages and criteria are still awaiting expert validation against the current guideline version. Check the method before using it for a publication."}</p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label={pt ? "Etapas" : "Stages"}>
              <ol className="space-y-1">
                {def.stages.map((s, i) => {
                  const done = i < resumeIndex;
                  const isActive = s.key === active.key;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        aria-current={isActive ? "step" : undefined}
                        onClick={() => setViewing(s.key)}
                        className={cn(
                          "flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isActive ? "bg-primary text-primary-foreground" : done ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80",
                        )}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">{done ? <Check className="h-3 w-3" /> : i + 1}</span>
                        <span className="min-w-0 truncate">{s.title[lang]}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <section className="min-w-0 space-y-5 rounded-xl border border-border bg-card p-5" aria-labelledby="stage-title">
              <div>
                <h2 id="stage-title" className="font-display text-lg font-semibold">{active.title[lang]}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{active.description[lang]}</p>
                <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium">{pt ? "Papel da IA: " : "AI's role: "}</span>{active.aiRole[lang]}</p>
              </div>

              {activeIndex > resumeIndex && (
                <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  {pt ? "Esta etapa ainda não pode ser concluída: termine antes " : "This stage can't be completed yet: first finish "}
                  <button className="font-medium underline" onClick={() => setViewing(resume.key)}>{resume.title[lang]}</button>.
                </p>
              )}

              {active.key === "scope" && <ScopeStage def={def} review={review} locale={lang} onChange={isOwner ? change : () => {}} />}
              {active.key === "protocol" && <ProtocolStage def={def} review={review} locale={lang} canLock={canLock} onChange={isOwner ? change : () => {}} onLock={lockProtocol} />}
              {active.key === "strategy" && (
                <StrategyStage def={def} review={review} locale={lang} canEdit={isOwner} onChange={change}
                  onReopen={() => { change(withFlags(review, { strategy_approved: false })); void logEvent(review.id, user!.id, "strategy_reopened", {}); }} />
              )}
              {active.key === "search" && (
                <SearchStage def={def} review={review} locale={lang} canEdit={isOwner} metrics={metrics} onChange={change} onDataChanged={refreshMetrics} />
              )}
              {COMING[active.key] && (
                <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <Construction className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>{pt ? `Esta etapa chega na Fase ${COMING[active.key]} do módulo. Por enquanto, o sistema já mostra o que será exigido para concluí-la.` : `This stage arrives in phase ${COMING[active.key]} of the module. For now the system shows what will be required to complete it.`}</p>
                </div>
              )}

              <GatePanel stage={active} gate={gate} locale={lang} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReviewDetail;
