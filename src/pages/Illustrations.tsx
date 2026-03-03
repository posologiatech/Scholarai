import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Download, Trash2, RefreshCw, Sparkles, Image as ImageIcon, Wand2, Layers, FileImage, ChevronDown, BookOpen } from "lucide-react";
import IllustrationTemplates from "@/components/app/IllustrationTemplates";
import IllustrationEditor from "@/components/app/IllustrationEditor";
import jsPDF from "jspdf";

interface Illustration {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
}

const STYLES = [
  { value: "biorender", label: { pt: "BioRender (Flat)", en: "BioRender (Flat)" } },
  { value: "textbook", label: { pt: "Livro-texto", en: "Textbook" } },
  { value: "3d", label: { pt: "3D Render", en: "3D Render" } },
  { value: "watercolor", label: { pt: "Aquarela Científica", en: "Scientific Watercolor" } },
  { value: "minimal", label: { pt: "Minimalista", en: "Minimal" } },
  { value: "infographic", label: { pt: "Infográfico", en: "Infographic" } },
];

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
  const [variationCount, setVariationCount] = useState(1);

  // Graphical abstract
  const [gaTitle, setGaTitle] = useState("");
  const [gaAbstract, setGaAbstract] = useState("");
  const [showGA, setShowGA] = useState(false);

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
      const dataUrl = canvas.toDataURL(mime, 0.95);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${baseName}.${format}`;
      a.click();
    }
  };

  return (
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
              ? "Gere, edite e exporte ilustrações profissionais com IA. Templates por área, múltiplos estilos e Graphical Abstracts automáticos."
              : "Generate, edit, and export professional illustrations with AI. Templates by field, multiple styles, and automatic Graphical Abstracts."}
          </p>
        </div>

        {/* Tabs: Generate / Graphical Abstract */}
        <div className="flex gap-2 justify-center">
          <Button variant={!showGA ? "default" : "outline"} size="sm" onClick={() => setShowGA(false)}>
            <Sparkles className="h-4 w-4 mr-1" />
            {pt ? "Gerar Ilustração" : "Generate Illustration"}
          </Button>
          <Button variant={showGA ? "default" : "outline"} size="sm" onClick={() => setShowGA(true)}>
            <BookOpen className="h-4 w-4 mr-1" />
            Graphical Abstract
          </Button>
        </div>

        {/* Templates */}
        {!showGA && (
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
        )}

        {/* Generator form */}
        {!showGA ? (
          <div className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={pt
                ? "Descreva a ilustração científica que você precisa..."
                : "Describe the scientific illustration you need..."}
              className="min-h-[100px] text-base"
              disabled={generating}
            />

            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{pt ? "Estilo" : "Style"}</label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label[pt ? "pt" : "en"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{pt ? "Variações" : "Variations"}</label>
                <Select value={String(variationCount)} onValueChange={(v) => setVariationCount(Number(v))}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="flex-1 min-w-[160px]">
                {generating ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{pt ? "Gerando..." : "Generating..."}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />{pt ? "Gerar Ilustração" : "Generate Illustration"}</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Graphical Abstract mode */
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
                placeholder={pt ? "Ex: Foque na metodologia, use cores azuis..." : "E.g., Focus on methodology, use blue colors..."}
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
                {generating ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{pt ? "Gerando..." : "Generating..."}</>
                ) : (
                  <><BookOpen className="h-4 w-4 mr-2" />{pt ? "Gerar Graphical Abstract" : "Generate Graphical Abstract"}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {generating && (
          <div className="rounded-xl border border-border bg-muted/30 p-8 flex flex-col items-center gap-4">
            <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">
              {variationCount > 1
                ? (pt ? `Gerando ${variationCount} variações... Pode levar até 1 minuto.` : `Generating ${variationCount} variations... May take up to 1 minute.`)
                : (pt ? "A IA está criando sua ilustração. Pode levar até 30 segundos." : "AI is creating your illustration. May take up to 30 seconds.")}
            </p>
          </div>
        )}

        {/* Current results */}
        {currentImages.length > 0 && !generating && (
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
                        <Download className="h-4 w-4 mr-1" />
                        {pt ? "Exportar" : "Export"}
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => downloadAs(img.url, prompt, "png")}>PNG</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadAs(img.url, prompt, "jpg")}>JPG</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadAs(img.url, prompt, "pdf")}>PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" onClick={() => setEditTarget({ url: img.url, prompt })}>
                    <Wand2 className="h-4 w-4 mr-1" />
                    {pt ? "Editar com IA" : "Edit with AI"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gallery */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            {pt ? "Minhas Ilustrações" : "My Illustrations"}
          </h2>

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
                  <div className="aspect-[4/3] bg-white">
                    <img src={item.image_url} alt={item.prompt} className="w-full h-full object-contain" />
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.prompt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1">
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
    </div>
  );
};

export default Illustrations;
