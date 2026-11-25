import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectPicker } from "@/components/research/ProjectPicker";
import { ReviewTypePicker } from "./ReviewTypePicker";
import { useAuth } from "@/hooks/useAuth";
import { createReview } from "@/lib/review/api";
import { AREA_LABELS } from "@/lib/review/areas";
import { getReviewType } from "@/lib/review/types";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; locale: "pt" | "en" }

export function NewReviewDialog({ open, onOpenChange, locale }: Props) {
  const pt = locale === "pt";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("health");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const def = type ? getReviewType(type) : undefined;
  const canCreate = !!def && title.trim().length > 0 && !!user;

  const create = async () => {
    if (!def || !user) return;
    setSaving(true);
    try {
      const review = await createReview({ ownerId: user.id, def, locale, title: title.trim(), area, researchProjectId: projectId });
      onOpenChange(false);
      navigate(`/reviews/${review.id}`);
    } catch (e) {
      console.error(e);
      toast.error(pt ? "Não foi possível criar a revisão." : "Could not create the review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{pt ? "Nova revisão guiada" : "New guided review"}</DialogTitle>
          <DialogDescription>
            {pt ? "Escolha o tipo. O sistema conduz as etapas do processo próprio de cada um." : "Pick the type. The system walks you through that type's own process."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <ReviewTypePicker value={type} onChange={setType} locale={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="review-title">{pt ? "Título de trabalho" : "Working title"}</Label>
              <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pt ? "Ex.: Metformina e risco de demência" : "E.g. Metformin and dementia risk"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-area">{pt ? "Área" : "Area"}</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger id="review-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v[locale]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{pt ? "Projeto de pesquisa (opcional)" : "Research project (optional)"}</Label>
              <ProjectPicker value={projectId} onChange={(id) => setProjectId(id)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{pt ? "Cancelar" : "Cancel"}</Button>
          <Button onClick={create} disabled={!canCreate || saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {pt ? "Criar e começar" : "Create and start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
