import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Compass } from "lucide-react";

interface DiscoverItem {
  id: string;
  title: string;
  source_label: string;
  summary: string;
  image_url: string;
  paper_url: string | null;
  published_at: string;
}

const Discover = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("discover_items")
      .select("id, title, source_label, summary, image_url, paper_url, published_at")
      .order("published_at", { ascending: false })
      .limit(30);
    if (error) console.error("[Discover] fetch error:", error);
    setItems((data as DiscoverItem[]) || []);
    setLoading(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(pt ? "pt-BR" : "en-US", { day: "2-digit", month: "short" });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {pt ? "Descobrir" : "Discover"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {pt ? "Publicações científicas em destaque, atualizadas periodicamente." : "Featured scientific publications, refreshed periodically."}
            </p>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Compass className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {pt ? "Nenhum destaque disponível ainda." : "No featured papers yet."}
              </p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.paper_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow flex flex-col"
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover bg-muted"
                  />
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {item.source_label}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(item.published_at)}</span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-foreground leading-snug line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">{item.summary}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Discover;
