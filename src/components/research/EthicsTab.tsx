import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Sub = {
  id: string;
  submission_type: string;
  title: string;
  protocol_number: string | null;
  caae: string | null;
  status: string;
  submitted_at: string | null;
  decision_date: string | null;
  reviewer_notes: string | null;
  notes: string | null;
};

const TYPES = [
  { v: "inicial", l: "Submissão inicial" },
  { v: "emenda", l: "Emenda" },
  { v: "relatorio_parcial", l: "Relatório parcial" },
  { v: "relatorio_final", l: "Relatório final" },
  { v: "recurso", l: "Recurso" },
];

const STATUS = [
  { v: "rascunho", l: "Rascunho", color: "secondary" as const },
  { v: "submetido", l: "Submetido", color: "default" as const },
  { v: "em_analise", l: "Em análise", color: "default" as const },
  { v: "pendencias", l: "Com pendências", color: "destructive" as const },
  { v: "aprovado", l: "Aprovado", color: "default" as const },
  { v: "reprovado", l: "Reprovado", color: "destructive" as const },
  { v: "arquivado", l: "Arquivado", color: "secondary" as const },
];

export default function EthicsTab({ projectId }: { projectId: string }) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Sub>>({ submission_type: "inicial", status: "rascunho" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("research_ethics_submissions").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setSubs((data as Sub[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = { ...edit, project_id: projectId, created_by: user.id };
    if (edit.id) {
      const { error } = await supabase.from("research_ethics_submissions").update(payload).eq("id", edit.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("research_ethics_submissions").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    setOpen(false); setEdit({ submission_type: "inicial", status: "rascunho" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir submissão?")) return;
    await supabase.from("research_ethics_submissions").delete().eq("id", id);
    load();
  };

  const pending = subs.filter((s) => s.status === "pendencias").length;
  const inAnalysis = subs.filter((s) => s.status === "em_analise" || s.status === "submetido").length;
  const approved = subs.filter((s) => s.status === "aprovado").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Comitê de Ética (CEP/CONEP)</h2>
          <p className="text-sm text-muted-foreground">Tracker de submissões, pareceres, emendas e relatórios.</p>
        </div>
        <Button onClick={() => { setEdit({ submission_type: "inicial", status: "rascunho" }); setOpen(true); }} className="gap-1"><Plus className="h-4 w-4" />Nova submissão</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Em análise</div><div className="text-2xl font-semibold">{inAnalysis}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Com pendências</div><div className="text-2xl font-semibold flex items-center gap-2">{pending}{pending > 0 && <AlertCircle className="h-5 w-5 text-destructive" />}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Aprovadas</div><div className="text-2xl font-semibold">{approved}</div></Card>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> : subs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma submissão registrada.</Card>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => {
            const st = STATUS.find((x) => x.v === s.status);
            return (
              <Card key={s.id} className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30" onClick={() => { setEdit(s); setOpen(true); }}>
                <Badge variant="outline" className="text-xs">{TYPES.find((t) => t.v === s.submission_type)?.l}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground flex gap-3">
                    {s.caae && <span>CAAE {s.caae}</span>}
                    {s.protocol_number && <span>Protocolo {s.protocol_number}</span>}
                    {s.submitted_at && <span>Submetido {new Date(s.submitted_at).toLocaleDateString("pt-BR")}</span>}
                    {s.decision_date && <span>Parecer {new Date(s.decision_date).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
                <Badge variant={st?.color || "secondary"}>{st?.l}</Badge>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(s.id); }}><Trash2 className="h-4 w-4" /></Button>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Nova"} submissão ética</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={edit.submission_type} onValueChange={(v) => setEdit({ ...edit, submission_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Título" value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="CAAE" value={edit.caae || ""} onChange={(e) => setEdit({ ...edit, caae: e.target.value })} />
              <Input placeholder="Nº Protocolo / Parecer" value={edit.protocol_number || ""} onChange={(e) => setEdit({ ...edit, protocol_number: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-muted-foreground">Data de submissão</label><Input type="date" value={edit.submitted_at || ""} onChange={(e) => setEdit({ ...edit, submitted_at: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Data do parecer</label><Input type="date" value={edit.decision_date || ""} onChange={(e) => setEdit({ ...edit, decision_date: e.target.value })} /></div>
            </div>
            <Textarea placeholder="Notas do parecer / pendências" rows={3} value={edit.reviewer_notes || ""} onChange={(e) => setEdit({ ...edit, reviewer_notes: e.target.value })} />
            <Textarea placeholder="Observações internas" rows={2} value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
