import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, Globe, LogOut, Search } from "lucide-react";

const AppHeader = () => {
  const { t, locale, setLocale } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleLocale = () => setLocale(locale === "pt" ? "en" : "pt");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <GraduationCap className="h-6 w-6 text-primary" />
          ScholarAI
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleLocale} aria-label="Toggle language">
            <Globe className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground truncate max-w-[150px]">
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
