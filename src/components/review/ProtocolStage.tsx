import { useState } from "react";
import { Lock, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { EligibilityItem, ReviewRecord } from "@/lib/review/protocol";
import { frameworkName, RAPID_SHORTCUTS, type ReviewTypeDef } from "@/lib/review/types";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  locale: "pt" | "en";
  canLock: boolean;
  onChange: (patch: Partial<ReviewRecord>) => void;
  onLock: () => Promise<void>;
}

export function ProtocolStage({ def, review, locale, canLock, onChange, onLock }: Props) {
  const pt = locale === "pt";
  const locked = !!review.protocol_locked_at;
  const [suggesting, setSuggesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [locking, setLocking] = useState(false);
  const items: EligibilityItem[] = review.eligibility ?? [];

  const setFramework = (key: string, value: string) => onChange({ framework: { ...review.framework, [key]: value } });
  const setItems = (next: EligibilityItem[]) => onChange({ eligibility: next });

  const suggest = async () => {
    if (!review.question.trim()) { toast.error(pt ? "Escreva a pergunta antes de pedir sugestões." : "Write the question before asking for suggestions."); return; }
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-screening-criteria", { body: { question: review.question } });
      if (error) throw error;
      const added: EligibilityItem[] = (data?.criteria ?? []).map((c: { name: string; description: string }) => ({ kind: "include" as const, text: `${c.name}: ${c.description}` }));
      setItems([...items, ...added]);
      toast.success(pt ? "Sugestões adicionadas. Revise e edite cada uma." : "Suggestions added. Review and edit each one.");
    } catch (e) {
      console.error(e);
      toast.error(pt ? "Não foi possível gerar sugestões." : "Could not generate suggestions.");
    } finally {
      setSuggesting(false);
    }
  };

  const lock = async () => {
    setLocking(true);
    try { await onLock(); setConfirming(false); } finally { setLocking(false); }
  };

  const questionFirst = def.id === "integrative" ? (pt ? "Pergunta norteadora" : "Guiding question") : (pt ? "Pergunta de revisão" : "Review question");

  return (
    <div className="space-y-5">
      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{pt ? `Protocolo congelado em ${new Date(review.protocol_locked_at!).toLocaleString("pt-BR")}. Mudanças no método devem ser registradas como desvio, não editadas aqui.` : `Protocol locked on ${new Date(review.protocol_locked_at!).toLocaleString("en-US")}. Method changes must be recorded as deviations, not edited here.`}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="protocol-question">{questionFirst}</Label>
        <textarea id="protocol-question" disabled={locked} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
          value={review.question} onChange={(e) => onChange({ question: e.target.value })} />
      </div>

      <fieldset className="space-y-3" disabled={locked}>
        <legend className="mb-1 text-sm font-medium">{frameworkName(def, locale)}</legend>
        {def.framework.fields.filter((f) => f.key !== "problem").map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`fw-${f.key}`}>{f.label[locale]}{f.required && <span className="text-destructive"> *</span>}</Label>
            <Input id={`fw-${f.key}`} placeholder={f.hint[locale]} value={review.framework?.[f.key] ?? ""} onChange={(e) => setFramework(f.key, e.target.value)} />
          </div>
        ))}
      </fieldset>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{pt ? "Critérios de elegibilidade" : "Eligibility criteria"}</h3>
          {!locked && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={suggest} disabled={suggesting}>
                {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {pt ? "Sugerir com IA" : "Suggest with AI"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setItems([...items, { kind: "include", text: "" }])}>
                <Plus className="h-3.5 w-3.5" />{pt ? "Adicionar" : "Add"}
              </Button>
            </div>
          )}
        </div>
        {items.length === 0 && <p className="text-sm text-muted-foreground">{pt ? "Nenhum critério ainda." : "No criteria yet."}</p>}
        {items.map((it, i) => (
          <div key={i} className="flex min-w-0 items-center gap-2">
            <select aria-label={pt ? "Tipo de critério" : "Criterion type"} disabled={locked} value={it.kind}
              onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, kind: e.target.value as EligibilityItem["kind"] } : x))}
              className="h-10 shrink-0 rounded-md border border-input bg-background px-2 text-sm">
              <option value="include">{pt ? "Incluir" : "Include"}</option>
              <option value="exclude">{pt ? "Excluir" : "Exclude"}</option>
            </select>
            <Input aria-label={pt ? "Texto do critério" : "Criterion text"} disabled={locked} className="min-w-0" value={it.text}
              onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
            {!locked && (
              <button type="button" aria-label={pt ? "Remover critério" : "Remove criterion"} onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {!locked && <p className="text-xs text-muted-foreground">{pt ? "As sugestões da IA são ponto de partida; você decide cada critério." : "AI suggestions are a starting point; you decide each criterion."}</p>}
      </div>

      {def.id === "rapid" && (
        <fieldset className="space-y-2" disabled={locked}>
          <legend className="mb-1 text-sm font-medium">{pt ? "Atalhos metodológicos (declare antes de buscar)" : "Methodological shortcuts (declare before searching)"}</legend>
          <p className="text-xs text-muted-foreground">{pt ? "Cada atalho aumenta o risco de viés e precisa constar nos métodos e nas limitações do manuscrito." : "Each shortcut raises the risk of bias and must appear in the manuscript methods and limitations."}</p>
          {RAPID_SHORTCUTS.map((sc) => {
            const chosen: string[] = (review.stage_state?.rapid as { shortcuts?: string[] } | undefined)?.shortcuts ?? [];
            const on = chosen.includes(sc.key);
            return (
              <label key={sc.key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={on} onChange={(e) => {
                const next = sc.key === "none" ? (e.target.checked ? ["none"] : []) : e.target.checked ? [...chosen.filter((k) => k !== "none"), sc.key] : chosen.filter((k) => k !== sc.key);
                onChange({ stage_state: { ...review.stage_state, rapid: { ...(review.stage_state?.rapid as object | undefined), shortcuts: next } } });
              }} /><span>{pt ? sc.pt : sc.en}</span></label>
            );
          })}
        </fieldset>
      )}

      {def.registry && (
        <div className="space-y-1.5">
          <Label htmlFor="registry-id">{pt ? `Número de registro (${def.registry.name})` : `Registration number (${def.registry.name})`}</Label>
          <Input id="registry-id" value={review.registry?.id ?? ""} onChange={(e) => onChange({ registry: { ...review.registry, id: e.target.value } })} />
          <p className="text-xs text-muted-foreground">
            {pt ? "Registre o protocolo antes de buscar. " : "Register the protocol before searching. "}
            <a className="underline" href={def.registry.url} target="_blank" rel="noreferrer">{def.registry.name}</a>
          </p>
        </div>
      )}

      {!locked && (
        <div className="border-t border-border pt-4">
          <Button onClick={() => setConfirming(true)} disabled={!canLock} className="gap-2"><Lock className="h-4 w-4" />{pt ? "Congelar protocolo" : "Lock protocol"}</Button>
          {!canLock && <p className="mt-2 text-xs text-muted-foreground">{pt ? "Complete os itens pendentes ao lado para congelar." : "Complete the pending items to lock."}</p>}
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pt ? "Congelar o protocolo?" : "Lock the protocol?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pt ? "Depois de congelado, a pergunta, o framework e os critérios não podem mais ser alterados. Isso protege a revisão contra mudanças feitas depois de ver os resultados." : "Once locked, the question, framework and criteria can no longer be changed. This protects the review against changes made after seeing results."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{pt ? "Voltar" : "Back"}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); lock(); }} disabled={locking}>{pt ? "Congelar" : "Lock"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
