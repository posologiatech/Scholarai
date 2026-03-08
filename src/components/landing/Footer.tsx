import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCookieConsent } from "@/hooks/useCookieConsent";

const Footer = () => {
  const { t, locale } = useLanguage();
  const { resetBanner } = useCookieConsent();

  const columns = [
    {
      title: t("footer.product"),
      links: [
        { label: t("footer.searchArticles"), href: "/solutions/search" },
        { label: t("footer.systematicReview"), href: "/solutions/review" },
        { label: t("footer.alerts"), href: "/solutions/alerts" },
        { label: t("footer.aiReports"), href: "/solutions/reports" },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: t("footer.helpCenter"), href: "/faq" },
        { label: t("footer.blog"), href: "/blog" },
        { label: t("footer.docs"), href: "/docs" },
        { label: t("footer.contact"), href: "/contact" },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { label: t("footer.terms"), href: "/terms" },
        { label: t("footer.privacy"), href: "/privacy" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <GraduationCap className="h-6 w-6 text-primary" />
              ScholarAI
            </Link>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-sm font-semibold text-foreground">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ScholarAI. {t("footer.rights")} — Desenvolvido por Sérgio Araújo. Posologia Produções
        </div>
      </div>
    </footer>
  );
};

export default Footer;
