import { useState } from "react";
import { Save, Loader2, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Message } from "@/pages/DataMind";

interface Props {
  messages: Message[];
  conversationTitle?: string;
}

const SavePipelineDialog = ({ messages, conversationTitle }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Extract steps from conversation: assistant messages that have code_block
  const steps = messages
    .filter((m) => m.role === "assistant" && m.code_block)
    .map((m, i) => ({
      step_order: i,
      prompt: messages.find(
        (um) =>
          um.role === "user" &&
          new Date(um.created_at) < new Date(m.created_at) &&
          !messages.some(
            (other) =>
              other.role === "assistant" &&
              other.code_block &&
              new Date(other.created_at) > new Date(um.created_at) &&
              new Date(other.created_at) < new Date(m.created_at)
          )
      )?.content || "",
      code: m.code_block!,
      description: m.content.slice(0, 200),
    }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const save = async () => {
    if (!user || !title.trim() || steps.length === 0) return;
    setSaving(true);

    const { data: pipeline, error } = await supabase
      .from("datamind_pipelines" as any)
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        tags,
      } as any)
      .select("id")
      .single();

    if (error || !pipeline) {
      toast({ title: "Erro ao salvar pipeline", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const stepsToInsert = steps.map((s) => ({
      pipeline_id: (pipeline as any).id,
      step_order: s.step_order,
      prompt: s.prompt,
      code: s.code,
      description: s.description,
    }));

    const { error: stepsErr } = await supabase
      .from("datamind_pipeline_steps" as any)
      .insert(stepsToInsert as any);

    setSaving(false);
    if (stepsErr) {
      toast({ title: "Erro ao salvar etapas", description: stepsErr.message, variant: "destructive" });
    } else {
      toast({ title: "Pipeline salvo!", description: `"${title.trim()}" com ${steps.length} etapas.` });
      setOpen(false);
      setTitle("");
      setDescription("");
      setTags([]);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTitle(conversationTitle || "");
    }
  };

  if (steps.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
          <Save className="h-3.5 w-3.5" />
          Salvar Pipeline
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como Pipeline</DialogTitle>
          <DialogDescription>
            Salve esta sequência de {steps.length} análise(s) como um template reutilizável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Análise descritiva completa"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Descrição (opcional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que este pipeline faz..."
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Tags</label>
            <div className="flex gap-1 mb-2 flex-wrap">
              {tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                >
                  {t} ×
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Adicionar tag..."
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addTag(); }
              }}
            />
          </div>

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Etapas detectadas:</p>
            <div className="space-y-1">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-foreground/80 line-clamp-1">{s.prompt || s.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving || !title.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SavePipelineDialog;
