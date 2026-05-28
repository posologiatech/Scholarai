import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShieldCheck, ExternalLink, Upload, FileSignature, Lock, FileText, Download } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { supabase as supa } from "@/integrations/supabase/client";

const CATEGORIES = [
  { id: "etica", label_pt: "Ética", label_en: "Ethics" },
  { id: "dados", label_pt: "Dados / LGPD", label_en: "Data / LGPD" },
  { id: "financeiro", label_pt: "Financeiro", label_en: "Financial" },
  { id: "registro", label_pt: "Registros", label_en: "Registries" },
  { id: "publicacao", label_pt: "Publicação", label_en: "Publication" },
  { id: "outro", label_pt: "Outro", label_en: "Other" },
];

const TEMPLATES = [
  { category: "etica", title_pt: "Submissão ao CEP via Plataforma Brasil", title_en: "Ethics committee submission" },
  { category: "etica", title_pt: "TCLE aprovado e versionado", title_en: "Approved and versioned ICF" },
  { category: "dados", title_pt: "Plano de Gestão de Dados (DMP)", title_en: "Data Management Plan (DMP)" },
  { category: "dados", title_pt: "Conformidade LGPD documentada", title_en: "LGPD compliance documented" },
  { category: "registro", title_pt: "Registro em ReBEC / ClinicalTrials", title_en: "Trial registry (ReBEC / ClinicalTrials)" },
  { category: "financeiro", title_pt: "Prestação de contas atualizada", title_en: "Financial reporting up to date" },
  { category: "publicacao", title_pt: "ORCID conectado de todos os autores", title_en: "ORCID linked for all authors" },
  { category: "publicacao", title_pt: "Declaração de uso de IA", title_en: "AI usage disclosure" },
];

export default function ComplianceTab({ projectId }: { projectId: string }) {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "etica", title: "", description: "", due_date: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["compliance", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_compliance_items")
        .select("*").eq("project_id", projectId).order("category").order("created_at");
      return data ?? [];
    },
  });

  // Auto-seed templates if empty
  useEffect(() => {
    if (items.length === 0 && user) {
      (async () => {
        const rows = TEMPLATES.map(tpl => ({
          project_id: projectId,
          category: tpl.category,
          title: locale === "pt" ? tpl.title_pt : tpl.title_en,
          status: "pending",
          created_by: user.id,
        }));
        await supabase.from("research_compliance_items").insert(rows);
        qc.invalidateQueries({ queryKey: ["compliance", projectId] });
      })();
    }
  }, [items.length, user, projectId, locale, qc]);

  const add = async () => {
    if (!form.title) return;
    await supabase.from("research_compliance_items").insert({
      project_id: projectId, created_by: user!.id,
      category: form.category, title: form.title,
      description: form.description || null,
      due_date: form.due_date || null,
      status: "pending",
    });
    qc.invalidateQueries({ queryKey: ["compliance", projectId] });
    setOpen(false); setForm({ category: "etica", title: "", description: "", due_date: "" });
  };

  const toggle = async (id: string, current: string) => {
    await supabase.from("research_compliance_items")
      .update({ status: current === "completed" ? "pending" : "completed" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["compliance", projectId] });
  };

  const remove = async (id: string) => {
    await supabase.from("research_compliance_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["compliance", projectId] });
  };

  const completed = items.filter((i: any) => i.status === "completed").length;
  const pct = items.length ? Math.round((completed / items.length) * 100) : 0;

  const grouped = items.reduce((acc: any, i: any) => {
    (acc[i.category] = acc[i.category] || []).push(i); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck className="h-10 w-10 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{t("Conformidade do projeto", "Project compliance")}</p>
              <p className="text-3xl font-bold">{pct}%</p>
              <p className="text-xs text-muted-foreground">{completed} / {items.length} {t("itens concluídos", "items completed")}</p>
            </div>
          </div>
          <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{t("Novo item", "New item")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("Novo item de conformidade", "New compliance item")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("Categoria", "Category")}</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{locale === "pt" ? c.label_pt : c.label_en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("Título", "Title")}</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>{t("Descrição", "Description")}</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div><Label>{t("Prazo", "Due date")}</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={add}>{t("Adicionar", "Add")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {CATEGORIES.map(cat => {
        const list = grouped[cat.id];
        if (!list?.length) return null;
        return (
          <Card key={cat.id}>
            <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">{locale === "pt" ? cat.label_pt : cat.label_en}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {list.map((it: any) => (
                <div key={it.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <Checkbox checked={it.status === "completed"} onCheckedChange={() => toggle(it.id, it.status)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${it.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{it.title}</p>
                    {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                    {it.due_date && <Badge variant="outline" className="text-[10px] mt-1">{new Date(it.due_date).toLocaleDateString()}</Badge>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
