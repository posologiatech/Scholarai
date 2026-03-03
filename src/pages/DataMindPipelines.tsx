import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Trash2, GitBranch, Loader2, Tag, Clock, BarChart3, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Pipeline {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  is_public: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  step_count?: number;
}

interface PipelineStep {
  id: string;
  step_order: number;
  prompt: string;
  code: string;
  description: string | null;
}

const DataMindPipelines = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailPipeline, setDetailPipeline] = useState<Pipeline | null>(null);
  const [detailSteps, setDetailSteps] = useState<PipelineStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  const fetchPipelines = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("datamind_pipelines" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    const list = (data as any[]) || [];

    for (const p of list) {
      const { count } = await supabase
        .from("datamind_pipeline_steps" as any)
        .select("id", { count: "exact", head: true })
        .eq("pipeline_id", p.id);
      p.step_count = count || 0;
    }

    setPipelines(list);
    setLoading(false);
  };

  useEffect(() => { fetchPipelines(); }, [user]);

  const deletePipeline = async (id: string) => {
    await supabase.from("datamind_pipelines" as any).delete().eq("id", id);
    setPipelines((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Pipeline excluído" });
  };

  const viewDetail = async (pipeline: Pipeline) => {
    setDetailPipeline(pipeline);
    setLoadingSteps(true);
    const { data } = await supabase
      .from("datamind_pipeline_steps" as any)
      .select("*")
      .eq("pipeline_id", pipeline.id)
      .order("step_order", { ascending: true });
    setDetailSteps((data as any[]) || []);
    setLoadingSteps(false);
  };

  const applyPipeline = async (pipeline: Pipeline) => {
    // Navigate to DataMind with pipeline context
    // We'll create a new conversation and auto-run the steps
    navigate(`/datamind?pipeline=${pipeline.id}`);
  };

  const filtered = pipelines.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.tags.some((t) => t.includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipelines de Análise</h1>
            <p className="text-sm text-muted-foreground mt-1">Templates reutilizáveis de sequências de análise</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pipelines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum pipeline salvo</p>
            <p className="text-sm mt-1">Salve sequências de análise no DataMind para reutilizá-las aqui.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((pipeline) => (
              <Card key={pipeline.id} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => viewDetail(pipeline)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{pipeline.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => { e.stopPropagation(); deletePipeline(pipeline.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pipeline.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{pipeline.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {pipeline.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                        <Tag className="h-2.5 w-2.5 mr-0.5" />{tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{pipeline.step_count || 0} etapas</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pipeline.usage_count}x usado</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailPipeline} onOpenChange={(open) => !open && setDetailPipeline(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailPipeline?.title}</DialogTitle>
            <DialogDescription>
              {detailPipeline?.description || "Pipeline de análise reutilizável"}
            </DialogDescription>
          </DialogHeader>

          {loadingSteps ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto py-2">
              {detailSteps.map((step, i) => (
                <div key={step.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    {i < detailSteps.length - 1 && (
                      <div className="w-px flex-1 bg-border/60 my-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-3">
                    <p className="text-sm text-foreground font-medium line-clamp-2">
                      {step.prompt || step.description || "Etapa de análise"}
                    </p>
                    <pre className="mt-1 text-[11px] bg-muted/40 rounded-md p-2 overflow-x-auto text-muted-foreground max-h-24 overflow-hidden">
                      {step.code.slice(0, 300)}{step.code.length > 300 ? "..." : ""}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                if (detailPipeline) applyPipeline(detailPipeline);
                setDetailPipeline(null);
              }}
              className="gap-1.5"
            >
              <Play className="h-4 w-4" />
              Aplicar em novos dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataMindPipelines;
