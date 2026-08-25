import { useLanguage } from "@/i18n/LanguageContext";

export interface DiscoverItem {
  id: string;
  title: string;
  source_label: string;
  summary: string;
  image_url: string;
  paper_url: string | null;
  published_at: string;
}

const DiscoverCard = ({ item }: { item: DiscoverItem }) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(pt ? "pt-BR" : "en-US", { day: "2-digit", month: "short" });

  return (
    <a
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
  );
};

export default DiscoverCard;
