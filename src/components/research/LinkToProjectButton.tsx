import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectPicker } from "./ProjectPicker";
import { linkResource, attachEntityToProject, notifyProject } from "@/lib/research/integrations";
import type { ResearchLinkType } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  resourceType: ResearchLinkType;
  resourceId: string;
  label: string;
  url?: string;
  /** If set, also stamps research_project_id on the module's own table. */
  attachTable?: "datamind_conversations" | "surveys" | "writing_documents" | "systematic_reviews" | "saved_searches";
  metadata?: Record<string, any>;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost" | "default";
  onLinked?: (projectId: string) => void;
}

export function LinkToProjectButton({
  resourceType, resourceId, label, url, attachTable, metadata, size = "sm", variant = "outline", onLinked,
}: Props) {
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!projectId) return toast.error(locale === "pt" ? "Selecione um projeto" : "Select a project");
    setSaving(true);
    try {
      await linkResource({ projectId, resourceType, resourceId, label, url, metadata });
      if (attachTable) await attachEntityToProject(attachTable, resourceId, projectId);
      await notifyProject(
        projectId,
        "link_added",
        locale === "pt" ? `Recurso vinculado: ${label}` : `Resource linked: ${label}`,
      );
      toast.success(
        locale === "pt" ? `Vinculado a "${projectTitle}"` : `Linked to "${projectTitle}"`,
      );
      onLinked?.(projectId);
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
        <Button size={size} variant={variant} className="gap-1.5">
          <Link2 className="h-4 w-4" />
          {locale === "pt" ? "Vincular a projeto" : "Link to project"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{locale === "pt" ? "Vincular ao projeto de pesquisa" : "Link to research project"}</DialogTitle>
          <DialogDescription>
            {locale === "pt"
              ? "Conecte este recurso a um projeto para centralizar referências, dados e atividade."
              : "Connect this resource to a project to centralize references, data and activity."}
          </DialogDescription>
        </DialogHeader>
        <ProjectPicker value={projectId} onChange={(id, title) => { setProjectId(id); setProjectTitle(title || ""); }} />
        <DialogFooter>
          <Button onClick={save} disabled={saving || !projectId}>
            {saving ? "..." : locale === "pt" ? "Vincular" : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
