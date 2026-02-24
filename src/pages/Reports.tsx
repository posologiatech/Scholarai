import AppHeader from "@/components/app/AppHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Reports = () => {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="container max-w-4xl flex-1 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">{t("reports.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("reports.subtitle")}</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 py-20">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{t("reports.empty")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("reports.emptyDesc")}</p>
          <Button className="mt-6" disabled>
            <Plus className="mr-2 h-4 w-4" />
            {t("reports.create")}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">{t("solutions.comingSoon")}</p>
        </div>
      </main>
    </div>
  );
};

export default Reports;
