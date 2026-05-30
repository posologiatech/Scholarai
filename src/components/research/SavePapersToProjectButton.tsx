import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FolderGit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectPicker } from "./ProjectPicker";
import { importPapersToReferences, linkResource, notifyProject } from "@/lib/research/integrations";
import { useLanguage } from "@/i18n/LanguageContext";

export interface SavePaper {
  external_paper_id?: string | null;
  paper_db_id?: string | null;
  title: string;
  authors?: string | null;
  year?: number | null;
  doi?: string | null;
}

interface Props {
  papers: SavePaper[];
  /** Optional label/url for the search link recorded in the project. */
  searchLabel?: string;
  searchUrl?: string;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export function SavePapersToProjectButton({ papers, searchLabel, searchUrl, disabled, trigger }: Props) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!projectId) return toast.error(pt ? "Selecione um projeto" : "Select a project");
    setSaving(true);
    try {
      const n = await importPapersToReferences(projectId, papers);
      if (searchLabel) {
        await linkResource({
          projectId,
          resourceType: "search",
          label: searchLabel,
          url: searchUrl,
          metadata: { papers: papers.length },
        });
      }
      await notifyProject(
        projectId,
        "references_imported",
        pt ? `${n} referência(s) importada(s)` : `${n} reference(s) imported`,
        pt ? `Do projeto "${projectTitle}"` : `Into "${projectTitle}"`,
      );
      toast.success(
        n > 0
          ? pt ? `${n} referência(s) salva(s) em "${projectTitle}"` : `${n} reference(s) saved to "${projectTitle}"`
          : pt ? "Nenhuma nova referência (já existentes)" : "No new references (already present)",
      );
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
          <button
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            <FolderGit2 className="h-3.5 w-3.5" />
            <span>{pt ? "Salvar no projeto" : "Save to project"}</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt ? "Salvar referências no projeto" : "Save references to project"}</DialogTitle>
          <DialogDescription>
            {pt
              ? `${papers.length} artigo(s) serão importados como referências do projeto e ficarão disponíveis para o Copilot (RAG) e a Escrita Científica.`
              : `${papers.length} paper(s) will be imported as project references, available to the Copilot (RAG) and Scientific Writing.`}
          </DialogDescription>
        </DialogHeader>
        <ProjectPicker value={projectId} onChange={(id, title) => { setProjectId(id); setProjectTitle(title || ""); }} />
        <DialogFooter>
          <Button onClick={save} disabled={saving || !projectId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : pt ? "Salvar" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
