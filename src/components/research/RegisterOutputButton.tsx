import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectPicker } from "./ProjectPicker";
import { registerOutput, linkResource, notifyProject } from "@/lib/research/integrations";
import type { ResearchLinkType } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  defaultTitle: string;
  outputType: string; // dataset | report | analysis | software | other
  description?: string;
  url?: string;
  metrics?: Record<string, any>;
  /** Optional: also record a resource link of this type. */
  linkType?: ResearchLinkType;
  linkResourceId?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost" | "default";
  trigger?: React.ReactNode;
}

export function RegisterOutputButton({
  defaultTitle, outputType, description, url, metrics, linkType, linkResourceId, size = "sm", variant = "outline", trigger,
}: Props) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!projectId) return toast.error(pt ? "Selecione um projeto" : "Select a project");
    if (!title.trim()) return toast.error(pt ? "Informe um título" : "Enter a title");
    setSaving(true);
    try {
      await registerOutput(projectId, { title: title.trim(), type: outputType, description, url, metrics });
      if (linkType) {
        await linkResource({ projectId, resourceType: linkType, resourceId: linkResourceId ?? null, label: title.trim(), url, metadata: metrics ?? {} });
      }
      await notifyProject(
        projectId,
        "output_registered",
        pt ? `Output registrado: ${title.trim()}` : `Output registered: ${title.trim()}`,
      );
      toast.success(pt ? `Registrado em "${projectTitle}"` : `Registered in "${projectTitle}"`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size={size} variant={variant} className="gap-1.5">
            <Boxes className="h-4 w-4" />
            {pt ? "Registrar como Output" : "Register as Output"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt ? "Registrar como Output do projeto" : "Register as project Output"}</DialogTitle>
          <DialogDescription>
            {pt
              ? "Salve este resultado (dataset, relatório ou análise) na vitrine de resultados do projeto."
              : "Save this result (dataset, report or analysis) to the project's outputs showcase."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{pt ? "Título" : "Title"}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{pt ? "Projeto" : "Project"}</Label>
            <ProjectPicker value={projectId} onChange={(id, t) => { setProjectId(id); setProjectTitle(t || ""); }} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !projectId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : pt ? "Registrar" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
