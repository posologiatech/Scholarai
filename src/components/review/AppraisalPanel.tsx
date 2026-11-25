import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { guessTool, isComplete, mmatCounts, starTotal, suggestOverall, TOOLS, type ToolId } from "@/lib/review/appraisal";
import { aiExtract, saveAppraisal, type AppraisalRow, type IncludedRecord } from "@/lib/review/extractionApi";

interface Props {
  reviewId: string;
  userId: string;
  record: IncludedRecord;
  allowed: ToolId[];
  rows: AppraisalRow[];
  locale: "pt" | "en";
  canEdit: boolean;
  onSaved: (row: AppraisalRow) => void;
}

type Domains = AppraisalRow["domains"];

export function AppraisalPanel({ reviewId, userId, record, allowed, rows, locale, canEdit, onSaved }: Props) {
  const pt = locale === "pt";
  const mine = rows.filter((r) => r.record_id === record.id);
  const [tool, setTool] = useState<ToolId>(mine[0]?.tool ?? guessTool(record.study_design, allowed) ?? allowed[0]);
  const existing = mine.find((r) => r.tool === tool);
  const [domains, setDomains] = useState<Domains>(existing?.domains ?? {});
  const [overall, setOverall] = useState<string | null>(existing?.overall ?? null);
  const [proposals, setProposals] = useState<Record<string, { value: string; quote: string | null; verified: boolean }>>({});
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ domains, overall, tool });
  latest.current = { domains, overall, tool };
  const spec = TOOLS[tool];
  const [mmatCat, setMmatCat] = useState(() => {
    const d = (record.study_design ?? "").toLowerCase();
    const used = Object.keys(existing?.domains ?? {}).find((k) => /^\d\./.test(k));
    return used ? used[0] : /random/.test(d) && !/non/.test(d) ? "2" : /qualitative/.test(d) ? "1" : /mixed/.test(d) ? "5" : /cohort|case|observational/.test(d) ? "3" : "4";
  });

  useEffect(() => {
    const first = rows.filter((r) => r.record_id === record.id)[0];
    const t = first?.tool ?? guessTool(record.study_design, allowed) ?? allowed[0];
    setTool(t);
    const row = rows.find((r) => r.record_id === record.id && r.tool === t);
    setDomains(row?.domains ?? {}); setOverall(row?.overall ?? null); setProposals({});
  }, [record.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async () => {
    const c = latest.current;
    const row: AppraisalRow = { record_id: record.id, tool: c.tool, domains: c.domains, overall: c.overall };
    try { await saveAppraisal(reviewId, userId, row); onSaved(row); }
    catch (e) { console.error(e); toast.error(pt ? "Não foi possível salvar." : "Could not save."); }
  };
  const schedule = () => { clearTimeout(timer.current); timer.current = setTimeout(() => void persist(), 700); };
  useEffect(() => () => { clearTimeout(timer.current); }, []);

  const flat = (d: Domains) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.judgement]));
  const setItem = (key: string, judgement: string, extra?: { quote?: string | null; verified?: boolean }) => {
    setDomains((d) => ({ ...d, [key]: { judgement, ...extra } })); schedule();
  };

  const changeTool = (t: ToolId) => {
    clearTimeout(timer.current);
    setTool(t);
    const row = rows.find((r) => r.record_id === record.id && r.tool === t);
    setDomains(row?.domains ?? {}); setOverall(row?.overall ?? null); setProposals({});
  };

  const propose = async () => {
    setBusy(true);
    try {
      const r = await aiExtract({ reviewId, recordId: record.id, mode: "appraise", toolName: spec.name,
        items: items.map((i) => ({ key: i.key, label: i.label[locale], scale: spec.scale.map((s) => s.value) })) });
      setProposals(Object.fromEntries(r.proposals.map((p) => [p.key, p])));
      toast.success(pt ? `${r.proposals.length} itens propostos` : `${r.proposals.length} items proposed`);
      if (r.source === "abstract") toast.info(pt ? "A IA leu só o resumo: a avaliação de risco de viés exige o texto completo." : "AI read the abstract only: risk-of-bias appraisal needs the full text.");
    } catch (e) { toast.error(e instanceof Error ? e.message : (pt ? "Falha na IA." : "AI failed.")); }
    finally { setBusy(false); }
  };

  const flatDomains = flat(domains);
  const suggested = suggestOverall(tool, flatDomains);
  const complete = isComplete(tool, flatDomains, overall);
  const label = (v: string) => spec.scale.find((s) => s.value === v)?.label[locale] ?? v;
  const stars = tool === "nos" ? starTotal(flatDomains) : null;
  const counts = tool === "mmat" ? mmatCounts(flatDomains) : null;
  // The MMAT has one set of five criteria per study design; show the screening questions plus the chosen set.
  const items = tool === "mmat" ? spec.items.filter((i) => i.key.startsWith("S") || i.key.startsWith(`${mmatCat}.`)) : spec.items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="appraisal-tool" className="text-sm font-medium">{pt ? "Ferramenta" : "Tool"}</label>
        <select id="appraisal-tool" value={tool} disabled={!canEdit} onChange={(e) => changeTool(e.target.value as ToolId)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {allowed.map((t) => <option key={t} value={t}>{TOOLS[t].name}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{pt ? "Escolha conforme o desenho do estudo." : "Choose according to the study design."}{record.study_design ? ` (${record.study_design})` : ""}</span>
      </div>

      {tool === "mmat" && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="mmat-cat" className="text-sm font-medium">{pt ? "Desenho do estudo" : "Study design"}</label>
          <select id="mmat-cat" value={mmatCat} disabled={!canEdit} onChange={(e) => setMmatCat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="1">{pt ? "Qualitativo" : "Qualitative"}</option><option value="2">{pt ? "Ensaio randomizado" : "Randomized trial"}</option>
            <option value="3">{pt ? "Quantitativo não randomizado" : "Non-randomized"}</option><option value="4">{pt ? "Quantitativo descritivo" : "Quantitative descriptive"}</option>
            <option value="5">{pt ? "Métodos mistos" : "Mixed methods"}</option>
          </select>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-3 text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{pt ? "A IA sugere cada julgamento com a citação do texto. A avaliação é sua." : "AI suggests each judgement with a quote from the text. The appraisal is yours."}</span>
          <Button size="sm" variant="outline" onClick={propose} disabled={busy} className="gap-1.5">{busy && <Loader2 className="h-3 w-3 animate-spin" />}{pt ? "Sugerir com IA" : "Suggest with AI"}</Button>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((it) => {
          const cur = domains[it.key]?.judgement;
          const p = proposals[it.key];
          return (
            <li key={it.key} className="space-y-1.5">
              <fieldset disabled={!canEdit}>
                <legend className="mb-1 text-sm font-medium">{it.label[locale]}</legend>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={it.label[locale]}>
                  {spec.scale.map((s) => (
                    <button key={s.value} type="button" role="radio" aria-checked={cur === s.value} onClick={() => setItem(it.key, s.value, p?.value === s.value ? { quote: p.quote, verified: p.verified } : undefined)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cur === s.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>{s.label[locale]}</button>
                  ))}
                </div>
              </fieldset>
              {p && cur !== p.value && (
                <div className="space-y-1 rounded-md border border-dashed border-border p-2 text-xs">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{pt ? "IA sugere:" : "AI suggests:"}</span>{label(p.value)}
                    {p.verified ? <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" />{pt ? "citação encontrada" : "quote found"}</Badge> : <Badge variant="outline" className="gap-1 text-destructive"><ShieldAlert className="h-3 w-3" />{pt ? "citação NÃO encontrada" : "quote NOT found"}</Badge>}</p>
                  {p.quote && <blockquote className="border-l-2 border-border pl-2 italic text-muted-foreground">“{p.quote}”</blockquote>}
                </div>
              )}
              {domains[it.key]?.quote && cur && <p className="text-xs text-muted-foreground">{pt ? "Fonte: " : "Source: "}“{domains[it.key].quote}”</p>}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 border-t border-border pt-3">
        {spec.overall === "judgement" && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{pt ? "Julgamento geral" : "Overall judgement"}</p>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={pt ? "Julgamento geral" : "Overall judgement"}>
              {spec.scale.map((s) => (
                <button key={s.value} type="button" role="radio" aria-checked={overall === s.value} disabled={!canEdit} onClick={() => { setOverall(s.value); schedule(); }}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${overall === s.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>{s.label[locale]}</button>
              ))}
              {suggested && overall !== suggested && canEdit && <Button size="sm" variant="ghost" onClick={() => { setOverall(suggested); schedule(); }}>{pt ? `Usar sugestão: ${label(suggested)}` : `Use suggestion: ${label(suggested)}`}</Button>}
            </div>
            <p className="text-xs text-muted-foreground">{pt ? "A sugestão segue o pior domínio. Vários 'algumas preocupações' podem justificar 'alto risco': a decisão final é sua." : "The suggestion follows the worst domain. Several 'some concerns' can justify 'high risk': the final call is yours."}</p>
          </div>
        )}
        {stars && <p className="text-sm">{pt ? "Pontuação: " : "Score: "}<span className="font-medium">{stars.stars} / {stars.max} ★</span></p>}
        {counts && <p className="text-sm">{pt ? "Respostas: " : "Answers: "}<span className="font-medium">{counts.yes} {pt ? "sim" : "yes"} · {counts.no} {pt ? "não" : "no"} · {counts.cant} {pt ? "não sei dizer" : "can't tell"}</span>
          <span className="block text-xs text-muted-foreground">{pt ? "O MMAT desaconselha uma nota única: relate as respostas por critério. Responda apenas as perguntas do desenho do estudo." : "The MMAT advises against a single score: report answers per criterion. Answer only the questions for the study's design."}</span></p>}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{spec.source}</p>
          {complete ? <Badge className="gap-1"><BadgeCheck className="h-3 w-3" />{pt ? "Avaliação completa" : "Appraisal complete"}</Badge> : <Badge variant="outline">{pt ? "Incompleta" : "Incomplete"}</Badge>}
        </div>
      </div>
    </div>
  );
}
