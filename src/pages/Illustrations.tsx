import { useState, useEffect } from "react";
import { UpgradeGate } from "@/components/app/UpgradeGate";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Download, Trash2, RefreshCw, Sparkles, Image as ImageIcon, Wand2, Layers, ChevronDown, BookOpen, PenTool, Globe } from "lucide-react";
import IllustrationTemplates from "@/components/app/IllustrationTemplates";
import IllustrationEditor from "@/components/app/IllustrationEditor";
import IllustrationAnnotator from "@/components/app/IllustrationAnnotator";
import IllustrationCommunity from "@/components/app/IllustrationCommunity";
import jsPDF from "jspdf";

interface Illustration {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
  is_public?: boolean;
  category?: string | null;
}

const STYLES = [
  { value: "biorender", label: { pt: "BioRender (Flat)", en: "BioRender (Flat)" } },
  { value: "textbook", label: { pt: "Livro-texto", en: "Textbook" } },
  { value: "3d", label: { pt: "3D Render", en: "3D Render" } },
  { value: "watercolor", label: { pt: "Aquarela Científica", en: "Scientific Watercolor" } },
  { value: "minimal", label: { pt: "Minimalista", en: "Minimal" } },
  { value: "infographic", label: { pt: "Infográfico", en: "Infographic" } },
];

const CATEGORIES = [
  { value: "biology", label: { pt: "Biologia", en: "Biology" } },
  { value: "medicine", label: { pt: "Medicina", en: "Medicine" } },
  { value: "chemistry", label: { pt: "Química", en: "Chemistry" } },
  { value: "methods", label: { pt: "Métodos", en: "Methods" } },
  { value: "other", label: { pt: "Outros", en: "Other" } },
];

type MainTab = "generate" | "graphical" | "community";

