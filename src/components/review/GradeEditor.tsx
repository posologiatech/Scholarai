import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CERTAINTY_LABEL, CERTAINTY_SYMBOL, certaintyOf, DOMAIN_LABEL, DOWNGRADE_DOMAINS, newGradeEntry, UPGRADE_FACTORS, type GradeEntry, type Level } from "@/lib/review/grade";

interface Props {
  entries: GradeEntry[];
  includedCount: number;
  /** Studies judged at high risk of bias, to inform the first domain. */
  highRiskCount: number | null;
  locale: "pt" | "en";
  canEdit: boolean;
  onChange: (next: GradeEntry[]) => void;
}

export function GradeEditor({ entries, includedCount, highRiskCount, locale, canEdit, onChange }: Props) {
  const pt = locale === "pt";
  const update = (id: string, patch: Partial<GradeEntry>) => onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const levelLabel = (l: Level) => (l === 0 ? (pt ? "Não grave" : "Not serious") : l === 1 ? (pt ? "Grave" : "Serious") : (pt ? "Muito grave" : "Very serious"));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {pt ? "Classifique a certeza da evidência de cada desfecho importante. Ensaios randomizados começam em alta e observacionais em baixa; cada domínio rebaixa a certeza. O cálculo é automático, mas cada julgamento é seu."
            : "Rate the certainty of evidence for each important outcome. Randomised trials start high and observational studies low; each domain lowers certainty. The calculation is automatic, but every judgement is yours."}
      </p>
      {entries.map((e) => {
        const cert = certaintyOf(e);
        return (
          <fieldset key={e.id} disabled={!canEdit} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-[12rem] flex-1 space-y-1"><label htmlFor={`g-o-${e.id}`} className="text-xs font-medium">{pt ? "Desfecho" : "Outcome"}</label>
                <Input id={`g-o-${e.id}`} value={e.outcome} onChange={(ev) => update(e.id, { outcome: ev.target.value })} /></div>
              <div className="w-24 space-y-1"><label htmlFor={`g-n-${e.id}`} className="text-xs font-medium">{pt ? "Nº estudos" : "No. studies"}</label>
                <Input id={`g-n-${e.id}`} type="number" min={0} max={includedCount || undefined} value={e.studies ?? ""} onChange={(ev) => update(e.id, { studies: ev.target.value === "" ? null : Number(ev.target.value) })} /></div>
              <div className="space-y-1"><label htmlFor={`g-d-${e.id}`} className="text-xs font-medium">{pt ? "Desenho" : "Design"}</label>
                <select id={`g-d-${e.id}`} value={e.design} onChange={(ev) => update(e.id, { design: ev.target.value as GradeEntry["design"] })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="rct">{pt ? "Ensaios randomizados" : "Randomised trials"}</option><option value="observational">{pt ? "Observacionais" : "Observational"}</option></select></div>
              {canEdit && <button type="button" aria-label={pt ? "Remover desfecho" : "Remove outcome"} className="mt-6 text-muted-foreground hover:text-destructive" onClick={() => onChange(entries.filter((x) => x.id !== e.id))}><Trash2 className="h-4 w-4" /></button>}
            </div>
            <div className="space-y-1"><label htmlFor={`g-e-${e.id}`} className="text-xs font-medium">{pt ? "Efeito estimado (ex.: HR 0,78; IC95% 0,61 a 0,99)" : "Estimated effect (e.g. HR 0.78; 95% CI 0.61 to 0.99)"}</label>
              <Input id={`g-e-${e.id}`} value={e.effect} onChange={(ev) => update(e.id, { effect: ev.target.value })} /></div>

            <div className="grid gap-2 sm:grid-cols-2">
              {DOWNGRADE_DOMAINS.map((d) => (
                <div key={d} className="space-y-1">
                  <label htmlFor={`g-${d}-${e.id}`} className="text-xs font-medium">{DOMAIN_LABEL[d][locale]}</label>
                  <select id={`g-${d}-${e.id}`} value={e.downgrades[d] ?? ""} onChange={(ev) => update(e.id, { downgrades: { ...e.downgrades, [d]: ev.target.value === "" ? undefined : (Number(ev.target.value) as Level) } })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">{pt ? "Julgar…" : "Judge…"}</option>{([0, 1, 2] as Level[]).map((l) => <option key={l} value={l}>{levelLabel(l)}</option>)}
                  </select>
                  {d === "risk_of_bias" && highRiskCount != null && <p className="text-[11px] text-muted-foreground">{pt ? `${highRiskCount} de ${includedCount} estudos com alto risco de viés na sua avaliação.` : `${highRiskCount} of ${includedCount} studies at high risk of bias in your appraisal.`}</p>}
                </div>
              ))}
            </div>
            {e.design === "observational" && (
              <div className="grid gap-2 sm:grid-cols-3">
                {UPGRADE_FACTORS.map((f) => (
                  <div key={f} className="space-y-1"><label htmlFor={`g-${f}-${e.id}`} className="text-xs font-medium">{pt ? "Aumenta: " : "Upgrade: "}{DOMAIN_LABEL[f][locale]}</label>
                    <select id={`g-${f}-${e.id}`} value={e.upgrades[f] ?? 0} onChange={(ev) => update(e.id, { upgrades: { ...e.upgrades, [f]: Number(ev.target.value) as Level } })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                      <option value={0}>{pt ? "Não" : "No"}</option><option value={1}>{pt ? "Sim (+1)" : "Yes (+1)"}</option>{f === "large_effect" && <option value={2}>{pt ? "Muito grande (+2)" : "Very large (+2)"}</option>}</select></div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1"><label htmlFor={`g-c-${e.id}`} className="text-xs font-medium">{pt ? "Comentários" : "Comments"}</label>
                <Input id={`g-c-${e.id}`} value={e.notes} onChange={(ev) => update(e.id, { notes: ev.target.value })} /></div>
              {cert ? <Badge className="gap-1 text-sm" aria-live="polite">{CERTAINTY_SYMBOL[cert]} {CERTAINTY_LABEL[cert][locale]}</Badge> : <Badge variant="outline">{pt ? "Julgue os 5 domínios" : "Judge all 5 domains"}</Badge>}
            </div>
          </fieldset>
        );
      })}
      {canEdit && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onChange([...entries, newGradeEntry(`g${Date.now().toString(36)}`)])}><Plus className="h-3.5 w-3.5" />{pt ? "Adicionar desfecho" : "Add outcome"}</Button>}
    </div>
  );
}
