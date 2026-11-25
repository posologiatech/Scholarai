import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { autoText, buildFacts, verifyDraft } from "@/lib/review/facts";
import type { WritingData } from "@/lib/review/factsInput";
import type { Manuscript, SectionDef, SectionState, WritingState } from "@/lib/review/manuscript";
import { placeholders } from "@/lib/review/exportManuscript";
import type { ReviewRecord } from "@/lib/review/protocol";
import { aiDraft } from "@/lib/review/writeApi";
import { cn } from "@/lib/utils";

interface Props {
  review: ReviewRecord;
  data: WritingData;
  manuscript: Manuscript;
  state: WritingState;
  locale: "pt" | "en";
  onChange: (next: WritingState) => void;
}

export function ManuscriptPanel({ review, data, manuscript, state, locale, onChange }: Props) {
  const pt = locale === "pt";
  const [selected, setSelected] = useState(manuscript.sections[0]?.key ?? "title");
  const [busy, setBusy] = useState(false);
  const sec = manuscript.sections.find((s) => s.key === selected) ?? manuscript.sections[0];
  const st: SectionState = state.sections?.[sec.key] ?? { text: "" };
  const input = data.input;
  const validKeys = useMemo(() => new Set(input.studies.map((s) => s.key)), [input.studies]);
  const facts = useMemo(() => (sec.mode === "ai" ? buildFacts(sec.key, input) : null), [sec, input]);
  const itemKeys = manuscript.itemsBySection[sec.key] ?? [];
  const items = itemKeys.map((k) => manuscript.checklist.items.find((i) => i.key === k)!).filter(Boolean);
  // Live check: numbers must come from the facts, citations from this review's studies.
  const issues = useMemo(() => (facts && st.text ? verifyDraft(st.text, facts, validKeys) : (st.text ? verifyDraft(st.text, {}, validKeys).filter((i) => i.type === "unknown_citation") : [])), [facts, st.text, validKeys]);
  const open = placeholders(st.text);

  const setSection = (patch: Partial<SectionState>) => onChange({ ...state, sections: { ...state.sections, [sec.key]: { ...st, ...patch } } });
  const edit = (text: string) => setSection({ text, approved: false });

  const draft = async () => {
    setBusy(true);
    try {
      const r = await aiDraft({ reviewId: review.id, section: sec.key, sectionTitle: sec.title[locale], facts, studyKeys: input.studies.map((s) => s.key), items: items.map((i) => ({ key: i.key, text: i.text[locale] })) });
      onChange({ ...state, aiDrafted: [...new Set([...(state.aiDrafted ?? []), sec.key])], sections: { ...state.sections, [sec.key]: { text: r.text, approved: false, generated: true, issues: r.issues } } });
      toast.success(pt ? "Rascunho gerado. Leia e edite antes de aprovar." : "Draft generated. Read and edit before approving.");
    } catch (e) { toast.error(e instanceof Error ? e.message : (pt ? "Falha ao gerar o rascunho." : "Failed to generate the draft.")); }
    finally { setBusy(false); }
  };

  const fromData = () => setSection({ text: autoText(sec.key, input), approved: false, generated: true });
  const status = (s: SectionDef) => { const x = state.sections?.[s.key]; return x?.approved ? "approved" : x?.text?.trim() ? "draft" : "empty"; };
  const modeLabel = (m: SectionDef["mode"]) => m === "ai" ? (pt ? "IA com fatos" : "AI from facts") : m === "auto" ? (pt ? "Automática" : "Automatic") : (pt ? "Você escreve" : "You write");

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
      <ol className="max-h-[34rem] space-y-1 overflow-auto" aria-label={pt ? "Seções" : "Sections"}>
        {manuscript.sections.map((s) => {
          const stat = status(s);
          return (
            <li key={s.key}>
              <button type="button" aria-current={s.key === sec.key} onClick={() => setSelected(s.key)}
                className={cn("flex w-full min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", s.key === sec.key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}>
                <BadgeCheck className={cn("h-3.5 w-3.5 shrink-0", stat === "approved" ? "text-primary" : stat === "draft" ? "text-amber-500" : "text-muted-foreground/30")} aria-label={stat === "approved" ? (pt ? "Aprovada" : "Approved") : stat === "draft" ? (pt ? "Rascunho" : "Draft") : (pt ? "Vazia" : "Empty")} />
                <span className="min-w-0 flex-1 truncate">{s.title[locale]}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="min-w-0 space-y-4">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">{sec.title[locale]}</h3><Badge variant="outline">{modeLabel(sec.mode)}</Badge></div>
          {sec.guidance && <p className="text-xs text-muted-foreground">{sec.guidance[locale]}</p>}
          {items.length > 0 && (
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{pt ? `Itens do ${manuscript.checklist.name} que esta seção cobre (${items.length})` : `${manuscript.checklist.name} items this section covers (${items.length})`}</summary>
              <ul className="mt-1 space-y-0.5">{items.map((i) => <li key={i.key}><span className="font-medium">{i.key}</span> — {i.text[locale]}{i.optional ? (pt ? " (opcional)" : " (optional)") : ""}</li>)}</ul></details>
          )}
        </header>

        <div className="flex flex-wrap gap-2">
          {sec.mode === "ai" && <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={draft}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{st.text ? (pt ? "Gerar de novo" : "Regenerate") : (pt ? "Gerar rascunho com IA" : "Draft with AI")}</Button>}
          {sec.mode === "auto" && <Button size="sm" variant="outline" onClick={fromData}>{st.text ? (pt ? "Atualizar a partir dos dados" : "Refresh from data") : (pt ? "Gerar a partir dos dados" : "Generate from data")}</Button>}
          {sec.key === "declarations" && <Button size="sm" variant="outline" onClick={fromData}>{pt ? "Preencher declaração de IA" : "Fill in the AI statement"}</Button>}
        </div>
        {sec.mode === "ai" && <p className="text-xs text-muted-foreground">{pt ? "O rascunho usa só fatos calculados dos dados da revisão. Para citar um estudo, use [S1]; o sistema troca pela citação formatada. Números fora dos fatos são sinalizados." : "The draft uses only facts computed from the review's data. To cite a study, use [S1]; the system swaps it for the formatted citation. Numbers outside the facts are flagged."}</p>}

        <textarea aria-label={sec.title[locale]} className="min-h-64 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed" value={st.text} onChange={(e) => edit(e.target.value)}
          placeholder={sec.mode === "manual" ? (pt ? "Escreva aqui." : "Write here.") : (pt ? "Gere o texto ou escreva aqui." : "Generate the text or write here.")} />

        {issues.length > 0 && (
          <div role="alert" className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />{pt ? "Confira antes de aprovar" : "Check before approving"}</p>
            <ul className="space-y-0.5">{issues.map((i, k) => <li key={k}>{i.type === "unsupported_number" ? (pt ? `O número "${i.snippet}" não está nos dados da revisão.` : `The number "${i.snippet}" is not in the review's data.`) : (pt ? `A citação ${i.snippet} não corresponde a nenhum estudo incluído.` : `Citation ${i.snippet} matches no included study.`)}</li>)}</ul>
          </div>
        )}
        {open.length > 0 && <p className="text-xs text-muted-foreground">{pt ? "Campos a preencher: " : "To fill in: "}{open.slice(0, 4).join(" ")}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">{st.text.trim() ? `${st.text.trim().split(/\s+/).length} ${pt ? "palavras" : "words"}` : ""}</span>
          {st.approved
            ? <Button size="sm" variant="outline" onClick={() => setSection({ approved: false })}>{pt ? "Reabrir para edição" : "Reopen for editing"}</Button>
            : <Button size="sm" disabled={!st.text.trim()} onClick={() => setSection({ approved: true, issues })}>{issues.length ? (pt ? "Aprovar mesmo assim" : "Approve anyway") : (pt ? "Aprovar seção" : "Approve section")}</Button>}
        </div>
      </div>
    </div>
  );
}
