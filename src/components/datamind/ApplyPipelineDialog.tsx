import { useState, useEffect } from "react";
import { Play, Loader2, GitBranch, Upload, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Pipeline {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
}

interface PipelineStep {
  id: string;
  step_order: number;
  prompt: string;
  code: string;
  description: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (steps: PipelineStep[]) => void;
}

const ApplyPipelineDialog = ({ open, onOpenChange, onApply }: Props) => {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Pipeline | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      supabase
        .from("datamind_pipelines" as any)
        .select("id, title, description, tags")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .then(({ data }) => {
          setPipelines((data as any[]) || []);
          setLoading(false);
        });
    }
  }, [open, user]);

  const selectPipeline = async (p: Pipeline) => {
    setSelected(p);
    setLoadingSteps(true);
    const { data } = await supabase
      .from("datamind_pipeline_steps" as any)
      .select("*")
      .eq("pipeline_id", p.id)
      .order("step_order", { ascending: true });
    setSteps((data as any[]) || []);
    setLoadingSteps(false);
  };

  const handleApply = async () => {
    if (!selected || steps.length === 0) return;
    // Increment usage count
    await supabase
      .from("datamind_pipelines" as any)
      .update({ usage_count: (selected as any).usage_count ? (selected as any).usage_count + 1 : 1 } as any)
      .eq("id", selected.id);
    onApply(steps);
    onOpenChange(false);
    setSelected(null);
    setSteps([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSelected(null); setSteps([]); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar Pipeline</DialogTitle>
          <DialogDescription>
            {selected
              ? `"${selected.title}" — ${steps.length} etapas`
              : "Selecione um pipeline para aplicar nos dados atuais"
            }
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-1 max-h-64 overflow-y-auto py-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : pipelines.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum pipeline salvo.</p>
              </div>
            ) : (
              pipelines.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPipeline(p)}
                  className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <GitBranch className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto py-2">
            {loadingSteps ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              steps.map((step, i) => (
                <div key={step.id} className="flex gap-3">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-1">{step.prompt || step.description || "Etapa"}</p>
                    <pre className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1 mt-0.5 overflow-hidden max-h-12">
                      {step.code.slice(0, 150)}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selected && (
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => { setSelected(null); setSteps([]); }}>
              Voltar
            </Button>
            <Button size="sm" onClick={handleApply} className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> Aplicar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApplyPipelineDialog;
