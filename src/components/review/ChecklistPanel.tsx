import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleDashed, CircleDot, Loader2, MinusCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ItemStatus } from "@/lib/review/checklists";
import { sectionOfItem, type Manuscript, type WritingState } from "@/lib/review/manuscript";
import { aiAudit, loadChecklist, saveChecklist, type ChecklistRow } from "@/lib/review/writeApi";

interface Props { reviewId: string; manuscript: Manuscript; state: WritingState; locale: "pt" | "en" }

const ICON: Record<ItemStatus, typeof BadgeCheck> = { met: BadgeCheck, partial: CircleDot, missing: CircleDashed, not_applicable: MinusCircle };

export function ChecklistPanel({ reviewId, manuscript, state, locale }: Props) {
  const pt = locale === "pt";
  const { checklist, sections } = manuscript;
  const [rows, setRows] = useState<Map<string, ChecklistRow>>(new Map());
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadChecklist(reviewId, checklist.id).then((r) => setRows(new Map(r.map((x) => [x.item_key, x])))).catch(console.error); }, [reviewId, checklist.id]);

  const sectionTitle = (k: string | undefined) => sections.find((s) => s.key === k)?.title[locale] ?? "—";
  const hasText = sections.some((s) => state.sections?.[s.key]?.text?.trim());
  const status = (key: string): ItemStatus => rows.get(key)?.status ?? "missing";

  const counts = useMemo(() => {
    const required = checklist.items.filter((i) => !i.optional || status(i.key) !== "not_applicable");
    const c = { met: 0, partial: 0, missing: 0, na: 0 };
    for (const i of required) { const s = status(i.key); if (s === "met") c.met++; else if (s === "partial") c.partial++; else if (s === "not_applicable") c.na++; else c.missing++; }
    return { ...c, total: required.length - c.na };
  }, [checklist, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = async (key: string, s: ItemStatus, note?: string | null) => {
    const row: ChecklistRow = { item_key: key, status: s, location: sectionOfItem(checklist.id, key) ?? null, note: note ?? rows.get(key)?.note ?? null };
    setRows((m) => new Map(m).set(key, row));
    try { await saveChecklist(reviewId, checklist.id, [row]); } catch (e) { console.error(e); toast.error(pt ? "Não foi possível salvar." : "Could not save."); }
  };

  const audit = async () => {
    setBusy(true);
    try {
      const r = await aiAudit({ reviewId, guideline: checklist.name, items: checklist.items.map((i) => ({ key: i.key, text: i.text[locale] })),
        sections: sections.map((s) => ({ title: s.title[locale], text: state.sections?.[s.key]?.text ?? "" })).filter((s) => s.text.trim()) });
      const out: ChecklistRow[] = r.rows.map((x) => ({ item_key: x.key, status: x.status, location: sectionOfItem(checklist.id, x.key) ?? null, note: [x.note, x.quote ? `“${x.quote}”` : null].filter(Boolean).join(" ") }));
      // Items the user marked not applicable stay that way.
      const keep = out.filter((o) => rows.get(o.item_key)?.status !== "not_applicable");
      await saveChecklist(reviewId, checklist.id, keep);
      setRows((m) => { const n = new Map(m); keep.forEach((k) => n.set(k.item_key, k)); return n; });
      toast.success(pt ? "Auditoria concluída. Revise cada item." : "Audit finished. Review each item.");
      if (r.truncated) toast.info(pt ? "O manuscrito é longo: só o início foi auditado." : "The manuscript is long: only the beginning was audited.");
    } catch (e) { toast.error(e instanceof Error ? e.message : (pt ? "Falha na auditoria." : "Audit failed.")); }
    finally { setBusy(false); }
  };

  const parts = [...new Set(checklist.items.map((i) => i.part))];
  const partName: Record<string, [string, string]> = { title: ["Título", "Title"], abstract: ["Resumo", "Abstract"], introduction: ["Introdução", "Introduction"], methods: ["Métodos", "Methods"], results: ["Resultados", "Results"], discussion: ["Discussão", "Discussion"], other: ["Outras informações", "Other information"] };

  return (
    <div className="space-y-4">
      {!checklist.official && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">{pt ? "Não existe um checklist oficial para revisões integrativas. Esta lista é uma adaptação das etapas de Whittemore e Knafl com itens do PRISMA; não cite como diretriz oficial." : "There is no official checklist for integrative reviews. This list adapts Whittemore and Knafl's stages with PRISMA items; do not cite it as an official guideline."}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm"><span className="font-medium">{checklist.name}</span>: {counts.met} {pt ? "atendidos" : "met"} · {counts.partial} {pt ? "parciais" : "partial"} · {counts.missing} {pt ? "ausentes" : "missing"} {pt ? "de" : "of"} {counts.total}</p>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={busy || !hasText} onClick={audit}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{pt ? "Auditar o manuscrito com IA" : "Audit the manuscript with AI"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{pt ? "A IA só marca um item como atendido se citar um trecho que existe no manuscrito; sem trecho, ele vira parcial. Você pode mudar qualquer item. Cumprir o checklist mostra o que foi relatado e não garante a qualidade metodológica da revisão." : "AI marks an item as met only if it quotes a passage that exists in the manuscript; without one it becomes partial. You can change any item. Meeting the checklist shows what was reported; it does not guarantee the review's methodological quality."}</p>
      {!hasText && <p className="text-sm text-muted-foreground">{pt ? "Escreva ao menos uma seção para auditar." : "Write at least one section to audit."}</p>}

      {parts.map((p) => (
        <section key={p} className="space-y-1.5">
          <h3 className="text-sm font-semibold">{partName[p]?.[pt ? 0 : 1] ?? p}</h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {checklist.items.filter((i) => i.part === p).map((i) => {
              const s = status(i.key); const Icon = ICON[s]; const row = rows.get(i.key);
              return (
                <li key={i.key} className="flex flex-wrap items-start gap-3 p-3 text-xs">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s === "met" ? "text-primary" : s === "partial" ? "text-amber-500" : "text-muted-foreground"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="break-words"><span className="font-medium">{i.key}</span> {i.text[locale]}{i.optional && <Badge variant="outline" className="ml-2">{pt ? "opcional" : "optional"}</Badge>}</p>
                    <p className="mt-0.5 text-muted-foreground">{pt ? "Seção: " : "Section: "}{sectionTitle(sectionOfItem(checklist.id, i.key))}</p>
                    {row?.note && <p className="mt-0.5 break-words text-muted-foreground">{row.note}</p>}
                  </div>
                  <select aria-label={`${pt ? "Situação do item" : "Status of item"} ${i.key}`} value={s} onChange={(e) => void set(i.key, e.target.value as ItemStatus)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="met">{pt ? "Atendido" : "Met"}</option><option value="partial">{pt ? "Parcial" : "Partial"}</option><option value="missing">{pt ? "Ausente" : "Missing"}</option><option value="not_applicable">{pt ? "Não se aplica" : "Not applicable"}</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
