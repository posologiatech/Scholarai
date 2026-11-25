import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Download, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppraisalPanel } from "./AppraisalPanel";
import { ExtractionPanel } from "./ExtractionPanel";
import { RecordSourcePanel } from "./RecordSourcePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isComplete, isImplemented, type ToolId } from "@/lib/review/appraisal";
import { fieldsFor, getCustomFields, slugKey, type CustomField } from "@/lib/review/extraction";
import { loadIncluded, loadMyAppraisals, loadMyExtractions, type AppraisalRow, type ExtractionRow, type IncludedRecord } from "@/lib/review/extractionApi";
import type { ReviewRecord } from "@/lib/review/protocol";
import type { ReviewTypeDef } from "@/lib/review/types";
import { cn } from "@/lib/utils";

type Tab = "extraction" | "appraisal" | "summary";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  userId: string;
  locale: "pt" | "en";
  onChange: (patch: Partial<ReviewRecord>) => void;
  onDataChanged: () => void;
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function ExtractionStage({ def, review, userId, locale, onChange, onDataChanged }: Props) {
  const pt = locale === "pt";
  const isOwner = review.owner_id === userId;
  const [records, setRecords] = useState<IncludedRecord[] | null>(null);
  const [extractions, setExtractions] = useState<Map<string, ExtractionRow>>(new Map());
  const [appraisals, setAppraisals] = useState<AppraisalRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("extraction");
  const [textVersion, setTextVersion] = useState(0);
  const [newField, setNewField] = useState("");

  const allowed = useMemo(() => def.appraisal.tools.map((t) => t.id).filter(isImplemented) as ToolId[], [def]);
  const fields = useMemo(() => fieldsFor(def, review), [def, review]);

  const load = useCallback(async () => {
    const [recs, ex, ap] = await Promise.all([loadIncluded(review.id), loadMyExtractions(review.id, userId), loadMyAppraisals(review.id, userId)]);
    setRecords(recs); setExtractions(new Map(ex.map((e) => [e.record_id, e]))); setAppraisals(ap);
    setSelected((s) => s ?? recs[0]?.id ?? null);
  }, [review.id, userId]);
  useEffect(() => { load().catch((e) => { console.error(e); setRecords([]); toast.error(pt ? "Erro ao carregar os estudos incluídos" : "Failed to load included studies"); }); }, [load, pt]);

  const current = records?.find((r) => r.id === selected) ?? null;
  const isAppraisalDone = (id: string) => appraisals.some((a) => a.record_id === id && isComplete(a.tool, Object.fromEntries(Object.entries(a.domains).map(([k, v]) => [k, v.judgement])), a.overall));

  const addField = () => {
    const label = newField.trim();
    if (!label) return;
    const taken = new Set(fields.map((f) => f.key));
    const next: CustomField[] = [...getCustomFields(review), { key: slugKey(label, taken), label, kind: "text" }];
    onChange({ stage_state: { ...review.stage_state, extraction: { ...(review.stage_state?.extraction as object | undefined), fields: next } } });
    setNewField("");
  };

  const exportCsv = () => {
    if (!records) return;
    const head = [pt ? "Estudo" : "Study", ...fields.map((f) => f.label)];
    const rows = records.map((r) => [`${r.authors[0]?.split(",")[0] ?? ""} ${r.year ?? ""}`.trim() || r.title, ...fields.map((f) => extractions.get(r.id)?.data[f.key] ?? "")]);
    const blob = new Blob(["﻿" + [head, ...rows].map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "extracao.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  if (records === null) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!review.protocol_locked_at || records.length === 0) {
    return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "Ainda não há estudos incluídos. Feche a fase de texto completo na triagem para liberar a extração." : "There are no included studies yet. Close the full-text phase in screening to unlock extraction."}</p>;
  }

  const verified = records.filter((r) => extractions.get(r.id)?.status === "verified").length;
  const appraised = records.filter((r) => isAppraisalDone(r.id)).length;
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "extraction", label: pt ? "Extração" : "Extraction", show: true },
    { key: "appraisal", label: pt ? "Avaliação crítica" : "Critical appraisal", show: allowed.length > 0 },
    { key: "summary", label: pt ? "Resumo" : "Summary", show: true },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{t.label}</button>
        ))}
      </div>

      {tab !== "summary" && (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <ul className="max-h-[32rem] space-y-1 overflow-auto" aria-label={pt ? "Estudos incluídos" : "Included studies"}>
            {records.map((r) => {
              const done = tab === "extraction" ? extractions.get(r.id)?.status === "verified" : isAppraisalDone(r.id);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelected(r.id)} aria-current={r.id === selected}
                    className={cn("flex w-full min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", r.id === selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}>
                    <BadgeCheck className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", done ? "text-primary" : "text-muted-foreground/30")} aria-label={done ? (pt ? "Concluído" : "Done") : (pt ? "Pendente" : "Pending")} />
                    <span className="min-w-0 break-words"><span className="font-medium">{r.authors[0]?.split(",")[0] ?? "—"} {r.year ?? ""}</span><br /><span className="text-muted-foreground">{r.title.slice(0, 70)}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>

          {current && (
            <div className="min-w-0 space-y-4">
              <h3 className="break-words text-sm font-semibold">{current.title}</h3>
              <RecordSourcePanel record={current} locale={locale} canEdit onTextChanged={() => setTextVersion((v) => v + 1)} />
              {tab === "extraction" && (
                <>
                  <ExtractionPanel key={`${current.id}-${fields.length}`} reviewId={review.id} userId={userId} record={current} fields={fields} row={extractions.get(current.id)} textVersion={textVersion} locale={locale} canEdit
                    onSaved={(row) => { setExtractions((m) => new Map(m).set(current.id, row)); onDataChanged(); }} />
                  {isOwner && (
                    <div className="flex gap-2 border-t border-border pt-3">
                      <Input aria-label={pt ? "Novo campo" : "New field"} placeholder={pt ? "Novo campo de extração (ex.: Dose)" : "New extraction field (e.g. Dose)"} value={newField} onChange={(e) => setNewField(e.target.value)} className="min-w-0" />
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addField}><Plus className="h-3.5 w-3.5" />{pt ? "Adicionar campo" : "Add field"}</Button>
                    </div>
                  )}
                </>
              )}
              {tab === "appraisal" && (
                <AppraisalPanel key={current.id} reviewId={review.id} userId={userId} record={current} allowed={allowed} rows={appraisals} locale={locale} canEdit
                  onSaved={(row) => { setAppraisals((prev) => [...prev.filter((a) => !(a.record_id === row.record_id && a.tool === row.tool)), row]); onDataChanged(); }} />
              )}
            </div>
          )}
        </div>
      )}

      {tab === "summary" && (
        <div className="space-y-3">
          <ul className="space-y-1 text-sm">
            <li>{pt ? "Extração verificada: " : "Extraction verified: "}<span className="font-medium">{verified} / {records.length}</span></li>
            {allowed.length > 0 && <li>{pt ? "Avaliação crítica completa: " : "Appraisal complete: "}<span className="font-medium">{appraised} / {records.length}</span>{!def.appraisal.required ? (pt ? " (opcional neste tipo de revisão)" : " (optional for this review type)") : ""}</li>}
          </ul>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}><Download className="h-3.5 w-3.5" />{pt ? "Exportar tabela de extração (CSV)" : "Export extraction table (CSV)"}</Button>
          <p className="text-xs text-muted-foreground">{pt ? "A extração e a avaliação são individuais por revisor. A etapa avança com os dados de quem é o dono da revisão." : "Extraction and appraisal are per reviewer. The stage moves on with the review owner's data."}</p>
        </div>
      )}
    </div>
  );
}
