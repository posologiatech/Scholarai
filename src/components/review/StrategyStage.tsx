import { useMemo } from "react";
import { Check, Copy, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accessSummary, recommendSources, SOURCES, type AccessMode, type ReviewArea } from "@/lib/review/databases";
import type { ReviewRecord } from "@/lib/review/protocol";
import { renderQuery } from "@/lib/review/query";
import { getFlags, getStrategy, withFlags, withStrategy, type Strategy } from "@/lib/review/strategy";
import type { ReviewTypeDef } from "@/lib/review/types";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  locale: "pt" | "en";
  canEdit: boolean;
  onChange: (patch: Partial<ReviewRecord>) => void;
  onReopen: () => void;
}

const ACCESS_LABEL: Record<AccessMode, { pt: string; en: string }> = {
  integrated: { pt: "Busca direta", en: "Direct search" },
  import: { pt: "Importar exportação", en: "Import export" },
  manual: { pt: "Busca manual", en: "Manual search" },
};

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function StrategyStage({ def, review, locale, canEdit, onChange, onReopen }: Props) {
  const pt = locale === "pt";
  const strategy = getStrategy(review, def);
  const approved = getFlags(review).strategy_approved === true;
  const editable = canEdit && !approved;
  const recs = useMemo(() => recommendSources(def.id, review.area as ReviewArea), [def.id, review.area]);
  const recIds = new Set(recs.map((r) => r.source.id));
  const others = SOURCES.filter((s) => !recIds.has(s.id));
  const summary = accessSummary(recs);

  const save = (next: Strategy) => onChange(withStrategy(review, next));
  const toggle = (id: string, on: boolean) => save({ ...strategy, sources: on ? [...strategy.sources, id] : strategy.sources.filter((s) => s !== id) });
  const setBlock = (i: number, patch: Partial<Strategy["blocks"][number]>) =>
    save({ ...strategy, blocks: strategy.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(pt ? "Copiado" : "Copied"); }
    catch { toast.error(pt ? "Não foi possível copiar; selecione o texto." : "Could not copy; select the text."); }
  };

  const sourceRow = (id: string, why?: string, tier?: "core" | "complementary") => {
    const s = SOURCES.find((x) => x.id === id)!;
    const checked = strategy.sources.includes(id);
    return (
      <li key={id} className="flex min-w-0 items-start gap-3 rounded-md border border-border p-3">
        <Checkbox id={`src-${id}`} checked={checked} disabled={!editable} onCheckedChange={(v) => toggle(id, v === true)} className="mt-1" />
        <div className="min-w-0 flex-1">
          <Label htmlFor={`src-${id}`} className="flex flex-wrap items-center gap-2 font-medium">
            {s.label}
            {tier === "core" && <Badge>{pt ? "Principal" : "Core"}</Badge>}
            <Badge variant="outline">{ACCESS_LABEL[s.access][locale]}</Badge>
          </Label>
          {why && <p className="mt-0.5 text-xs text-muted-foreground">{why}</p>}
          {s.access === "import" && <p className="mt-0.5 text-xs text-muted-foreground">{pt ? "Sem acesso automático: o sistema gera a string e você importa o arquivo exportado." : "No automatic access: the system builds the string and you import the exported file."}</p>}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {approved && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span className="flex items-center gap-2"><Lock className="h-4 w-4" aria-hidden />{pt ? "Estratégia aprovada. Para alterá-la, reabra; a reabertura fica registrada." : "Strategy approved. To change it, reopen; reopening is logged."}</span>
          {canEdit && <Button variant="outline" size="sm" className="gap-1.5" onClick={onReopen}><RotateCcw className="h-3.5 w-3.5" />{pt ? "Reabrir" : "Reopen"}</Button>}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">{pt ? "1. Bases de dados" : "1. Databases"}</h3>
          <p className="text-xs text-muted-foreground">
            {pt
              ? `Recomendadas para esta área e tipo de revisão: ${summary.integrated} com busca direta e ${summary.import + summary.manual} por importação.`
              : `Recommended for this area and review type: ${summary.integrated} direct, ${summary.import + summary.manual} via import.`}
          </p>
        </div>
        <ul className="space-y-2">{recs.map((r) => sourceRow(r.source.id, r.why, r.tier))}</ul>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{pt ? "Outras bases" : "Other databases"}</summary>
          <ul className="mt-2 space-y-2">{others.map((s) => sourceRow(s.id))}</ul>
        </details>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">{pt ? "2. Conceitos de busca" : "2. Search concepts"}</h3>
          <p className="text-xs text-muted-foreground">{pt ? "Um conceito por bloco. Sinônimos de um mesmo conceito se combinam com OR; os blocos se combinam com AND. Um termo por linha." : "One concept per block. Synonyms of a concept combine with OR; blocks combine with AND. One term per line."}</p>
        </div>
        {strategy.blocks.map((b, i) => (
          <div key={b.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><p className="text-sm font-medium">{b.label}</p></div>
            <div className="space-y-1.5">
              <Label htmlFor={`terms-${b.id}`} className="text-xs">{pt ? "Termos livres e sinônimos" : "Free terms and synonyms"}</Label>
              <textarea id={`terms-${b.id}`} disabled={!editable} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                defaultValue={b.terms.join("\n")} key={`${b.id}-t-${approved}`} onBlur={(e) => setBlock(i, { terms: lines(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`head-${b.id}`} className="text-xs">{pt ? "Descritores controlados (MeSH, Emtree, DeCS)" : "Controlled headings (MeSH, Emtree, DeCS)"}</Label>
              <textarea id={`head-${b.id}`} disabled={!editable} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                defaultValue={b.headings.join("\n")} key={`${b.id}-h-${approved}`} onBlur={(e) => setBlock(i, { headings: lines(e.target.value) })} />
            </div>
          </div>
        ))}
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="year-min" className="text-xs">{pt ? "Ano inicial" : "From year"}</Label>
            <Input id="year-min" type="number" disabled={!editable} defaultValue={strategy.filters.yearMin ?? ""} key={`ymin-${approved}`} onBlur={(e) => save({ ...strategy, filters: { ...strategy.filters, yearMin: e.target.value ? Number(e.target.value) : undefined } })} /></div>
          <div className="space-y-1.5"><Label htmlFor="year-max" className="text-xs">{pt ? "Ano final" : "To year"}</Label>
            <Input id="year-max" type="number" disabled={!editable} defaultValue={strategy.filters.yearMax ?? ""} key={`ymax-${approved}`} onBlur={(e) => save({ ...strategy, filters: { ...strategy.filters, yearMax: e.target.value ? Number(e.target.value) : undefined } })} /></div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">{pt ? "3. String de cada base" : "3. Each database's string"}</h3>
        {strategy.sources.length === 0 && <p className="text-sm text-muted-foreground">{pt ? "Selecione ao menos duas bases acima." : "Select at least two databases above."}</p>}
        {strategy.sources.map((id) => {
          const s = SOURCES.find((x) => x.id === id)!;
          const q = renderQuery(strategy.blocks, s.syntax, strategy.filters);
          return (
            <div key={id} className="min-w-0 rounded-md border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className="text-sm font-medium">{s.label}</span>
                <Button variant="ghost" size="sm" className="gap-1.5" disabled={!q.text} onClick={() => copy(q.text)}><Copy className="h-3.5 w-3.5" />{pt ? "Copiar" : "Copy"}</Button>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words p-3 text-xs">{q.text || (pt ? "Adicione termos para gerar a string." : "Add terms to build the string.")}</pre>
              {q.notes.length > 0 && <ul className="space-y-0.5 border-t border-border px-3 py-2 text-xs text-muted-foreground">{q.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">{pt ? "As strings são ponto de partida: cada base muda sua sintaxe com o tempo. Confira na interface antes de executar." : "Strings are a starting point: each database's syntax changes over time. Check in its interface before running."}</p>
      </section>

      {!approved && canEdit && (
        <div className="border-t border-border pt-4">
          <Button className="gap-2" disabled={strategy.sources.length < 2 || !strategy.blocks.some((b) => b.terms.length || b.headings.length)}
            onClick={() => onChange(withFlags(review, { strategy_approved: true }))}>
            <Check className="h-4 w-4" />{pt ? "Aprovar estratégia" : "Approve strategy"}
          </Button>
        </div>
      )}
    </div>
  );
}
