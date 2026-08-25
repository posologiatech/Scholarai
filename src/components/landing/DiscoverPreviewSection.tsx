import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import DiscoverCard, { DiscoverItem } from "@/components/discover/DiscoverCard";
import AnimatedSection from "./AnimatedSection";

const DiscoverPreviewSection = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("discover_items")
      .select("id, title, source_label, summary, image_url, paper_url, published_at")
      .is("archived_at", null)
      .order("published_at", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("[DiscoverPreviewSection] fetch error:", error);
        setItems((data as DiscoverItem[]) || []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section className="border-t border-border/40 py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <AnimatedSection>
          <div className="mb-10 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Compass className="h-3.5 w-3.5" />
              {pt ? "Descobrir" : "Discover"}
            </span>
            <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              {pt ? "Publicações em destaque, todos os dias" : "Featured publications, every day"}
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              {pt
                ? "Resumo e ilustração gerados por IA para os artigos mais relevantes de NEJM, Nature, JAMA, The Lancet, BMJ e outros periódicos."
                : "AI-generated summary and cover art for the most relevant papers from NEJM, Nature, JAMA, The Lancet, BMJ and other journals."}
            </p>
          </div>
        </AnimatedSection>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <AnimatedSection key={item.id} delay={i * 0.05}>
                <DiscoverCard item={item} />
              </AnimatedSection>
            ))}
          </div>
        )}

        <AnimatedSection>
          <div className="mt-10 text-center">
            <Link
              to="/discover"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {pt ? "Ver tudo no Descobrir" : "See everything in Discover"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default DiscoverPreviewSection;
