import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Globe, Copy, Search, Image as ImageIcon } from "lucide-react";

interface PublicIllustration {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
  category: string | null;
  style: string | null;
}

const CATEGORIES = [
  { value: "all", label: { pt: "Todas", en: "All" } },
  { value: "biology", label: { pt: "Biologia", en: "Biology" } },
  { value: "medicine", label: { pt: "Medicina", en: "Medicine" } },
  { value: "chemistry", label: { pt: "Química", en: "Chemistry" } },
  { value: "methods", label: { pt: "Métodos", en: "Methods" } },
  { value: "other", label: { pt: "Outros", en: "Other" } },
];

interface Props {
  onUsePrompt: (prompt: string) => void;
}

export default function IllustrationCommunity({ onUsePrompt }: Props) {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [items, setItems] = useState<PublicIllustration[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    fetchPublic();
  }, [category]);

  const fetchPublic = async () => {
    setLoading(true);
    let query = supabase
      .from("illustrations")
      .select("id, prompt, image_url, created_at, category, style")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(30);

    if (category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) console.error(error);
    setItems((data as PublicIllustration[]) || []);
    setLoading(false);
  };

  const handleUsePrompt = (prompt: string) => {
    // Strip metadata prefixes
    const clean = prompt.replace(/^\[(Edit|Graphical Abstract|Variation \d+)\]\s*/i, "");
    onUsePrompt(clean);
    toast.success(pt ? "Prompt copiado para o gerador!" : "Prompt copied to generator!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{pt ? "Explorar Comunidade" : "Explore Community"}</h2>
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label[pt ? "pt" : "en"]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {pt ? "Nenhuma ilustração compartilhada nesta categoria ainda." : "No shared illustrations in this category yet."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pt ? "Compartilhe suas ilustrações para que outros pesquisadores possam se inspirar!" : "Share your illustrations so other researchers can get inspired!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="group rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow">
              <div className="aspect-[4/3] bg-white">
                <img src={item.image_url} alt={item.prompt} className="w-full h-full object-contain" />
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{item.prompt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {item.category && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {item.category}
                      </span>
                    )}
                    {item.style && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {item.style}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleUsePrompt(item.prompt)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {pt ? "Usar prompt" : "Use prompt"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
