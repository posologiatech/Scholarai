import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ExternalLink, Sparkles, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type FundingCall = {
  id: string; agency: string; title: string; deadline: string | null; amount_brl: number | null; url: string | null;
};

export default function FundingLinkCard({ projectId }: { projectId: string }) {
  const [calls, setCalls] = useState<FundingCall[]>([]);
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [linkedCall, setLinkedCall] = useState<FundingCall | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: project }, { data: cs }] = await Promise.all([
      supabase.from("research_projects").select("funding_call_id").eq("id", projectId).single(),
      supabase.from("funding_calls").select("id,agency,title,deadline,amount_brl,url").order("deadline", { ascending: false }).limit(200),
    ]);
    setCalls((cs as FundingCall[]) || []);
    const fid = (project as any)?.funding_call_id ?? null;
    setLinkedId(fid);
    if (fid) {
      const { data } = await supabase.from("funding_calls").select("id,agency,title,deadline,amount_brl,url").eq("id", fid).single();
      setLinkedCall(data as FundingCall);
    } else { setLinkedCall(null); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const linkCall = async (id: string | null) => {
    await supabase.from("research_projects").update({ funding_call_id: id }).eq("id", projectId);
    toast.success(id ? "Edital vinculado" : "Vínculo removido");
    load();
  };

  const seedDeadlines = async () => {
    if (!linkedCall) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const rows: any[] = [];
    const today = new Date().toISOString().slice(0, 10);
    if (linkedCall.deadline) {
      rows.push({
        project_id: projectId, created_by: user.id,
        title: `📅 Submissão — ${linkedCall.agency}`,
        description: linkedCall.title,
        phase: "Submissão",
        start_date: today, end_date: linkedCall.deadline,
        status: "planejado", is_milestone: true, color: "#dc2626",
      });
      // pre-deadline reminders
      const d = new Date(linkedCall.deadline);
      const minus = (days: number) => { const x = new Date(d); x.setDate(x.getDate() - days); return x.toISOString().slice(0, 10); };
      rows.push({ project_id: projectId, created_by: user.id, title: `Revisar proposta (T-30)`, phase: "Submissão", start_date: minus(45), end_date: minus(30), status: "planejado" });
      rows.push({ project_id: projectId, created_by: user.id, title: `Documentação final (T-7)`, phase: "Submissão", start_date: minus(14), end_date: minus(7), status: "planejado" });
    }
    if (rows.length === 0) return toast.info("Sem prazos no edital");
    const { error } = await supabase.from("research_schedule_items").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} marcos adicionados ao cronograma`);
  };

  if (loading) return null;

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Vínculo com edital</h3>
        {linkedCall?.url && <a href={linkedCall.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">Abrir edital <ExternalLink className="h-3 w-3" /></a>}
      </div>
      {linkedCall ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{linkedCall.agency}</Badge>
            <span className="text-sm font-medium">{linkedCall.title}</span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            {linkedCall.deadline && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Prazo: {new Date(linkedCall.deadline).toLocaleDateString("pt-BR")}</span>}
            {linkedCall.amount_brl && <span>R$ {Number(linkedCall.amount_brl).toLocaleString("pt-BR")}</span>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={seedDeadlines}><Sparkles className="h-3 w-3" /> Gerar marcos no cronograma</Button>
            <Button size="sm" variant="ghost" onClick={() => linkCall("")}>Desvincular</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <Select value={linkedId || ""} onValueChange={linkCall}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um edital do módulo Financiamento" /></SelectTrigger>
            <SelectContent>
              {calls.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.agency} — {c.title.slice(0, 60)}{c.deadline ? ` · ${new Date(c.deadline).toLocaleDateString("pt-BR")}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </Card>
  );
}
