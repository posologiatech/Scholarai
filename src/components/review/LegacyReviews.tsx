import { useEffect, useState } from "react";
import { ArrowRight, History, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { mapLegacy, type LegacyReview } from "@/lib/review/legacy";
import { listLegacyReviews, migrateLegacyReview } from "@/lib/review/legacyApi";

interface Props { locale: "pt" | "en"; migratedIds: Set<string> }

/** Offers each older systematic review for copying into the guided-reviews module. The original is never changed. */
export function LegacyReviews({ locale, migratedIds }: Props) {
  const pt = locale === "pt";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LegacyReview[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ id: string; list: string[] } | null>(null);

  useEffect(() => { listLegacyReviews().then(setRows).catch((e) => { console.error(e); setRows([]); }); }, []);
  const pending = (rows ?? []).filter((r) => !migratedIds.has(r.id) && (r.papers?.length ?? 0) + (r.research_question ? 1 : 0) > 0);
  if (!rows || pending.length === 0) return null;

  const migrate = async (l: LegacyReview) => {
    if (!user) return;
    setBusy(l.id);
    try {
      const r = await migrateLegacyReview(l, user.id, locale);
      toast.success(pt ? `Migrada: ${r.records} registros.` : `Migrated: ${r.records} records.`);
      if (r.warnings.length) setWarnings({ id: r.reviewId, list: r.warnings }); else navigate(`/reviews/${r.reviewId}`);
    } catch (e) {
      console.error(e);
      toast.error(pt ? "Não foi possível migrar. Nada foi criado; tente de novo." : "Could not migrate. Nothing was created; try again.");
    } finally { setBusy(null); }
  };

  if (warnings) {
    return (
      <section className="space-y-3 rounded-xl border border-border bg-card p-5" aria-label={pt ? "Resultado da migração" : "Migration result"}>
        <h2 className="text-sm font-semibold">{pt ? "Migração concluída, com ressalvas" : "Migration finished, with caveats"}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{warnings.list.map((w, i) => <li key={i}>{w}</li>)}</ul>
        <Button size="sm" className="gap-1.5" onClick={() => navigate(`/reviews/${warnings.id}`)}>{pt ? "Abrir a revisão" : "Open the review"}<ArrowRight className="h-3.5 w-3.5" /></Button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-dashed border-border p-5" aria-label={pt ? "Revisões sistemáticas anteriores" : "Earlier systematic reviews"}>
      <div className="flex items-start gap-2"><History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div><h2 className="text-sm font-semibold">{pt ? "Revisões sistemáticas anteriores" : "Earlier systematic reviews"}</h2>
          <p className="text-xs text-muted-foreground">{pt ? "Copie uma revisão feita no formato antigo para o módulo guiado. A original continua como está. O que o formato antigo não guardava (votos por revisor, motivo de cada exclusão) não é inventado e é listado ao final." : "Copy a review made in the old format into the guided module. The original stays as it is. What the old format did not store (votes per reviewer, reason for each exclusion) is not invented and is listed at the end."}</p></div></div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {pending.map((l) => {
          const plan = mapLegacy(l);
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{l.research_question}</p>
                <p className="text-xs text-muted-foreground">{plan.records.length} {pt ? "registros" : "records"} · {plan.records.filter((r) => r.screen_status === "included").length} {pt ? "incluídos" : "included"} · {new Date(l.created_at).toLocaleDateString(pt ? "pt-BR" : "en-US")}</p></div>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => migrate(l)} className="gap-1.5">{busy === l.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{pt ? "Migrar para revisões guiadas" : "Migrate to guided reviews"}</Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
