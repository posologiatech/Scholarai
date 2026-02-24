import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe, GraduationCap, ChevronDown } from "lucide-react";

const Header = () => {
  const { t, locale, setLocale } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleLocale = () => setLocale(locale === "pt" ? "en" : "pt");

  const navLinks = [
    { label: t("nav.solutions"), href: "/solutions" },
    { label: t("nav.useCases"), href: "/use-cases" },
    { label: t("nav.about"), href: "/about" },
    { label: t("nav.faq"), href: "/faq" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/95 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-foreground">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-display">ScholarAI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{locale.toUpperCase()}</span>
          </button>
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-sm">
              {t("nav.login")}
            </Button>
          </Link>
          <Link to="/signup">
            <Button
              size="sm"
              className="rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90"
            >
              {t("nav.getStarted")}
            </Button>
          </Link>
        </div>

        {/* Mobile */}
        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background p-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-border" />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleLocale}>
                <Globe className="mr-1 h-4 w-4" />
                {locale === "pt" ? "English" : "Português"}
              </Button>
            </div>
            <Link to="/login" onClick={() => setMenuOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">{t("nav.login")}</Button>
            </Link>
            <Link to="/signup" onClick={() => setMenuOpen(false)}>
              <Button size="sm" className="w-full bg-foreground text-background">{t("nav.getStarted")}</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
