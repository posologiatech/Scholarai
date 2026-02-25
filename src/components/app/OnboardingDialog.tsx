import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { Search, Table, FileText, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

const ONBOARDING_KEY = "scholarai_onboarding_done";

const OnboardingDialog = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setOpen(true);
  }, []);

  const close = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
  };

  const steps = [
    {
      icon: Sparkles,
      title: t("onboarding.welcome.title"),
      desc: t("onboarding.welcome.desc"),
      color: "text-primary",
    },
    {
      icon: Search,
      title: t("onboarding.search.title"),
      desc: t("onboarding.search.desc"),
      color: "text-primary",
    },
    {
      icon: Table,
      title: t("onboarding.extraction.title"),
      desc: t("onboarding.extraction.desc"),
      color: "text-primary",
    },
    {
      icon: FileText,
      title: t("onboarding.reports.title"),
      desc: t("onboarding.reports.desc"),
      color: "text-primary",
    },
    {
      icon: ShieldCheck,
      title: t("onboarding.refcheck.title"),
      desc: t("onboarding.refcheck.desc"),
      color: "text-primary",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="flex flex-col items-center p-8 text-center">
          <div className="mb-6 inline-flex rounded-2xl bg-primary/10 p-4">
            <current.icon className={`h-10 w-10 ${current.color}`} />
          </div>
          <h2 className="mb-2 font-display text-xl font-bold text-foreground">
            {current.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.desc}
          </p>

          {/* Step indicators */}
          <div className="mt-6 flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <div className="mt-6 flex w-full gap-3">
            <Button variant="ghost" onClick={close} className="flex-1">
              {t("onboarding.skip")}
            </Button>
            {isLast ? (
              <Button onClick={close} className="flex-1">
                {t("onboarding.start")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                {t("onboarding.next")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingDialog;
