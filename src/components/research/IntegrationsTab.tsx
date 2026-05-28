import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ExternalLink, Calendar, FolderOpen, BookMarked, Github, FileText, Link2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import NotificationSettingsCard from "./NotificationSettingsCard";

type Provider = "google_calendar" | "google_drive" | "zotero" | "mendeley" | "github" | "overleaf";

const PROVIDERS: { id: Provider; label: string; icon: any; placeholder: string; help: string }[] = [
  { id: "google_calendar", label: "Google Calendar", icon: Calendar, placeholder: "https://calendar.google.com/calendar/u/0?cid=...", help: "Cole o ID/URL público do calendário do projeto." },
  { id: "google_drive", label: "Google Drive", icon: FolderOpen, placeholder: "https://drive.google.com/drive/folders/...", help: "Pasta compartilhada do projeto." },
  { id: "zotero", label: "Zotero", icon: BookMarked, placeholder: "https://www.zotero.org/groups/123456/projeto", help: "Group/Library URL ou ID." },
  { id: "mendeley", label: "Mendeley", icon: BookMarked, placeholder: "https://www.mendeley.com/...", help: "URL da pasta/grupo." },
  { id: "github", label: "GitHub", icon: Github, placeholder: "https://github.com/org/repo", help: "Repositório do código do projeto." },
  { id: "overleaf", label: "Overleaf", icon: FileText, placeholder: "https://www.overleaf.com/project/...", help: "Projeto LaTeX para escrita colaborativa." },
];

export const IntegrationsTab = ({ projectId }: { projectId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ provider: Provider; label: string; external_url: string }>({
    provider: "google_calendar", label: "", external_url: "",
  });

  const { data: items = [] } = useQuery({
    queryKey: ["research-integrations", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_integrations")
        .select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = async () => {
    if (!form.external_url.trim()) return toast.error(locale === "pt" ? "Informe a URL" : "Provide URL");
    const { error } = await supabase.from("research_integrations").insert({
      project_id: projectId, provider: form.provider,
      label: form.label || null, external_url: form.external_url,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(locale === "pt" ? "Integração adicionada" : "Integration added");
    qc.invalidateQueries({ queryKey: ["research-integrations", projectId] });
    setOpen(false); setForm({ provider: "google_calendar", label: "", external_url: "" });
  };

  const remove = async (id: string) => {
    if (!confirm(locale === "pt" ? "Remover esta integração?" : "Remove this integration?")) return;
    await supabase.from("research_integrations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["research-integrations", projectId] });
  };

  const meta = (p: string) => PROVIDERS.find(x => x.id === p);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" />{locale === "pt" ? "Integrações do projeto" : "Project integrations"}</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />{locale === "pt" ? "Conectar" : "Connect"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{locale === "pt" ? "Nova integração" : "New integration"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">{locale === "pt" ? "Serviço" : "Service"}</Label>
                  <Select value={form.provider} onValueChange={(v: Provider) => setForm({ ...form, provider: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{locale === "pt" ? "Rótulo (opcional)" : "Label (optional)"}</Label>
                  <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder={locale === "pt" ? "Ex.: Repo principal" : "e.g. Main repo"} />
                </div>
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input value={form.external_url} onChange={e => setForm({ ...form, external_url: e.target.value })} placeholder={meta(form.provider)?.placeholder} />
                  <p className="text-[11px] text-muted-foreground mt-1">{meta(form.provider)?.help}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{locale === "pt" ? "Cancelar" : "Cancel"}</Button>
                <Button onClick={add}>{locale === "pt" ? "Salvar" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {locale === "pt" ? "Conecte o projeto ao Google Calendar/Drive, Zotero, Mendeley, GitHub ou Overleaf para acessar tudo de um só lugar." : "Connect this project to Google Calendar/Drive, Zotero, Mendeley, GitHub or Overleaf."}
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {items.map((it: any) => {
              const m = meta(it.provider);
              const Icon = m?.icon ?? Link2;
              return (
                <Card key={it.id} className="border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{m?.label ?? it.provider}</p>
                        {it.label && <Badge variant="secondary" className="text-[10px]">{it.label}</Badge>}
                      </div>
                      <a href={it.external_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />{it.external_url}
                      </a>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <NotificationSettingsCard projectId={projectId} />
    </div>
  );
};

export default IntegrationsTab;
