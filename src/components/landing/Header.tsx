import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe, GraduationCap } from "lucide-react";

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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
          <GraduationCap className="h-7 w-7 text-primary" />
          ScholarAI
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="icon" onClick={toggleLocale} aria-label="Toggle language">
            <Globe className="h-4 w-4" />
            <span className="ml-1 text-xs font-medium">{locale.toUpperCase()}</span>
          </Button>
          <Link to="/login">
            <Button variant="ghost" size="sm">{t("nav.login")}</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("nav.getStarted")}
            </Button>
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="border-t border-border bg-background p-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
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
              <Button size="sm" className="w-full bg-primary text-primary-foreground">{t("nav.getStarted")}</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
