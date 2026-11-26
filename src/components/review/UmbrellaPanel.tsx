import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { overlapOf, BAND_LABEL, type ReviewPrimaryList } from "@/lib/review/overlap";

interface Props {
  lists: ReviewPrimaryList[];
  reviewed: boolean;
  locale: "pt" | "en";
  canEdit: boolean;
  onReviewed: (v: boolean) => void;
}

/** Overlap of primary studies between the included reviews, with the corrected covered area. */
export function UmbrellaPanel({ lists, reviewed, locale, canEdit, onReviewed }: Props) {
  const pt = locale === "pt";
  const o = overlapOf(lists);
  const shared = o.matrix.filter((m) => m.inReviews.length > 1);
  const label = (id: string) => lists.find((l) => l.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{pt ? "Revisões que incluem os mesmos estudos primários contam o mesmo dado duas vezes. O sistema lê a lista de estudos primários que você extraiu de cada revisão e mede a área coberta corrigida (Pieper et al., 2014)." : "Reviews that include the same primary studies count the same data twice. The system reads the list of primary studies you extracted from each review and measures the corrected covered area (Pieper et al., 2014)."}</p>

      {o.missing.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
          {pt ? `${o.missing.length} revisão(ões) sem lista de estudos primários ficaram de fora do cálculo: ${o.missing.map(label).join("; ")}. Preencha o campo de estudos primários na extração.` : `${o.missing.length} review(s) without a primary-study list were left out of the calculation: ${o.missing.map(label).join("; ")}. Fill in the primary studies field during extraction.`}</p>
      )}

      {o.reviews < 2 ? (
        <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "São necessárias ao menos duas revisões com a lista de estudos primários para medir a sobreposição." : "At least two reviews with a primary-study list are needed to measure overlap."}</p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{pt ? "Revisões" : "Reviews"}</dt><dd className="text-lg font-semibold">{o.reviews}</dd></div>
          <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{pt ? "Estudos primários distintos" : "Distinct primary studies"}</dt><dd className="text-lg font-semibold">{o.unique}</dd></div>
          <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{pt ? "Inclusões no total" : "Inclusions in total"}</dt><dd className="text-lg font-semibold">{o.inclusions}</dd></div>
          <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{pt ? "Área coberta corrigida" : "Corrected covered area"}</dt><dd className="text-lg font-semibold">{o.cca != null ? `${o.cca}%` : "—"}</dd>
            {o.band && <p className="text-xs text-muted-foreground">{BAND_LABEL[o.band][locale]}</p>}</div>
        </dl>
      )}

      {shared.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">{pt ? `Estudos em mais de uma revisão (${shared.length})` : `Studies in more than one review (${shared.length})`}</h3>
          <ul className="max-h-60 space-y-1 overflow-auto rounded-md border border-border p-2 text-xs">
            {shared.slice(0, 60).map((m) => <li key={m.key} className="break-words"><span className="font-medium">{m.inReviews.length}×</span> {m.display} <span className="text-muted-foreground">({m.inReviews.map(label).join("; ")})</span></li>)}
          </ul>
        </div>
      )}

      <div className="border-t border-border pt-3">
        {reviewed
          ? <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" aria-hidden />{pt ? "Sobreposição revisada." : "Overlap reviewed."} {canEdit && <Button variant="link" size="sm" onClick={() => onReviewed(false)}>{pt ? "Reabrir" : "Reopen"}</Button>}</p>
          : <Button size="sm" disabled={!canEdit || o.reviews < 2} onClick={() => onReviewed(true)}>{pt ? "Confirmar que revisei a sobreposição" : "Confirm I reviewed the overlap"}</Button>}
        <p className="mt-2 text-xs text-muted-foreground">{pt ? "Decida e registre na justificativa do método como a sobreposição será tratada: por exemplo, destacar a revisão mais recente e completa, ou descrever os resultados sem somá-los." : "Decide and record in the method justification how overlap will be handled: for example, favour the most recent and complete review, or describe results without pooling them."}</p>
      </div>
    </div>
  );
}
