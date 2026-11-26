import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Cmo } from "@/lib/review/synthesis";

interface Props {
  programTheory: string;
  cmo: Cmo[];
  locale: "pt" | "en";
  canEdit: boolean;
  onChange: (patch: { programTheory?: string; cmo?: Cmo[] }) => void;
}

export function RealistPanel({ programTheory, cmo, locale, canEdit, onChange }: Props) {
  const pt = locale === "pt";
  const update = (id: string, patch: Partial<Cmo>) => onChange({ cmo: cmo.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">{pt ? "1. Teoria do programa refinada" : "1. Refined program theory"}</h3>
        <textarea aria-label={pt ? "Teoria do programa" : "Program theory"} disabled={!canEdit} className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={programTheory} onChange={(e) => onChange({ programTheory: e.target.value })}
          placeholder={pt ? "Explique o que funciona, para quem, em quais circunstâncias e por quê, e como a teoria inicial mudou ao longo da revisão (mínimo 40 caracteres)." : "Explain what works, for whom, in what circumstances and why, and how the initial theory changed during the review (at least 40 characters)."} />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium">{pt ? "2. Configurações contexto-mecanismo-resultado" : "2. Context-mechanism-outcome configurations"}</h3>
        {cmo.length === 0 && <p className="text-sm text-muted-foreground">{pt ? "Nenhuma configuração ainda. Uma configuração diz: neste contexto, este mecanismo gera este resultado." : "No configurations yet. A configuration says: in this context, this mechanism generates this outcome."}</p>}
        {cmo.map((c, i) => (
          <fieldset key={c.id} disabled={!canEdit} className="space-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">{pt ? `Configuração ${i + 1}` : `Configuration ${i + 1}`}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {([["context", pt ? "Contexto" : "Context"], ["mechanism", pt ? "Mecanismo" : "Mechanism"], ["outcome", pt ? "Resultado" : "Outcome"]] as const).map(([k, l]) => (
                <div key={k} className="space-y-1"><label htmlFor={`cmo-${k}-${c.id}`} className="text-xs font-medium">{l}</label>
                  <textarea id={`cmo-${k}-${c.id}`} className="min-h-16 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={c[k]} onChange={(e) => update(c.id, { [k]: e.target.value })} /></div>
              ))}
            </div>
            <div className="flex gap-2"><div className="min-w-0 flex-1 space-y-1"><label htmlFor={`cmo-ev-${c.id}`} className="text-xs font-medium">{pt ? "Documentos que sustentam (ex.: S1, S4)" : "Supporting documents (e.g. S1, S4)"}</label>
              <Input id={`cmo-ev-${c.id}`} value={c.evidence} onChange={(e) => update(c.id, { evidence: e.target.value })} /></div>
              {canEdit && <button type="button" aria-label={pt ? "Remover configuração" : "Remove configuration"} className="mt-6 text-muted-foreground hover:text-destructive" onClick={() => onChange({ cmo: cmo.filter((x) => x.id !== c.id) })}><Trash2 className="h-4 w-4" /></button>}</div>
          </fieldset>
        ))}
        {canEdit && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onChange({ cmo: [...cmo, { id: `c${Date.now().toString(36)}`, context: "", mechanism: "", outcome: "", evidence: "" }] })}><Plus className="h-3.5 w-3.5" />{pt ? "Adicionar configuração" : "Add configuration"}</Button>}
      </section>
    </div>
  );
}
