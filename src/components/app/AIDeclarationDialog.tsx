import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, Plus, X, ShieldCheck, Globe, BookOpen, FileText } from "lucide-react";
import { toast } from "sonner";

export interface AIUsageEntry {
  action: string;
  section: string;
  timestamp: string;
}

interface AIDeclarationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiUsageLog: AIUsageEntry[];
  locale: string;
  onInsert: (text: string) => void;
}

const PURPOSE_OPTIONS = [
  { id: "brainstorming", pt: "Brainstorming de ideias", en: "Idea brainstorming" },
  { id: "draft", pt: "Rascunho de texto", en: "Text drafting" },
  { id: "rephrase", pt: "Revisão e reformulação", en: "Revision and rephrasing" },
  { id: "translation", pt: "Tradução", en: "Translation" },
  { id: "abstract", pt: "Geração de resumo/abstract", en: "Abstract generation" },
  { id: "data_analysis", pt: "Análise de dados", en: "Data analysis" },
  { id: "peer_review", pt: "Peer review simulado", en: "Simulated peer review" },
  { id: "hedging", pt: "Correção de hedging", en: "Hedging correction" },
  { id: "highlights", pt: "Geração de highlights", en: "Highlights generation" },
  { id: "consistency", pt: "Verificação de consistência", en: "Consistency check" },
];

const ACTION_TO_PURPOSE: Record<string, string> = {
  draft_section: "draft",
  continue_writing: "draft",
  rephrase: "rephrase",
  check_consistency: "consistency",
  peer_review: "peer_review",
  improve_hedging: "hedging",
  generate_abstract: "abstract",
  generate_highlights: "highlights",
  format_for_journal: "rephrase",
};

const PUBLISHER_FORMATS = [
  { id: "generic", label: "Genérico (COPE/ICMJE)" },
  { id: "elsevier", label: "Elsevier" },
  { id: "nature", label: "Nature / Springer" },
  { id: "scielo", label: "SciELO" },
  { id: "abnt", label: "ABNT" },
];

function generateDeclaration(
  tools: string[],
  purposes: string[],
  lang: "pt" | "en",
  format: string,
  additionalDetails: string
): string {
  const toolStr = tools.join(", ");
  const purposeLabels = purposes
    .map(id => PURPOSE_OPTIONS.find(p => p.id === id))
    .filter(Boolean)
    .map(p => p![lang])
    .join(", ");

  const detailSuffix = additionalDetails.trim()
    ? (lang === "pt" ? ` Detalhes adicionais: ${additionalDetails.trim()}.` : ` Additional details: ${additionalDetails.trim()}.`)
    : "";

  if (lang === "pt") {
    switch (format) {
      case "elsevier":
        return `Declaração de IA Generativa e Tecnologias Assistidas por IA no Processo de Escrita\n\nDurante a preparação deste trabalho, o(s) autor(es) utilizou(aram) ${toolStr} para ${purposeLabels.toLowerCase()}. Após a utilização da(s) ferramenta(s), o(s) autor(es) revisou(aram) e editou(aram) o conteúdo conforme necessário e assume(m) total responsabilidade pelo conteúdo da publicação.${detailSuffix}`;
      case "nature":
        return `Os autores declaram que utilizaram ${toolStr} durante a elaboração deste manuscrito para ${purposeLabels.toLowerCase()}. Todo o conteúdo gerado ou assistido por IA foi criticamente revisado, verificado e editado pelos autores, que assumem plena responsabilidade pela integridade e precisão do trabalho publicado.${detailSuffix}`;
      case "scielo":
        return `Declaração de Uso de Inteligência Artificial\n\nEste artigo contou com o auxílio de ${toolStr} para ${purposeLabels.toLowerCase()}. Os autores declaram que todo o conteúdo foi revisado, validado e editado por pesquisadores humanos, que assumem integral responsabilidade pela veracidade, originalidade e integridade científica do trabalho. A ferramenta de IA não é considerada autora ou coautora desta publicação.${detailSuffix}`;
      case "abnt":
        return `DECLARAÇÃO DE USO DE INTELIGÊNCIA ARTIFICIAL\n\nDurante a elaboração deste trabalho, o(s) autor(es) utilizou(aram) a ferramenta ${toolStr} para ${purposeLabels.toLowerCase()}. Após a utilização da ferramenta, os autores revisaram e editaram o conteúdo conforme necessário e assumem total responsabilidade pelo conteúdo da publicação, em conformidade com as diretrizes de integridade científica do CNPq.${detailSuffix}`;
      default:
        return `Durante a elaboração deste trabalho, o(s) autor(es) utilizou(aram) ${toolStr} para ${purposeLabels.toLowerCase()}. Após a utilização da(s) ferramenta(s), os autores revisaram e editaram o conteúdo conforme necessário e assumem total responsabilidade pelo conteúdo da publicação.${detailSuffix}`;
    }
  } else {
    switch (format) {
      case "elsevier":
        return `Declaration of Generative AI and AI-assisted Technologies in the Writing Process\n\nDuring the preparation of this work, the author(s) used ${toolStr} to ${purposeLabels.toLowerCase()}. After using this tool/service, the author(s) reviewed and edited the content as needed and take(s) full responsibility for the content of the publication.${detailSuffix}`;
      case "nature":
        return `The authors declare that they used ${toolStr} during the preparation of this manuscript to ${purposeLabels.toLowerCase()}. All AI-generated or AI-assisted content was critically reviewed, verified, and edited by the authors, who assume full responsibility for the integrity and accuracy of the published work.${detailSuffix}`;
      case "scielo":
        return `Artificial Intelligence Use Declaration\n\nThis article was prepared with the assistance of ${toolStr} for ${purposeLabels.toLowerCase()}. The authors declare that all content was reviewed, validated, and edited by human researchers, who assume full responsibility for the truthfulness, originality, and scientific integrity of the work. The AI tool is not considered an author or co-author of this publication.${detailSuffix}`;
      case "abnt":
        return `DECLARATION OF ARTIFICIAL INTELLIGENCE USE\n\nDuring the preparation of this work, the author(s) used ${toolStr} for ${purposeLabels.toLowerCase()}. After using the tool, the authors reviewed and edited the content as needed and take full responsibility for the content of the publication, in accordance with CNPq scientific integrity guidelines.${detailSuffix}`;
      default:
        return `During the preparation of this work, the author(s) used ${toolStr} to ${purposeLabels.toLowerCase()}. After using this tool/service, the author(s) reviewed and edited the content as needed and take(s) full responsibility for the content of the publication.${detailSuffix}`;
    }
  }
}