const Illustrations = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("biorender");
  const [generating, setGenerating] = useState(false);
  const [currentImages, setCurrentImages] = useState<{ id: string; url: string }[]>([]);
  const [gallery, setGallery] = useState<Illustration[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editTarget, setEditTarget] = useState<{ url: string; prompt: string } | null>(null);
  const [annotateTarget, setAnnotateTarget] = useState<string | null>(null);
  const [variationCount, setVariationCount] = useState(1);
  const [mainTab, setMainTab] = useState<MainTab>("generate");

  // Graphical abstract
  const [gaTitle, setGaTitle] = useState("");
  const [gaAbstract, setGaAbstract] = useState("");

  useEffect(() => { fetchGallery(); }, []);

  const fetchGallery = async () => {
    setLoadingGallery(true);
    const { data } = await supabase.from("illustrations").select("*").order("created_at", { ascending: false });
    setGallery((data as Illustration[]) || []);
    setLoadingGallery(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setCurrentImages([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-illustration", {
        body: { prompt: prompt.trim(), style, variations: variationCount },
      });
      if (error) { toast.error((error as any)?.message || "Error"); return; }
      if (data?.error) { toast.error(data.error); return; }
      if (data.variations) {
        setCurrentImages(data.variations.map((v: any) => ({ id: v.id, url: v.image_url })));
      } else {
        setCurrentImages([{ id: data.id, url: data.image_url }]);
      }
      toast.success(pt ? "Ilustração gerada!" : "Illustration generated!");
      fetchGallery();
    } catch { toast.error(pt ? "Erro inesperado" : "Unexpected error"); }
    finally { setGenerating(false); }
  };

  const handleGenerateGA = async () => {
    if (!gaTitle.trim() || !gaAbstract.trim()) return;
    setGenerating(true);
    setCurrentImages([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-illustration", {
        body: { paperContext: { title: gaTitle.trim(), abstract: gaAbstract.trim() }, style, prompt: prompt.trim() || undefined },
      });
      if (error) { toast.error((error as any)?.message || "Error"); return; }
      if (data?.error) { toast.error(data.error); return; }
      setCurrentImages([{ id: data.id, url: data.image_url }]);
      toast.success(pt ? "Graphical Abstract gerado!" : "Graphical Abstract generated!");
      fetchGallery();
    } catch { toast.error(pt ? "Erro inesperado" : "Unexpected error"); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (item: Illustration) => {
    const urlParts = item.image_url.split("/illustrations/");
    const filePath = urlParts[urlParts.length - 1];
    await supabase.storage.from("illustrations").remove([filePath]);
    const { error } = await supabase.from("illustrations").delete().eq("id", item.id);
    if (error) { toast.error("Error"); return; }
    toast.success(pt ? "Removida." : "Deleted.");
    setGallery((prev) => prev.filter((i) => i.id !== item.id));
  };

  const togglePublic = async (item: Illustration) => {
    const newVal = !item.is_public;
    const { error } = await supabase.from("illustrations").update({ is_public: newVal } as any).eq("id", item.id);
    if (error) { toast.error("Error"); return; }
    setGallery((prev) => prev.map((i) => i.id === item.id ? { ...i, is_public: newVal } : i));
    toast.success(newVal
      ? (pt ? "Compartilhada na comunidade!" : "Shared with community!")
      : (pt ? "Removida da comunidade." : "Removed from community."));
  };

  const updateCategory = async (item: Illustration, category: string) => {
    await supabase.from("illustrations").update({ category } as any).eq("id", item.id);
    setGallery((prev) => prev.map((i) => i.id === item.id ? { ...i, category } : i));
  };

  const downloadAs = async (url: string, promptText: string, format: "png" | "pdf" | "jpg") => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise((r) => { img.onload = r; img.onerror = r; });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const baseName = `illustration-${promptText.slice(0, 30).replace(/\s+/g, "-")}`;
    if (format === "pdf") {
      const orientation = img.naturalWidth > img.naturalHeight ? "landscape" as const : "portrait" as const;
      const pdf = new jsPDF({ orientation, unit: "px", format: [img.naturalWidth, img.naturalHeight] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, img.naturalWidth, img.naturalHeight);
      pdf.save(`${baseName}.pdf`);
    } else {
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const a = document.createElement("a");
      a.href = canvas.toDataURL(mime, 0.95);
      a.download = `${baseName}.${format}`;
      a.click();
    }
  };

  const handleUsePromptFromCommunity = (p: string) => {
    setPrompt(p);
    setMainTab("generate");
  };

  return (
    <UpgradeGate feature="illustrations">
    <div className="min-h-screen bg-background">
      <main className="container py-8 space-y-8 max-w-5xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display text-foreground flex items-center justify-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            {pt ? "Studio de Ilustrações Científicas" : "Scientific Illustration Studio"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {pt
              ? "Gere, edite, anote e compartilhe ilustrações profissionais com IA."
              : "Generate, edit, annotate, and share professional illustrations with AI."}
          </p>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 justify-center flex-wrap">
          <Button variant={mainTab === "generate" ? "default" : "outline"} size="sm" onClick={() => setMainTab("generate")}>
            <Sparkles className="h-4 w-4 mr-1" />
            {pt ? "Gerar" : "Generate"}
          </Button>
          <Button variant={mainTab === "graphical" ? "default" : "outline"} size="sm" onClick={() => setMainTab("graphical")}>
            <BookOpen className="h-4 w-4 mr-1" />
            Graphical Abstract
          </Button>
          <Button variant={mainTab === "community" ? "default" : "outline"} size="sm" onClick={() => setMainTab("community")}>
            <Globe className="h-4 w-4 mr-1" />
            {pt ? "Explorar" : "Discover"}
          </Button>
        </div>

        {/* Community tab */}
        {mainTab === "community" && (
          <IllustrationCommunity onUsePrompt={handleUsePromptFromCommunity} />
        )}

        {/* Generate tab */}
        {mainTab === "generate" && (
          <>
            {/* Templates */}
            <div className="space-y-2">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Layers className="h-4 w-4" />
                {pt ? "Templates por área científica" : "Templates by scientific field"}
                <ChevronDown className={`h-3 w-3 transition-transform ${showTemplates ? "rotate-180" : ""}`} />
              </button>
              {showTemplates && <IllustrationTemplates onSelect={(p) => { setPrompt(p); setShowTemplates(false); }} />}
            </div>

            <div className="space-y-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={pt ? "Descreva a ilustração científica que você precisa..." : "Describe the scientific illustration you need..."}
                className="min-h-[100px] text-base"
                disabled={generating}
              />
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{pt ? "Estilo" : "Style"}</label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label[pt ? "pt" : "en"]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{pt ? "Variações" : "Variations"}</label>
                  <Select value={String(variationCount)} onValueChange={(v) => setVariationCount(Number(v))}>
                    <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="flex-1 min-w-[160px]">
                  {generating
                    ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{pt ? "Gerando..." : "Generating..."}</>
                    : <><Sparkles className="h-4 w-4 mr-2" />{pt ? "Gerar Ilustração" : "Generate Illustration"}</>}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Graphical Abstract tab */}
        {mainTab === "graphical" && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <div className="space-y-1">
              <label className="text-sm font-medium">{pt ? "Título do Paper" : "Paper Title"}</label>
              <input
                value={gaTitle}
                onChange={(e) => setGaTitle(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={pt ? "Cole o título do artigo..." : "Paste the paper title..."}
                disabled={generating}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Abstract</label>
              <Textarea
                value={gaAbstract}
                onChange={(e) => setGaAbstract(e.target.value)}
                placeholder={pt ? "Cole o abstract do artigo..." : "Paste the paper abstract..."}
                className="min-h-[120px]"
                disabled={generating}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{pt ? "Instruções adicionais (opcional)" : "Additional instructions (optional)"}</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={pt ? "Ex: Foque na metodologia..." : "E.g., Focus on methodology..."}
                className="min-h-[60px]"
                disabled={generating}
              />
            </div>
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{pt ? "Estilo" : "Style"}</label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label[pt ? "pt" : "en"]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerateGA} disabled={generating || !gaTitle.trim() || !gaAbstract.trim()} className="flex-1">
                {generating
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{pt ? "Gerando..." : "Generating..."}</>
                  : <><BookOpen className="h-4 w-4 mr-2" />{pt ? "Gerar Graphical Abstract" : "Generate Graphical Abstract"}</>}
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {generating && mainTab !== "community" && (
          <div className="rounded-xl border border-border bg-muted/30 p-8 flex flex-col items-center gap-4">
            <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">
              {variationCount > 1
                ? (pt ? `Gerando ${variationCount} variações...` : `Generating ${variationCount} variations...`)
                : (pt ? "A IA está criando sua ilustração..." : "AI is creating your illustration...")}
            </p>
          </div>
        )}

        {/* Current results */}
        {currentImages.length > 0 && !generating && mainTab !== "community" && (
          <div className={`grid gap-4 ${currentImages.length > 1 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 max-w-3xl mx-auto"}`}>
            {currentImages.map((img, idx) => (
              <div key={img.id} className="rounded-xl border border-border overflow-hidden bg-card">
                {currentImages.length > 1 && (
                  <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">{pt ? `Variação ${idx + 1}` : `Variation ${idx + 1}`}</span>
                  </div>
                )}
                <img src={img.url} alt={prompt} className="w-full object-contain max-h-[500px] bg-white" />
                <div className="p-3 flex gap-2 flex-wrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" /> {pt ? "Exportar" : "Export"} <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => downloadAs(img.url, prompt, "png")}>PNG</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadAs(img.url, prompt, "jpg")}>JPG</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadAs(img.url, prompt, "pdf")}>PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" onClick={() => setEditTarget({ url: img.url, prompt })}>
                    <Wand2 className="h-4 w-4 mr-1" /> {pt ? "Editar" : "Edit"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAnnotateTarget(img.url)}>
                    <PenTool className="h-4 w-4 mr-1" /> {pt ? "Anotar" : "Annotate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gallery */}
        {mainTab !== "community" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">{pt ? "Minhas Ilustrações" : "My Illustrations"}</h2>

            {loadingGallery ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
              </div>
            ) : gallery.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">{pt ? "Nenhuma ilustração ainda." : "No illustrations yet."}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gallery.map((item) => (
                  <div key={item.id} className="group rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow">
                    <div className="aspect-[4/3] bg-white relative">
                      <img src={item.image_url} alt={item.prompt} className="w-full h-full object-contain" />
                      {item.is_public && (
                        <span className="absolute top-2 right-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {pt ? "Pública" : "Public"}
                        </span>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.prompt}</p>

                      {/* Share toggle + category */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={!!item.is_public}
                            onCheckedChange={() => togglePublic(item)}
                            className="scale-75"
                          />
                          <span className="text-[10px] text-muted-foreground">{pt ? "Comunidade" : "Community"}</span>
                        </div>
                        {item.is_public && (
                          <Select value={item.category || ""} onValueChange={(v) => updateCategory(item, v)}>
                            <SelectTrigger className="h-6 w-[100px] text-[10px]"><SelectValue placeholder={pt ? "Categoria" : "Category"} /></SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label[pt ? "pt" : "en"]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAnnotateTarget(item.image_url)} title={pt ? "Anotar" : "Annotate"}>
                            <PenTool className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget({ url: item.image_url, prompt: item.prompt })}>
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => downloadAs(item.image_url, item.prompt, "png")}>PNG</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadAs(item.image_url, item.prompt, "jpg")}>JPG</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadAs(item.image_url, item.prompt, "pdf")}>PDF</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Editor Modal */}
      {editTarget && (
        <IllustrationEditor
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          imageUrl={editTarget.url}
          originalPrompt={editTarget.prompt}
          onEdited={fetchGallery}
        />
      )}

      {/* Annotator Modal */}
      {annotateTarget && (
        <IllustrationAnnotator
          open={!!annotateTarget}
          onClose={() => setAnnotateTarget(null)}
          imageUrl={annotateTarget}
        />
      )}
    </div>
  );
};

export default Illustrations;
