import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, FileText, Download, Trash2, Loader2, Upload, FileSpreadsheet, FileImage, Presentation as PresentationIcon, File as FileIcon } from "lucide-react";
import { toast } from "sonner";

type Doc = {
  id: string;
  doc_type: string;
  title: string;
  content: string | null;
  status: string;
  version: number;
  generated_by_ai: boolean;
  created_at: string;
  file_url?: string | null;
  metadata?: any;
};

const DOC_TYPES = [
  { value: "tcle", label: "TCLE — Termo de Consentimento" },
  { value: "tale", label: "TALE — Termo de Assentimento" },
  { value: "dmp", label: "DMP — Plano de Gestão de Dados" },
  { value: "relatorio_parcial", label: "Relatório Parcial CNPq/CAPES" },
  { value: "relatorio_final", label: "Relatório Final CNPq/CAPES" },
  { value: "folha_rosto", label: "Folha de Rosto (Plataforma Brasil)" },
  { value: "termo_sigilo", label: "Termo de Sigilo" },
  { value: "custom", label: "Documento personalizado" },
];

export default function DocumentsTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [genOpen, setGenOpen] = useState(false);
  const [docType, setDocType] = useState("tcle");
  const [customTitle, setCustomTitle] = useState("");
  const [extra, setExtra] = useState("");
  const [generating, setGenerating] = useState(false);
  const [viewing, setViewing] = useState<Doc | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("research_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setDocs((data as Doc[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-generate-document", {
        body: { project_id: projectId, doc_type: docType, title: customTitle || undefined, custom_instructions: extra || undefined },
      });
      if (error) throw error;
      toast.success("Documento gerado");
      setGenOpen(false);
      setExtra(""); setCustomTitle("");
      setViewing(data.document);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir documento?")) return;
    await supabase.from("research_documents").delete().eq("id", id);
    setDocs(docs.filter((d) => d.id !== id));
  };

  const downloadMd = (d: Doc) => {
    const blob = new Blob([d.content || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${d.title.replace(/[^\w-]+/g, "_")}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Documentos Oficiais</h2>
          <p className="text-sm text-muted-foreground">Gere TCLE, TALE, DMP, Relatórios CNPq/CAPES e mais a partir dos dados do projeto.</p>
        </div>
        <Button onClick={() => setGenOpen(true)} className="gap-2"><Sparkles className="h-4 w-4" /> Gerar com IA</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : docs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum documento ainda. Clique em <strong>Gerar com IA</strong> para começar.
        </Card>
      ) : (
        <div className="grid gap-2">
          {docs.map((d) => (
            <Card key={d.id} className="p-4 flex items-center justify-between gap-3">
              <button className="flex items-center gap-3 text-left flex-1" onClick={() => setViewing(d)}>
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-muted-foreground flex gap-2 items-center">
                    <Badge variant="secondary" className="text-xs">{DOC_TYPES.find((t) => t.value === d.doc_type)?.label.split("—")[0].trim() || d.doc_type}</Badge>
                    {d.generated_by_ai && <Badge variant="outline" className="text-xs">IA</Badge>}
                    <span>v{d.version}</span>
                    <span>· {new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </button>
              <Button size="icon" variant="ghost" onClick={() => downloadMd(d)}><Download className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar documento com IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Título (opcional)</label>
              <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Deixe em branco para usar título padrão" />
            </div>
            <div>
              <label className="text-sm font-medium">Instruções adicionais (opcional)</label>
              <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={4} placeholder="Ex.: incluir cláusula específica sobre coleta de dados genéticos…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={generate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle></DialogHeader>
          <Textarea
            value={viewing?.content || ""}
            onChange={(e) => viewing && setViewing({ ...viewing, content: e.target.value })}
            className="flex-1 min-h-[500px] font-mono text-sm"
          />
          <DialogFooter>
            {viewing && <Button variant="outline" onClick={() => downloadMd(viewing)} className="gap-2"><Download className="h-4 w-4" />Baixar .md</Button>}
            <Button onClick={async () => {
              if (!viewing) return;
              await supabase.from("research_documents").update({ content: viewing.content }).eq("id", viewing.id);
              toast.success("Salvo");
              setViewing(null); load();
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
