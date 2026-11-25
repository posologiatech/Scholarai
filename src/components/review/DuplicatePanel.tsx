import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { groupDuplicates, type DedupeRecord, type DuplicateGroup } from "@/lib/review/dedupe";
import type { ReviewRecord } from "@/lib/review/protocol";
import { loadActiveRecords, markDuplicates, type ReviewMetrics } from "@/lib/review/records";
import { getFlags, withFlags } from "@/lib/review/strategy";

interface Props {
  review: ReviewRecord;
  locale: "pt" | "en";
  canEdit: boolean;
  metrics: ReviewMetrics | null;
  onChange: (patch: Partial<ReviewRecord>) => void;
  onDataChanged: () => void;
}

export function DuplicatePanel({ review, locale, canEdit, metrics, onChange, onDataChanged }: Props) {
  const pt = locale === "pt";
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<DuplicateGroup[] | null>(null);
  const [titles, setTitles] = useState<Map<string, DedupeRecord>>(new Map());
  const reviewed = getFlags(review).duplicates_reviewed === true;

  const detect = async () => {
    setBusy(true);
    try {
      const records = await loadActiveRecords(review.id);
      const groups = groupDuplicates(records);
      const certain = groups.filter((g) => g.confidence === "certain");
      await markDuplicates(certain);
      setTitles(new Map(records.map((r) => [r.id, r])));
      setPending(groups.filter((g) => g.confidence === "check"));
      onDataChanged();
      toast.success(pt ? `${certain.reduce((n, g) => n + g.duplicateIds.length, 0)} duplicatas certas removidas` : `${certain.reduce((n, g) => n + g.duplicateIds.length, 0)} sure duplicates removed`);
    } catch (e) {
      console.error(e);
      toast.error(pt ? "Não foi possível verificar as duplicatas." : "Could not check duplicates.");
    } finally { setBusy(false); }
  };

  const decide = async (g: DuplicateGroup, accept: boolean) => {
    try {
      if (accept) { await markDuplicates([g]); onDataChanged(); }
      setPending((p) => (p ?? []).filter((x) => x.keepId !== g.keepId));
    } catch { toast.error(pt ? "Não foi possível salvar a decisão." : "Could not save the decision."); }
  };

  const finish = () => onChange(withFlags(review, { duplicates_reviewed: true }));
  const total = metrics?.total ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{pt ? "Duplicatas" : "Duplicates"}</h3>
        {metrics && <p className="text-xs text-muted-foreground">{pt ? `${metrics.total} identificados · ${metrics.duplicates} duplicatas removidas · ${metrics.active} para triagem` : `${metrics.total} identified · ${metrics.duplicates} duplicates removed · ${metrics.active} for screening`}</p>}
      </div>
      {canEdit && <Button size="sm" variant="outline" disabled={busy || total === 0} onClick={detect} className="gap-2">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{pt ? "Detectar duplicatas" : "Detect duplicates"}</Button>}
      <p className="text-xs text-muted-foreground">{pt ? "Mesmo DOI ou mesmo título, ano e primeiro autor são removidos automaticamente. Títulos parecidos ficam para você decidir." : "Same DOI or same title, year and first author are removed automatically. Similar titles are left for you to decide."}</p>

      {pending && pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((g) => {
            const all = [g.keepId, ...g.duplicateIds].map((id) => titles.get(id)).filter(Boolean) as DedupeRecord[];
            return (
              <li key={g.keepId} className="rounded-md border border-border p-3 text-sm">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{pt ? "Parecem o mesmo estudo?" : "Do these look like the same study?"}</p>
                <ul className="space-y-1">{all.map((r, i) => <li key={r.id} className="min-w-0 break-words text-xs">{i === 0 ? (pt ? "Manter: " : "Keep: ") : (pt ? "Duplicata: " : "Duplicate: ")}{r.title} ({r.year ?? "s/d"}){r.doi ? ` · ${r.doi}` : ""}</li>)}</ul>
                {canEdit && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => decide(g, true)}>{pt ? "Mesmo estudo, remover" : "Same study, remove"}</Button><Button size="sm" variant="outline" onClick={() => decide(g, false)}>{pt ? "São diferentes" : "They differ"}</Button></div>}
              </li>
            );
          })}
        </ul>
      )}

      {pending && pending.length === 0 && !reviewed && canEdit && (
        <Button size="sm" onClick={finish} className="gap-2"><CheckCircle2 className="h-4 w-4" />{pt ? "Concluir conferência de duplicatas" : "Finish duplicate check"}</Button>
      )}
      {reviewed && <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />{pt ? "Conferência de duplicatas concluída." : "Duplicate check finished."}</p>}
    </section>
  );
}
