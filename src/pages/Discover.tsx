import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Compass, History } from "lucide-react";
import DiscoverCard, { DiscoverItem } from "@/components/discover/DiscoverCard";

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
      .is("archived_at", null)
      .order("published_at", { ascending: false })
      .limit(30);
    if (error) console.error("[Discover] fetch error:", error);
    setItems((data as DiscoverItem[]) || []);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {pt ? "Descobrir" : "Discover"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {pt ? "Publicações científicas em destaque, atualizadas periodicamente." : "Featured scientific publications, refreshed periodically."}
              </p>
            </div>
            <Link
              to="/discover/history"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <History className="h-4 w-4" />
              {pt ? "Histórico" : "History"}
            </Link>
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
                <DiscoverCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Discover;
