import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Banknote, BellRing, BellOff, ExternalLink, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { useProjectLinkedIds } from "@/hooks/useProjectLinkedIds";

const Inner = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const linkedFundingIds = useProjectLinkedIds("funding");
  const [agency, setAgency] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ agency: "CNPq", title: "", description: "", url: "", deadline: "", areas: "" });

  const { data: calls = [] } = useQuery({
    queryKey: ["funding-calls", agency],
    queryFn: async () => {
      let q = supabase.from("funding_calls").select("*").order("deadline", { ascending: true, nullsFirst: false });
      if (agency !== "all") q = q.eq("agency", agency);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["funding-subs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("funding_call_subscriptions").select("call_id").eq("user_id", user!.id);
      return (data ?? []).map((s: any) => s.call_id);
    },
  });

  const toggleSub = async (callId: string) => {
    if (subs.includes(callId)) {
      await supabase.from("funding_call_subscriptions").delete().eq("user_id", user!.id).eq("call_id", callId);
    } else {
      await supabase.from("funding_call_subscriptions").insert({ user_id: user!.id, call_id: callId });
    }
    qc.invalidateQueries({ queryKey: ["funding-subs"] });
  };

  const addManual = async () => {
    if (!form.title || !form.agency) return toast.error(locale === "pt" ? "Título e agência obrigatórios" : "Title and agency required");
    const { error } = await supabase.from("funding_calls").insert({
      agency: form.agency, title: form.title, description: form.description || null,
      url: form.url || null, deadline: form.deadline || null,
      areas: form.areas.split(",").map(a => a.trim()).filter(Boolean),
      is_manual: true, created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["funding-calls"] });
    setOpen(false); setForm({ agency: "CNPq", title: "", description: "", url: "", deadline: "", areas: "" });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-4"><Button asChild variant="ghost" size="sm"><Link to="/research"><ArrowLeft className="h-4 w-4" />{locale === "pt" ? "Projetos" : "Projects"}</Link></Button></div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Banknote className="h-7 w-7 text-primary" />
            {locale === "pt" ? "Editais de Fomento" : "Funding Calls"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {locale === "pt" ? "CAPES, CNPq, FAPESP, Finep e outras agências. Siga editais para receber alertas." : "CAPES, CNPq, FAPESP, Finep and more. Follow calls to get alerts."}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={agency} onValueChange={setAgency}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === "pt" ? "Todas" : "All"}</SelectItem>
              {["CNPq", "FAPESP", "CAPES", "Finep"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />{locale === "pt" ? "Cadastrar manual" : "Add manual"}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{locale === "pt" ? "Novo edital" : "New funding call"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{locale === "pt" ? "Agência" : "Agency"}</Label>
                  <Select value={form.agency} onValueChange={v => setForm({ ...form, agency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["CNPq", "FAPESP", "CAPES", "Finep", "Outra"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>{locale === "pt" ? "Título" : "Title"}</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{locale === "pt" ? "Descrição" : "Description"}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>URL</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></div>
                  <div><Label>{locale === "pt" ? "Prazo" : "Deadline"}</Label><Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
                </div>
                <div><Label>{locale === "pt" ? "Áreas (vírgula)" : "Areas (comma)"}</Label><Input value={form.areas} onChange={e => setForm({ ...form, areas: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={addManual}>{locale === "pt" ? "Salvar" : "Save"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="space-y-3">
        {calls.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">
          {locale === "pt" ? "Nenhum edital cadastrado ainda. Adicione manualmente ou aguarde a sincronização automática." : "No funding calls yet. Add manually or wait for auto-sync."}
        </CardContent></Card>}
        {calls.map((c: any) => {
          const daysLeft = c.deadline ? Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86400000) : null;
          const subscribed = subs.includes(c.id);
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{c.agency}</Badge>
                      {c.is_manual && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                      {daysLeft !== null && (
                        <Badge variant={daysLeft < 7 ? "destructive" : daysLeft < 30 ? "default" : "outline"}>
                          {daysLeft > 0 ? (locale === "pt" ? `${daysLeft}d restantes` : `${daysLeft}d left`) : (locale === "pt" ? "Encerrado" : "Closed")}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base mt-2">{c.title}</CardTitle>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <LinkToProjectButton
                      resourceType="funding"
                      resourceId={c.id}
                      label={c.title}
                      url={c.url || undefined}
                      variant="ghost"
                      metadata={{ agency: c.agency, deadline: c.deadline }}
                      linked={linkedFundingIds.has(c.id)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => toggleSub(c.id)} title={subscribed ? "Unfollow" : "Follow"}>
                      {subscribed ? <BellRing className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
                    </Button>
                    {c.url && <Button asChild size="icon" variant="ghost"><a href={c.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
                  </div>
                </div>
              </CardHeader>
              {(c.description || c.areas?.length) && <CardContent>
                {c.description && <p className="text-sm text-muted-foreground line-clamp-3">{c.description}</p>}
                {c.areas?.length > 0 && <div className="flex gap-1 mt-2 flex-wrap">{c.areas.map((a: string) => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}</div>}
              </CardContent>}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default function ResearchFunding() {
  return <Inner />;
}
