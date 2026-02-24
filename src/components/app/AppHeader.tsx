import { Link, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { GraduationCap, Globe, LogOut, BookOpen, Table, FileText, LayoutDashboard, Shield } from "lucide-react";

const AppHeader = () => {
  const { t, locale, setLocale } = useLanguage();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleLocale = () => setLocale(locale === "pt" ? "en" : "pt");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navLinks = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.library"), href: "/library", icon: BookOpen },
    { label: t("nav.extraction"), href: "/extraction", icon: Table },
    { label: t("nav.reports"), href: "/reports", icon: FileText },
    ...(isAdmin ? [{ label: t("nav.admin"), href: "/admin", icon: Shield }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <GraduationCap className="h-6 w-6 text-primary" />
            ScholarAI
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  location.pathname === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleLocale} aria-label="Toggle language">
            <Globe className="h-4 w-4" />
          </Button>
          <span className="hidden text-sm text-muted-foreground truncate max-w-[150px] sm:block">
            {user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label={t("dashboard.signOut")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
