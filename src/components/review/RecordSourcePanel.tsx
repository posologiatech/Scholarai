import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchFullText, loadText, saveFullText, type IncludedRecord } from "@/lib/review/extractionApi";

interface Props {
  record: IncludedRecord;
  locale: "pt" | "en";
  canEdit: boolean;
  /** Called after the stored text changes so the AI works on the new text. */
  onTextChanged: () => void;
}

/** The text the data is read from. Quotes proposed by the AI are checked against exactly this. */
export function RecordSourcePanel({ record, locale, canEdit, onTextChanged }: Props) {
  const pt = locale === "pt";
  const [text, setText] = useState<{ abstract: string | null; full_text: string | null; full_text_source: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => { setText(null); setPasting(false); loadText(record.id).then(setText).catch(console.error); }, [record.id]);

  const find = async () => {
    setBusy(true);
    try {
      const found = await fetchFullText(record);
      if (!found) { toast.info(pt ? "Não encontrei texto completo aberto para este artigo. Cole o texto, se tiver acesso." : "No open full text found for this paper. Paste the text if you have access."); return; }
      await saveFullText(record.id, found, "europe_pmc");
      setText(await loadText(record.id));
      onTextChanged();
      toast.success(pt ? "Texto completo salvo." : "Full text saved.");
    } catch (e) { console.error(e); toast.error(pt ? "Falha ao buscar o texto." : "Failed to fetch the text."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (draft.trim().length < 500) { toast.error(pt ? "O texto colado é curto demais para ser o artigo." : "The pasted text is too short to be the paper."); return; }
    setBusy(true);
    try { await saveFullText(record.id, draft, "pasted"); setText(await loadText(record.id)); setPasting(false); setDraft(""); onTextChanged(); }
    catch (e) { console.error(e); toast.error(pt ? "Não foi possível salvar o texto." : "Could not save the text."); }
    finally { setBusy(false); }
  };

  if (!text) return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const body = text.full_text || text.abstract || "";

  return (
    <section aria-label={pt ? "Texto do estudo" : "Study text"} className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-medium"><FileText className="h-4 w-4" aria-hidden />{pt ? "Texto do estudo" : "Study text"}
          <Badge variant={text.full_text ? "secondary" : "outline"}>{text.full_text ? (text.full_text_source === "pasted" ? (pt ? "Texto completo (colado)" : "Full text (pasted)") : (pt ? "Texto completo" : "Full text")) : (pt ? "Só o resumo" : "Abstract only")}</Badge>
        </h4>
        {canEdit && !text.full_text && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={find} className="gap-1.5">{busy && <Loader2 className="h-3 w-3 animate-spin" />}{pt ? "Buscar texto completo" : "Find full text"}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setPasting((p) => !p)}>{pt ? "Colar texto" : "Paste text"}</Button>
          </div>
        )}
      </div>
      {!text.full_text && <p className="text-xs text-muted-foreground">{pt ? "Com só o resumo, muitos campos (tamanho da amostra, seguimento, risco de viés) não podem ser preenchidos com segurança." : "With the abstract alone, many fields (sample size, follow-up, risk of bias) can't be filled in reliably."}</p>}
      {pasting && (
        <div className="space-y-2">
          <textarea aria-label={pt ? "Texto do artigo" : "Paper text"} className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button size="sm" onClick={save} disabled={busy}>{pt ? "Salvar texto" : "Save text"}</Button>
        </div>
      )}
      <p className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{body.slice(0, 6000)}{body.length > 6000 ? "…" : ""}</p>
    </section>
  );
}
