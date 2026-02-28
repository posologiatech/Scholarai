import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
// AppSidebar provided by ProtectedRoute
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, Trash2, RefreshCw, Sparkles, Image as ImageIcon } from "lucide-react";

interface Illustration {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
}

const Illustrations = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<{ id: string; url: string } | null>(null);
  const [gallery, setGallery] = useState<Illustration[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    setLoadingGallery(true);
    const { data, error } = await supabase
      .from("illustrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching illustrations:", error);
    } else {
      setGallery((data as Illustration[]) || []);
    }
    setLoadingGallery(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setCurrentImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-illustration", {
        body: { prompt: prompt.trim() },
      });

      if (error) {
        const msg = (error as any)?.message || "Error generating illustration";
        toast.error(msg);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setCurrentImage({ id: data.id, url: data.image_url });
      toast.success(t("illustrations.generated"));
      fetchGallery();
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (illustration: Illustration) => {
    // Extract file path from URL
    const urlParts = illustration.image_url.split("/illustrations/");
    const filePath = urlParts[urlParts.length - 1];

    const { error: storageError } = await supabase.storage
      .from("illustrations")
      .remove([filePath]);

    if (storageError) console.error("Storage delete error:", storageError);

    const { error: dbError } = await supabase
      .from("illustrations")
      .delete()
      .eq("id", illustration.id);

    if (dbError) {
      toast.error("Error deleting illustration");
      return;
    }

    toast.success(t("illustrations.deleted"));
    setGallery((prev) => prev.filter((i) => i.id !== illustration.id));
    if (currentImage?.id === illustration.id) setCurrentImage(null);
  };

  const handleDownload = (url: string, prompt: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `illustration-${prompt.slice(0, 30).replace(/\s+/g, "-")}.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container py-8 space-y-8">
        {/* Generator Section */}
        <section className="max-w-3xl mx-auto space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold font-display text-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              {t("illustrations.title")}
            </h1>
            <p className="text-muted-foreground">{t("illustrations.subtitle")}</p>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("illustrations.placeholder")}
            className="min-h-[120px] text-base"
            disabled={generating}
          />

          {/* Example prompt chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { pt: "Diagrama da replicação do SARS-CoV-2", en: "SARS-CoV-2 replication diagram" },
              { pt: "Ciclo de Krebs com enzimas", en: "Krebs cycle with enzymes" },
              { pt: "Sinapse neuronal com neurotransmissores", en: "Neuronal synapse with neurotransmitters" },
              { pt: "Estrutura do DNA com bases nitrogenadas", en: "DNA structure with nitrogenous bases" },
            ].map((example, i) => {
              const label = example[locale as "pt" | "en"] || example.en;
              return (
                <button
                  key={i}
                  onClick={() => setPrompt(label)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="flex-1">
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t("illustrations.generating")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t("illustrations.generate")}
                </>
              )}
            </Button>
          </div>

          {/* Loading state */}
          {generating && (
            <div className="rounded-xl border border-border bg-muted/30 p-8 flex flex-col items-center gap-4">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
              <p className="text-muted-foreground text-sm">{t("illustrations.generatingHint")}</p>
            </div>
          )}

          {/* Current result */}
          {currentImage && !generating && (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <img src={currentImage.url} alt={prompt} className="w-full object-contain max-h-[600px] bg-white" />
              <div className="p-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDownload(currentImage.url, prompt)}>
                  <Download className="h-4 w-4 mr-1" />
                  {t("illustrations.download")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentImage(null);
                    handleGenerate();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {t("illustrations.regenerate")}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Gallery */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{t("illustrations.gallery")}</h2>

          {loadingGallery ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
              ))}
            </div>
          ) : gallery.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{t("illustrations.emptyGallery")}</p>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDownload(item.image_url, item.prompt)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(item)}
                        >
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
    </div>
  );
};

export default Illustrations;
