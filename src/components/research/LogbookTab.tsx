import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { BookOpen, Plus, Lock, CheckCircle2, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, { pt: string; en: string }> = {
  progresso: { pt: "Progresso", en: "Progress" },
  hipotese: { pt: "Hipótese", en: "Hypothesis" },
  decisao: { pt: "Decisão", en: "Decision" },
  dificuldade: { pt: "Dificuldade", en: "Issue" },
  leitura: { pt: "Leitura", en: "Reading" },
  experimento: { pt: "Experimento", en: "Experiment" },
  outro: { pt: "Outro", en: "Other" },
};

async function sha256(text: string) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function LogbookTab({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ entry_type: "progresso", title: "", content: "", entry_date: new Date().toISOString().slice(0, 10) });

  const { data: entries = [] } = useQuery({
    queryKey: ["logbook", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_logbook_entries")
        .select("*").eq("project_id", projectId).order("entry_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = async () => {
    if (!form.title || !form.content) return toast.error(locale === "pt" ? "Preencha título e conteúdo" : "Fill title and content");
    const { error } = await supabase.from("research_logbook_entries").insert({
      project_id: projectId, author_id: user!.id, ...form,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["logbook", projectId] });
    setOpen(false);
    setForm({ entry_type: "progresso", title: "", content: "", entry_date: new Date().toISOString().slice(0, 10) });
  };

  const sign = async (e: any) => {
    const hash = await sha256(`${e.id}|${e.title}|${e.content}|${e.entry_date}|${user!.id}|${Date.now()}`);
    await supabase.from("research_logbook_entries")
      .update({ status: "assinado", signed_at: new Date().toISOString(), signature_hash: hash })
      .eq("id", e.id);
    qc.invalidateQueries({ queryKey: ["logbook", projectId] });
  };

  const countersign = async (e: any) => {
    await supabase.from("research_logbook_entries")
      .update({ status: "contra_assinado", countersigned_by: user!.id, countersigned_at: new Date().toISOString() })
      .eq("id", e.id);
    qc.invalidateQueries({ queryKey: ["logbook", projectId] });
  };

  const remove = async (id: string) => {
    if (!confirm(locale === "pt" ? "Excluir entrada?" : "Delete entry?")) return;
    await supabase.from("research_logbook_entries").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["logbook", projectId] });
  };

  const exportMd = () => {
    const md = entries.map((e: any) =>
      `## ${e.entry_date} — ${e.title}\n**${TYPE_LABEL[e.entry_type]?.[locale]}** — *${e.status}*\n\n${e.content}\n${e.signature_hash ? `\n\`sig:${e.signature_hash.slice(0, 16)}…\`` : ""}\n`
    ).join("\n---\n\n");
    const blob = new Blob([`# ${locale === "pt" ? "Diário de Bordo" : "Lab Notebook"}\n\n${md}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `diario-bordo-${projectId.slice(0, 8)}.md`;
    a.click();
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 20;
    const pageW = 210, pageH = 297;
    const maxW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (h: number) => {
      if (y + h > pageH - margin) { doc.addPage(); y = margin; }
    };

    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text(locale === "pt" ? "Diário de Bordo" : "Lab Notebook", margin, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`${locale === "pt" ? "Exportado em" : "Exported"} ${new Date().toLocaleString()}`, margin, y);
    y += 8; doc.setTextColor(0);

    entries.forEach((e: any) => {
      ensureSpace(30);
      doc.setDrawColor(220); doc.line(margin, y, pageW - margin, y); y += 5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(`${e.entry_date} — ${e.title}`, margin, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`${TYPE_LABEL[e.entry_type]?.[locale]} · ${e.status}`, margin, y); y += 6;
      doc.setTextColor(0); doc.setFontSize(10);
      const lines = doc.splitTextToSize(e.content, maxW);
      lines.forEach((ln: string) => { ensureSpace(5); doc.text(ln, margin, y); y += 4.5; });
      if (e.signature_hash) {
        y += 2; ensureSpace(8);
        doc.setFontSize(7); doc.setTextColor(120); doc.setFont("courier", "normal");
        doc.text(`sig:${e.signature_hash}`, margin, y); y += 3;
        if (e.signed_at) { doc.text(`signed: ${new Date(e.signed_at).toISOString()}`, margin, y); y += 3; }
        if (e.countersigned_at) { doc.text(`countersigned: ${new Date(e.countersigned_at).toISOString()}`, margin, y); y += 3; }
        doc.setFont("helvetica", "normal"); doc.setTextColor(0);
      }
      y += 4;
    });

    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`${i} / ${total}`, pageW - margin, pageH - 8, { align: "right" });
    }

    doc.save(`diario-bordo-${projectId.slice(0, 8)}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          {entries.length} {locale === "pt" ? "entradas" : "entries"}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={!entries.length}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button size="sm" variant="outline" onClick={exportMd} disabled={!entries.length}>
            <Download className="h-4 w-4" />MD
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Nova entrada" : "New entry"}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{locale === "pt" ? "Nova entrada do diário" : "New logbook entry"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>{locale === "pt" ? "Tipo" : "Type"}</Label>
                    <Select value={form.entry_type} onValueChange={v => setForm({ ...form, entry_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(TYPE_LABEL).map(k => <SelectItem key={k} value={k}>{TYPE_LABEL[k][locale]}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label>{locale === "pt" ? "Data" : "Date"}</Label>
                    <Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></div>
                </div>
                <div><Label>{locale === "pt" ? "Título" : "Title"}</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Conteúdo" : "Content"}</Label>
                  <Textarea rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                    placeholder={locale === "pt" ? "O que aconteceu, decisões, hipóteses, próximos passos..." : "What happened, decisions, hypotheses, next steps..."} /></div>
              </div>
              <DialogFooter><Button onClick={add}>{locale === "pt" ? "Criar" : "Create"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((e: any) => (
          <Card key={e.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[e.entry_type]?.[locale]}</Badge>
                    <span className="text-xs text-muted-foreground">{e.entry_date}</span>
                    {e.status === "assinado" && <Badge className="text-[10px] bg-blue-600"><Lock className="h-3 w-3 mr-1" />{locale === "pt" ? "Assinado" : "Signed"}</Badge>}
                    {e.status === "contra_assinado" && <Badge className="text-[10px] bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />{locale === "pt" ? "Contra-assinado" : "Countersigned"}</Badge>}
                  </div>
                  <h4 className="text-sm font-semibold mt-1">{e.title}</h4>
                </div>
                <div className="flex gap-1">
                  {e.status === "rascunho" && e.author_id === user?.id && (
                    <Button size="sm" variant="outline" onClick={() => sign(e)}><Lock className="h-3 w-3" />{locale === "pt" ? "Assinar" : "Sign"}</Button>
                  )}
                  {e.status === "assinado" && isManager && (
                    <Button size="sm" variant="outline" onClick={() => countersign(e)}><CheckCircle2 className="h-3 w-3" />{locale === "pt" ? "Contra-assinar" : "Countersign"}</Button>
                  )}
                  {(e.author_id === user?.id || isManager) && e.status === "rascunho" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(e.id)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{e.content}</p>
              {e.signature_hash && <p className="text-[10px] font-mono text-muted-foreground mt-2">sig: {e.signature_hash.slice(0, 24)}…</p>}
            </CardContent>
          </Card>
        ))}
        {!entries.length && <p className="text-sm text-muted-foreground text-center py-8">{locale === "pt" ? "Sem entradas ainda. Comece registrando o progresso." : "No entries yet. Start logging your progress."}</p>}
      </div>
    </div>
  );
}
