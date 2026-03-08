import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import CookieSettingsDialog from "./CookieSettingsDialog";
import { Cookie } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CookieBanner = () => {
  const { locale } = useLanguage();
  const { decided, acceptAll, rejectAll } = useCookieConsent();
  const [showSettings, setShowSettings] = useState(false);

  if (decided) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-lg"
        >
          <div className="container mx-auto flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:max-w-xl">
              <Cookie className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {locale === "pt"
                    ? "Utilizamos cookies para melhorar sua experiência"
                    : "We use cookies to improve your experience"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === "pt"
                    ? "Cookies essenciais são necessários para o funcionamento. Cookies funcionais e analíticos são opcionais. "
                    : "Essential cookies are required for operation. Functional and analytical cookies are optional. "}
                  <Link to="/privacy" className="underline hover:text-foreground">
                    {locale === "pt" ? "Política de Privacidade" : "Privacy Policy"}
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="text-xs"
              >
                {locale === "pt" ? "Personalizar" : "Customize"}
              </Button>
              <Button variant="outline" size="sm" onClick={rejectAll} className="text-xs">
                {locale === "pt" ? "Apenas essenciais" : "Essential only"}
              </Button>
              <Button size="sm" onClick={acceptAll} className="text-xs">
                {locale === "pt" ? "Aceitar todos" : "Accept all"}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <CookieSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
};

export default CookieBanner;
