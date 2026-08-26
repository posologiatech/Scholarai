import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Award, Download, FileSignature, Plus, Mail } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { ROLE_LABEL, type ResearchMemberRole } from "@/lib/research/types";
import { toast } from "sonner";
import jsPDF from "jspdf";
import SuggestedCollaborators from "@/components/research/SuggestedCollaborators";

// CRediT — Contributor Roles Taxonomy (14 official roles)
// https://credit.niso.org/
export const CREDIT_ROLES: { id: string; label_pt: string; label_en: string; desc_pt: string; desc_en: string }[] = [
  { id: "conceptualization", label_pt: "Conceituação", label_en: "Conceptualization", desc_pt: "Ideias; formulação dos objetivos.", desc_en: "Ideas; formulation of goals." },
  { id: "data_curation", label_pt: "Curadoria de dados", label_en: "Data curation", desc_pt: "Gerenciamento e anotação dos dados.", desc_en: "Data management and annotation." },
  { id: "formal_analysis", label_pt: "Análise formal", label_en: "Formal analysis", desc_pt: "Análise estatística/matemática dos dados.", desc_en: "Statistical/mathematical analysis." },
  { id: "funding_acquisition", label_pt: "Obtenção de financiamento", label_en: "Funding acquisition", desc_pt: "Captação de recursos.", desc_en: "Acquisition of funding." },
  { id: "investigation", label_pt: "Investigação", label_en: "Investigation", desc_pt: "Coleta de evidências e experimentos.", desc_en: "Conducting experiments and data collection." },
  { id: "methodology", label_pt: "Metodologia", label_en: "Methodology", desc_pt: "Desenho da metodologia.", desc_en: "Design of methodology." },
  { id: "project_administration", label_pt: "Administração do projeto", label_en: "Project administration", desc_pt: "Coordenação e gerenciamento.", desc_en: "Coordination and management." },
  { id: "resources", label_pt: "Recursos", label_en: "Resources", desc_pt: "Materiais, reagentes e infraestrutura.", desc_en: "Materials, reagents, infrastructure." },
  { id: "software", label_pt: "Software", label_en: "Software", desc_pt: "Programação, código e algoritmos.", desc_en: "Programming and code." },
  { id: "supervision", label_pt: "Supervisão", label_en: "Supervision", desc_pt: "Liderança e mentoria.", desc_en: "Leadership and mentoring." },
  { id: "validation", label_pt: "Validação", label_en: "Validation", desc_pt: "Verificação de reprodutibilidade.", desc_en: "Verification of reproducibility." },
  { id: "visualization", label_pt: "Visualização", label_en: "Visualization", desc_pt: "Preparação de figuras e visualizações.", desc_en: "Figures and data visualization." },
  { id: "writing_original", label_pt: "Redação — minuta original", label_en: "Writing — original draft", desc_pt: "Escrita do rascunho inicial.", desc_en: "Drafting initial manuscript." },
  { id: "writing_review", label_pt: "Redação — revisão e edição", label_en: "Writing — review & editing", desc_pt: "Revisão crítica.", desc_en: "Critical review and editing." },
];

const roleLabel = (id: string, locale: string) => {
  const r = CREDIT_ROLES.find((x) => x.id === id);
  return r ? (locale === "pt" ? r.label_pt : r.label_en) : id;
};

