import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { Shield, Cookie, BarChart3 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CookieSettingsDialog = ({ open, onOpenChange }: Props) => {
  const { locale } = useLanguage();
  const { functional, analytical, saveCustom } = useCookieConsent();
  const [localFunctional, setLocalFunctional] = useState(functional);
  const [localAnalytical, setLocalAnalytical] = useState(analytical);

  const handleSave = () => {
    saveCustom(localFunctional, localAnalytical);
    onOpenChange(false);
  };

  const categories = [
    {
      id: "essential" as const,
      icon: Shield,
      name: locale === "pt" ? "Essenciais" : "Essential",
      desc: locale === "pt"
        ? "Necessários para o funcionamento básico: sessão de autenticação, preferência de idioma e estado da interface."
        : "Required for basic functionality: authentication session, language preference, and UI state.",
      examples: locale === "pt" ? "Supabase Auth, idioma, sidebar" : "Supabase Auth, language, sidebar",
      enabled: true,
      locked: true,
      onChange: () => {},
    },
    {
      id: "functional" as const,
      icon: Cookie,
      name: locale === "pt" ? "Funcionais" : "Functional",
      desc: locale === "pt"
        ? "Melhoram sua experiência salvando preferências e histórico de uso dentro da plataforma."
        : "Improve your experience by saving preferences and usage history within the platform.",
      examples: locale === "pt" ? "Buscas recentes, onboarding, preferências de UI" : "Recent searches, onboarding, UI preferences",
      enabled: localFunctional,
      locked: false,
      onChange: setLocalFunctional,
    },
    {
      id: "analytical" as const,
      icon: BarChart3,
      name: locale === "pt" ? "Analíticos" : "Analytical",
      desc: locale === "pt"
        ? "Nos ajudam a entender como você usa a plataforma para que possamos melhorá-la. Dados anonimizados."
        : "Help us understand how you use the platform so we can improve it. Anonymized data.",
      examples: locale === "pt"
        ? "Páginas visitadas, funcionalidades usadas, tempo de sessão"
        : "Pages visited, features used, session duration",
      enabled: localAnalytical,
      locked: false,
      onChange: setLocalAnalytical,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {locale === "pt" ? "Configurações de Cookies" : "Cookie Settings"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <cat.icon className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{cat.desc}</p>
                    <p className="mt-1 text-[11px] italic text-muted-foreground/70">
                      {locale === "pt" ? "Ex:" : "E.g.:"} {cat.examples}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={cat.enabled}
                  disabled={cat.locked}
                  onCheckedChange={(v) => cat.onChange(v)}
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {locale === "pt" ? "Cancelar" : "Cancel"}
          </Button>
          <Button onClick={handleSave}>
            {locale === "pt" ? "Salvar preferências" : "Save preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CookieSettingsDialog;
