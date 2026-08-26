import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link2, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { ProjectPicker } from "./ProjectPicker";
import { linkResource, attachEntityToProject, notifyProject } from "@/lib/research/integrations";
import type { ResearchLinkType } from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { cn } from "@/lib/utils";

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
  /** When true, shows an "already linked" confirmation instead of the action prompt. */
  linked?: boolean;
}

export function LinkToProjectButton({
  resourceType, resourceId, label, url, attachTable, metadata, size = "sm", variant = "outline", onLinked, linked = false,
}: Props) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const { activeProjectId, activeProjectTitle, setActiveProject } = useActiveProject();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(activeProjectId);
  const [projectTitle, setProjectTitle] = useState<string>(activeProjectTitle || "");
  const [saving, setSaving] = useState(false);

  // Re-sync the dialog's picker to the active project whenever it's (re)opened.
  useEffect(() => {
    if (open) {
      setProjectId(activeProjectId);
      setProjectTitle(activeProjectTitle || "");
    }
  }, [open, activeProjectId, activeProjectTitle]);

  const link = async (pid: string, ptitle: string) => {
    setSaving(true);
    try {
      await linkResource({ projectId: pid, resourceType, resourceId, label, url, metadata });
      if (attachTable) await attachEntityToProject(attachTable, resourceId, pid);
      await notifyProject(
        pid,
        "link_added",
        pt ? `Recurso vinculado: ${label}` : `Resource linked: ${label}`,
      );
      setActiveProject(pid, ptitle);
      toast.success(pt ? `Vinculado a "${ptitle}"` : `Linked to "${ptitle}"`);
      onLinked?.(pid);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // One click when there's already an active project — no picker round-trip needed.
  const handleMainClick = () => {
    if (activeProjectId) link(activeProjectId, activeProjectTitle || "");
    else setOpen(true);
  };

  const handleDialogSave = () => {
    if (!projectId) return toast.error(pt ? "Selecione um projeto" : "Select a project");
    link(projectId, projectTitle);
  };

  const mainLabel = linked && activeProjectId
    ? (pt ? `Vinculado a "${activeProjectTitle}"` : `Linked to "${activeProjectTitle}"`)
    : activeProjectId
      ? (pt ? `Vincular a "${activeProjectTitle}"` : `Link to "${activeProjectTitle}"`)
      : (pt ? "Vincular a projeto" : "Link to project");

  return (
    <div className="inline-flex">
      <Button
        size={size}
        variant={linked ? "ghost" : variant}
        className={cn("gap-1.5 max-w-[220px]", activeProjectId && "rounded-r-none", linked && "text-muted-foreground hover:text-foreground")}
        onClick={handleMainClick}
        disabled={saving}
        title={linked ? (pt ? "Já vinculado — clique para vincular novamente" : "Already linked — click to re-link") : undefined}
      >
        {linked ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <Link2 className="h-4 w-4 shrink-0" />}
        <span className="truncate">{saving ? "..." : mainLabel}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {activeProjectId && (
          <DialogTrigger asChild>
            <Button
              size={size}
              variant={variant}
              className="rounded-l-none border-l border-l-background/40 px-1.5"
              title={pt ? "Escolher outro projeto" : "Choose another project"}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pt ? "Vincular ao projeto de pesquisa" : "Link to research project"}</DialogTitle>
            <DialogDescription>
              {pt
                ? "Conecte este recurso a um projeto para centralizar referências, dados e atividade."
                : "Connect this resource to a project to centralize references, data and activity."}
            </DialogDescription>
          </DialogHeader>
          <ProjectPicker value={projectId} onChange={(id, title) => { setProjectId(id); setProjectTitle(title || ""); }} />
          <DialogFooter>
            <Button onClick={handleDialogSave} disabled={saving || !projectId}>
              {saving ? "..." : pt ? "Vincular" : "Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