export default function CreditAuthorshipTab({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const { locale } = useLanguage();
  const qc = useQueryClient();
  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ roles: string[]; is_corresponding: boolean; author_order: string; notes: string }>({
    roles: [], is_corresponding: false, author_order: "", notes: "",
  });

  const { data: members = [] } = useQuery({
    queryKey: ["research-members-credit", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_project_members")
        .select("*").eq("project_id", projectId).order("created_at");
      return data ?? [];
    },
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ["credit-contributions", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("research_credit_contributions")
        .select("*").eq("project_id", projectId);
      return data ?? [];
    },
  });

  const contribFor = (memberId: string) => contributions.find((c: any) => c.member_id === memberId);

  const openEdit = (memberId: string) => {
    const c = contribFor(memberId);
    setDraft({
      roles: c?.roles ?? [],
      is_corresponding: c?.is_corresponding ?? false,
      author_order: c?.author_order != null ? String(c.author_order) : "",
      notes: c?.notes ?? "",
    });
    setEditing(memberId);
  };

  const save = async () => {
    if (!editing) return;
    const existing = contribFor(editing);
    const payload = {
      project_id: projectId, member_id: editing,
      roles: draft.roles, is_corresponding: draft.is_corresponding,
      author_order: draft.author_order ? parseInt(draft.author_order) : null,
      notes: draft.notes || null,
    };
    const { error } = existing
      ? await supabase.from("research_credit_contributions").update(payload).eq("id", existing.id)
      : await supabase.from("research_credit_contributions").insert(payload);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["credit-contributions", projectId] });
    toast.success(t("Salvo", "Saved"));
    setEditing(null);
  };

  const ordered = useMemo(() => {
    return [...members].sort((a: any, b: any) => {
      const ca = contribFor(a.id)?.author_order ?? 999;
      const cb = contribFor(b.id)?.author_order ?? 999;
      return ca - cb;
    });
  }, [members, contributions]);

  // ---- Authorship statement ----
  const generateStatement = () => {
    const lines: string[] = [];
    ordered.forEach((m: any) => {
      const c = contribFor(m.id);
      if (!c?.roles?.length) return;
      const name = m.full_name || m.invited_email || "—";
      const roles = c.roles.map((r: string) => roleLabel(r, locale)).join("; ");
      lines.push(`${name}: ${roles}${c.is_corresponding ? ` (${t("autor correspondente", "corresponding author")})` : ""}.`);
    });
    return lines.join("\n");
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    let y = margin;
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(t("Declaração de Autoria (CRediT)", "Authorship Statement (CRediT)"), margin, y); y += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(projectTitle, margin, y, { maxWidth: 170 }); y += 10;
    doc.text(t(
      "Os autores listados abaixo contribuíram para este trabalho conforme a Taxonomia CRediT (Contributor Roles Taxonomy):",
      "The authors below contributed to this work according to the CRediT Taxonomy:"
    ), margin, y, { maxWidth: 170 }); y += 14;
    doc.setFontSize(10);
    ordered.forEach((m: any) => {
      const c = contribFor(m.id);
      if (!c?.roles?.length) return;
      const name = (m.full_name || m.invited_email || "—") + (c.is_corresponding ? ` *` : "");
      doc.setFont("helvetica", "bold");
      const nameLines = doc.splitTextToSize(name, 170);
      doc.text(nameLines, margin, y); y += nameLines.length * 5;
      doc.setFont("helvetica", "normal");
      const roles = c.roles.map((r: string) => roleLabel(r, locale)).join(", ");
      const roleLines = doc.splitTextToSize(roles, 170);
      doc.text(roleLines, margin, y); y += roleLines.length * 5 + 3;
      if (y > 270) { doc.addPage(); y = margin; }
    });
    y += 4; doc.setFontSize(8); doc.setFont("helvetica", "italic");
    doc.text(`* ${t("Autor correspondente", "Corresponding author")}`, margin, y);
    doc.save(`authorship-credit-${projectId.slice(0, 8)}.pdf`);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateStatement());
    toast.success(t("Copiado", "Copied"));
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/5 to-transparent">
        <CardContent className="py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Award className="h-10 w-10 text-amber-500" />
            <div>
              <p className="font-semibold">{t("CRediT — Contribuições de Autoria", "CRediT — Author Contributions")}</p>
              <p className="text-xs text-muted-foreground">{t("14 papéis padronizados (NISO/CASRAI) reconhecidos por Cell, Elsevier, Nature, PLOS, Wiley.", "14 standardized roles (NISO/CASRAI) recognized by Cell, Elsevier, Nature, PLOS, Wiley.")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyToClipboard}><FileSignature className="h-4 w-4" />{t("Copiar declaração", "Copy statement")}</Button>
            <Button size="sm" onClick={downloadPDF}><Download className="h-4 w-4" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      <SuggestedCollaborators projectId={projectId} members={members} />

      <div className="space-y-2">
        {ordered.map((m: any) => {
          const c = contribFor(m.id);
          const name = m.full_name || m.invited_email || "—";
          return (
            <Card key={m.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c?.author_order != null && <Badge variant="outline" className="text-[10px]">#{c.author_order}</Badge>}
                    <p className="font-medium">{name}</p>
                    <Badge variant="secondary" className="text-[10px]">{ROLE_LABEL[m.role as ResearchMemberRole][locale]}</Badge>
                    {c?.is_corresponding && <Badge className="text-[10px] gap-1"><Mail className="h-2.5 w-2.5" />{t("Correspondente", "Corresponding")}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(c?.roles ?? []).map((r: string) => (
                      <Badge key={r} variant="outline" className="text-[10px]">{roleLabel(r, locale)}</Badge>
                    ))}
                    {!c?.roles?.length && <span className="text-xs text-muted-foreground">{t("Sem contribuições atribuídas", "No contributions assigned")}</span>}
                  </div>
                  {c?.notes && <p className="text-xs text-muted-foreground mt-2">{c.notes}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(m.id)}>{t("Atribuir papéis", "Assign roles")}</Button>
              </CardContent>
            </Card>
          );
        })}
        {!members.length && (
          <p className="text-sm text-muted-foreground text-center py-8">{t("Adicione membros na aba Equipe antes de atribuir CRediT.", "Add members in the Team tab first.")}</p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("Atribuir papéis CRediT", "Assign CRediT roles")}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Ordem na assinatura", "Author order")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.author_order}
                  onChange={(e) => setDraft({ ...draft, author_order: e.target.value })}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">{t("Autor correspondente", "Corresponding author")}</Label>
                </div>
                <Switch checked={draft.is_corresponding} onCheckedChange={(v) => setDraft({ ...draft, is_corresponding: v })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{t("Papéis (selecione todos os aplicáveis)", "Roles (select all that apply)")}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CREDIT_ROLES.map((r) => {
                  const checked = draft.roles.includes(r.id);
                  return (
                    <label key={r.id} className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer transition ${checked ? "border-primary bg-primary/5" : ""}`}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => setDraft({ ...draft, roles: c ? [...draft.roles, r.id] : draft.roles.filter(x => x !== r.id) })}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{locale === "pt" ? r.label_pt : r.label_en}</p>
                        <p className="text-[11px] text-muted-foreground">{locale === "pt" ? r.desc_pt : r.desc_en}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>{t("Observações", "Notes")}</Label>
              <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{t("Salvar", "Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
