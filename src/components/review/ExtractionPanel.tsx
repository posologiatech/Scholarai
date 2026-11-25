import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptable, completeness, validateValue, type Data, type FieldSpec, type Proposal } from "@/lib/review/extraction";
import { aiExtract, saveExtraction, type ExtractionRow, type IncludedRecord } from "@/lib/review/extractionApi";

interface Props {
  reviewId: string;
  userId: string;
  record: IncludedRecord;
  fields: FieldSpec[];
  row: ExtractionRow | undefined;
  textVersion: number;
  locale: "pt" | "en";
  canEdit: boolean;
  onSaved: (row: ExtractionRow) => void;
}

const NR = "N/R";

export function ExtractionPanel({ reviewId, userId, record, fields, row, textVersion, locale, canEdit, onSaved }: Props) {
  const pt = locale === "pt";
  const [data, setData] = useState<Data>(row?.data ?? {});
  const [proposals, setProposals] = useState<Record<string, Proposal>>(row?.ai_proposed ?? {});
  const [status, setStatus] = useState<"draft" | "verified">(row?.status ?? "draft");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ data, proposals, status });
  latest.current = { data, proposals, status };

  useEffect(() => { setData(row?.data ?? {}); setProposals(row?.ai_proposed ?? {}); setStatus(row?.status ?? "draft"); }, [record.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (over?: Partial<{ data: Data; proposals: Record<string, Proposal>; status: "draft" | "verified" }>) => {
    const cur = { ...latest.current, ...over };
    const next: ExtractionRow = { record_id: record.id, data: cur.data, ai_proposed: cur.proposals, status: cur.status,
      evidence: Object.fromEntries(Object.entries(cur.proposals).filter(([k, p]) => p.verified && p.quote && cur.data[k] === p.value).map(([k, p]) => [k, p.quote as string])) };
    try { await saveExtraction(reviewId, userId, next); onSaved(next); }
    catch (e) { console.error(e); toast.error(pt ? "Não foi possível salvar." : "Could not save."); }
  };
  const schedule = () => { clearTimeout(timer.current); timer.current = setTimeout(() => void persist(), 700); };
  useEffect(() => () => { clearTimeout(timer.current); }, []);

  const setField = (key: string, value: string) => {
    // Editing a verified record puts it back in draft: a changed value has not been checked.
    setData((d) => ({ ...d, [key]: value })); setStatus("draft"); schedule();
  };

  const propose = async () => {
    setBusy(true);
    try {
      const r = await aiExtract({ reviewId, recordId: record.id, mode: "extract", items: fields.map((f) => ({ key: f.key, label: f.label, kind: f.kind, choices: f.choices })) });
      const next: Record<string, Proposal> = {};
      for (const p of r.proposals) next[p.key] = { value: p.value, quote: p.quote, verified: p.verified };
      setProposals(next);
      await persist({ proposals: next });
      toast.success(pt ? `${r.proposals.length} campos propostos` : `${r.proposals.length} fields proposed`);
      if (r.source === "abstract") toast.info(pt ? "A IA leu só o resumo." : "AI read the abstract only.");
    } catch (e) { toast.error(e instanceof Error ? e.message : (pt ? "Falha na IA." : "AI failed.")); }
    finally { setBusy(false); }
  };

  const accept = (key: string) => { setField(key, proposals[key].value); };
  const acceptAll = () => {
    const keys = acceptable(fields, data, proposals);
    setData((d) => ({ ...d, ...Object.fromEntries(keys.map((k) => [k, proposals[k].value])) })); setStatus("draft"); schedule();
  };

  const { filled, total } = completeness(fields, data);
  const invalid = fields.filter((f) => validateValue(f.kind, data[f.key] ?? "", f.choices));
  const canVerify = filled === total && invalid.length === 0;
  const verify = async () => { setStatus("verified"); await persist({ status: "verified" }); toast.success(pt ? "Extração verificada." : "Extraction verified."); };
  const pending = acceptable(fields, data, proposals).length;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-3 text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{pt ? "A IA propõe cada valor com a citação do texto. Só entram campos cuja citação foi encontrada no texto, e você aceita um a um." : "AI proposes each value with a quote from the text. Only fields whose quote was found in the text can be accepted in bulk, and you accept them one by one."}</span>
          <Button size="sm" variant="outline" onClick={propose} disabled={busy} className="gap-1.5">{busy && <Loader2 className="h-3 w-3 animate-spin" />}{pt ? "Propor com IA" : "Propose with AI"}</Button>
          {pending > 0 && <Button size="sm" onClick={acceptAll}>{pt ? `Aceitar ${pending} verificados` : `Accept ${pending} verified`}</Button>}
        </div>
      )}

      <ul className="space-y-3">
        {fields.map((f) => {
          const p = proposals[f.key];
          const value = data[f.key] ?? "";
          const showProposal = p && value !== p.value;
          const bad = validateValue(f.kind, value, f.choices);
          return (
            <li key={f.key} className="space-y-1.5">
              <label htmlFor={`f-${f.key}`} className="flex flex-wrap items-center gap-2 text-sm font-medium">{f.label}{f.custom && <Badge variant="outline">{pt ? "campo da equipe" : "team field"}</Badge>}</label>
              <div className="flex min-w-0 gap-2">
                {f.kind === "choice" ? (
                  <select id={`f-${f.key}`} disabled={!canEdit} value={value} onChange={(e) => setField(f.key, e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">—</option>{(f.choices ?? []).map((c) => <option key={c} value={c}>{c}</option>)}<option value={NR}>{NR}</option>
                  </select>
                ) : f.kind === "list" ? (
                  <textarea id={`f-${f.key}`} disabled={!canEdit} value={value} onChange={(e) => setField(f.key, e.target.value)} className="min-h-16 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                ) : (
                  <Input id={`f-${f.key}`} disabled={!canEdit} value={value} inputMode={f.kind === "number" ? "decimal" : undefined} onChange={(e) => setField(f.key, e.target.value)} className="min-w-0" />
                )}
                {canEdit && <Button type="button" size="sm" variant="ghost" title={pt ? "Não relatado no estudo" : "Not reported in the study"} onClick={() => setField(f.key, NR)}>{NR}</Button>}
              </div>
              {bad && <p className="text-xs text-destructive">{bad === "number" ? (pt ? "Use um número (ou N/R)." : "Use a number (or N/R).") : (pt ? "Valor fora das opções." : "Value not among the options.")}</p>}
              {showProposal && (
                <div className="space-y-1 rounded-md border border-dashed border-border p-2 text-xs">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{pt ? "IA propõe:" : "AI proposes:"}</span> <span className="break-words">{p.value}</span>
                    {p.verified ? <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" />{pt ? "citação encontrada no texto" : "quote found in text"}</Badge> : <Badge variant="outline" className="gap-1 text-destructive"><ShieldAlert className="h-3 w-3" />{pt ? "citação NÃO encontrada" : "quote NOT found"}</Badge>}</p>
                  {p.quote && <blockquote className="border-l-2 border-border pl-2 italic text-muted-foreground">“{p.quote}”</blockquote>}
                  {canEdit && <Button type="button" size="sm" variant="outline" onClick={() => accept(f.key)}>{p.verified ? (pt ? "Aceitar" : "Accept") : (pt ? "Aceitar mesmo assim" : "Accept anyway")}</Button>}
                </div>
              )}
              {!showProposal && p?.verified && p.quote && value === p.value && <p className="text-xs text-muted-foreground">{pt ? "Fonte: " : "Source: "}“{p.quote}”</p>}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{filled} / {total} {pt ? "campos preenchidos" : "fields filled"}{!canVerify && filled < total ? (pt ? " · preencha ou marque N/R para verificar" : " · fill or mark N/R to verify") : ""}</span>
        {canEdit && (status === "verified"
          ? <Badge className="gap-1"><BadgeCheck className="h-3 w-3" />{pt ? "Verificado" : "Verified"}</Badge>
          : <Button size="sm" disabled={!canVerify} onClick={verify}>{pt ? "Marcar como verificado" : "Mark as verified"}</Button>)}
      </div>
    </div>
  );
}
