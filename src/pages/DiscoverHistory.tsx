import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Compass } from "lucide-react";
import DiscoverCard, { DiscoverItem } from "@/components/discover/DiscoverCard";

const PAGE_SIZE = 24;

interface DateGroup {
  dateKey: string;
  items: DiscoverItem[];
}

const groupByDate = (items: DiscoverItem[]): DateGroup[] => {
  const groups: DateGroup[] = [];
  for (const item of items) {
    const dateKey = item.published_at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey) {
      last.items.push(item);
    } else {
      groups.push({ dateKey, items: [item] });
    }
  }
  return groups;
};

const DiscoverHistory = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (pageIndex: number) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("discover_items")
      .select("id, title, source_label, summary, image_url, paper_url, published_at")
      .order("published_at", { ascending: false })
      .range(from, to);
    if (error) console.error("[DiscoverHistory] fetch error:", error);
    const newItems = (data as DiscoverItem[]) || [];
    setItems((prev) => (pageIndex === 0 ? newItems : [...prev, ...newItems]));
    setHasMore(newItems.length === PAGE_SIZE);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPage(0).finally(() => setLoading(false));
  }, [loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (!hasMore || loading || loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        const nextPage = pageRef.current + 1;
        pageRef.current = nextPage;
        loadPage(nextPage).finally(() => {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        });
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPage]);

  const formatDateHeading = (iso: string) =>
    new Date(iso).toLocaleDateString(pt ? "pt-BR" : "en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const groups = groupByDate(items);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <Link
              to="/discover"
              className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {pt ? "Voltar para Descobrir" : "Back to Discover"}
            </Link>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {pt ? "Histórico do Descobrir" : "Discover History"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {pt
                ? "Linha do tempo com tudo que já passou pelo Descobrir."
                : "A timeline of everything that has ever appeared in Discover."}
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
                {pt ? "Nada no histórico ainda." : "Nothing in the history yet."}
              </p>
            </div>
          )}

          {!loading &&
            groups.map((group) => (
              <div key={group.dateKey} className="space-y-3">
                <div className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
                  <h2 className="text-sm font-semibold text-foreground">
                    {formatDateHeading(group.items[0].published_at)}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((item) => (
                    <DiscoverCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}

          <div ref={sentinelRef} className="h-4" />

          {loadingMore && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
              ))}
            </div>
          )}

          {!loading && !hasMore && items.length > 0 && (
            <p className="pb-4 text-center text-sm text-muted-foreground">
              {pt ? "Fim do histórico." : "End of history."}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default DiscoverHistory;