export default function AIDeclarationDialog({
  open,
  onOpenChange,
  aiUsageLog,
  locale,
  onInsert,
}: AIDeclarationDialogProps) {
  const pt = locale === "pt";

  // Derive auto-detected purposes from usage log
  const detectedPurposes = useMemo(() => {
    const purposes = new Set<string>();
    aiUsageLog.forEach(entry => {
      const mapped = ACTION_TO_PURPOSE[entry.action];
      if (mapped) purposes.add(mapped);
    });
    return purposes;
  }, [aiUsageLog]);

  const [tools, setTools] = useState<string[]>(["GPT-4o via Arca Research"]);
  const [newTool, setNewTool] = useState("");
  const [selectedPurposes, setSelectedPurposes] = useState<Set<string>>(detectedPurposes);
  const [lang, setLang] = useState<"pt" | "en">(pt ? "pt" : "en");
  const [publisherFormat, setPublisherFormat] = useState("generic");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [copied, setCopied] = useState(false);

  // Sync detected purposes when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSelectedPurposes(prev => {
        const merged = new Set(prev);
        detectedPurposes.forEach(p => merged.add(p));
        return merged;
      });
    }
    onOpenChange(v);
  };

  const togglePurpose = (id: string) => {
    setSelectedPurposes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTool = () => {
    const t = newTool.trim();
    if (t && !tools.includes(t)) {
      setTools(prev => [...prev, t]);
      setNewTool("");
    }
  };

  const removeTool = (t: string) => {
    setTools(prev => prev.filter(x => x !== t));
  };

  const declaration = useMemo(() => {
    if (tools.length === 0 || selectedPurposes.size === 0) return "";
    return generateDeclaration(tools, Array.from(selectedPurposes), lang, publisherFormat, additionalDetails);
  }, [tools, selectedPurposes, lang, publisherFormat, additionalDetails]);

  const handleCopy = () => {
    navigator.clipboard.writeText(declaration);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(pt ? "Declaração copiada" : "Declaration copied");
  };

  const handleInsert = () => {
    onInsert(declaration);
    onOpenChange(false);
    toast.success(pt ? "Declaração inserida no editor" : "Declaration inserted in editor");
  };

  // Count unique sections where AI was used
  const sectionsUsed = useMemo(() => {
    return new Set(aiUsageLog.map(e => e.section)).size;
  }, [aiUsageLog]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden border-border/30 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20 bg-gradient-to-r from-emerald-500/8 via-teal-500/5 to-transparent">
          <DialogTitle className="flex items-center gap-3 text-base">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            {pt ? "Declaração de Uso de IA" : "AI Usage Declaration"}
            <Badge variant="secondary" className="text-[10px] ml-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              {aiUsageLog.length} {pt ? "ações registradas" : "actions logged"}
            </Badge>
          </DialogTitle>
          {aiUsageLog.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1 ml-11">
              {pt
                ? `IA utilizada em ${sectionsUsed} seção(ões) do artigo`
                : `AI used in ${sectionsUsed} article section(s)`}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-180px)]">
          <div className="px-6 py-4 space-y-5">
            {/* Tools */}
            <div>
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5 mb-2">
                <Globe className="h-3.5 w-3.5 text-emerald-500" />
                {pt ? "Ferramentas de IA utilizadas" : "AI tools used"}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tools.map(t => (
                  <Badge key={t} className="text-[11px] h-6 gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15 pr-1">
                    {t}
                    <button onClick={() => removeTool(t)} className="ml-0.5 hover:text-destructive rounded-full p-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={newTool}
                  onChange={e => setNewTool(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTool()}
                  placeholder={pt ? "Adicionar ferramenta (ex: ChatGPT, Claude...)" : "Add tool (e.g. ChatGPT, Claude...)"}
                  className="h-8 text-xs flex-1 bg-background/80 border-border/40"
                />
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-emerald-500/20 hover:bg-emerald-500/10" onClick={addTool}>
                  <Plus className="h-3 w-3" /> {pt ? "Adicionar" : "Add"}
                </Button>
              </div>
            </div>

            <Separator className="bg-border/20" />

            {/* Purposes */}
            <div>
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5 mb-2.5">
                <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                {pt ? "Finalidades do uso" : "Usage purposes"}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PURPOSE_OPTIONS.map(opt => {
                  const isDetected = detectedPurposes.has(opt.id);
                  const isChecked = selectedPurposes.has(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                        isChecked
                          ? "bg-emerald-500/5 border-emerald-500/20 shadow-sm"
                          : "bg-card/30 border-border/20 hover:border-border/40"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => togglePurpose(opt.id)}
                        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <span className={isChecked ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {pt ? opt.pt : opt.en}
                      </span>
                      {isDetected && (
                        <Badge className="text-[8px] h-4 px-1 ml-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/10">
                          {pt ? "detectado" : "detected"}
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-border/20" />

            {/* Language + Format */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
                  {pt ? "Idioma da declaração" : "Declaration language"}
                </label>
                <Select value={lang} onValueChange={(v) => setLang(v as "pt" | "en")}>
                  <SelectTrigger className="h-8 text-xs bg-background/80 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Português (PT-BR)</SelectItem>
                    <SelectItem value="en">English (EN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
                  {pt ? "Formato da editora" : "Publisher format"}
                </label>
                <Select value={publisherFormat} onValueChange={setPublisherFormat}>
                  <SelectTrigger className="h-8 text-xs bg-background/80 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBLISHER_FORMATS.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional details */}
            <div>
              <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
                {pt ? "Detalhes adicionais (opcional)" : "Additional details (optional)"}
              </label>
              <Textarea
                value={additionalDetails}
                onChange={e => setAdditionalDetails(e.target.value)}
                placeholder={pt
                  ? "Ex: A IA foi usada apenas para melhorar a clareza do texto em inglês, sendo o conteúdo científico inteiramente produzido pelos autores..."
                  : "E.g. AI was used only to improve English text clarity, with all scientific content entirely produced by the authors..."}
                className="h-20 text-xs bg-background/80 border-border/40 resize-none"
              />
            </div>

            <Separator className="bg-border/20" />

            {/* Preview */}
            <div>
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5 text-emerald-500" />
                {pt ? "Preview da Declaração" : "Declaration Preview"}
              </label>
              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.03] to-teal-500/[0.03] p-4 shadow-sm">
                {declaration ? (
                  <p className="text-sm leading-[1.8] text-foreground/80 font-serif whitespace-pre-line">
                    {declaration}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/50 text-center py-4">
                    {pt
                      ? "Selecione ao menos uma ferramenta e uma finalidade para gerar a declaração"
                      : "Select at least one tool and one purpose to generate the declaration"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/20 bg-gradient-to-r from-emerald-500/5 to-transparent flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground/50 max-w-[280px]">
            {pt
              ? "A IA não pode ser listada como autora. A responsabilidade é integralmente dos autores humanos."
              : "AI cannot be listed as an author. Responsibility lies entirely with the human authors."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-emerald-500/20 hover:bg-emerald-500/10" onClick={handleCopy} disabled={!declaration}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? (pt ? "Copiado" : "Copied") : (pt ? "Copiar" : "Copy")}
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 shadow-sm shadow-emerald-500/20 border-0" onClick={handleInsert} disabled={!declaration}>
              <Plus className="h-3 w-3" />
              {pt ? "Inserir no Editor" : "Insert in Editor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
