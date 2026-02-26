import { Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface ReviewStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

const ReviewStepper = ({ currentStep, onStepClick }: ReviewStepperProps) => {
  const { locale } = useLanguage();

  const steps = [
    { label: locale === "pt" ? "Pergunta" : "Question" },
    { label: locale === "pt" ? "Coleta" : "Collection" },
    { label: locale === "pt" ? "Triagem" : "Screening" },
    { label: locale === "pt" ? "Extração" : "Extraction" },
    { label: locale === "pt" ? "Relatório" : "Report" },
  ];

  return (
    <div className="flex items-center justify-center gap-1">
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;

        return (
          <div key={i} className="flex items-center">
            <button
              onClick={() => onStepClick(i)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                  {i + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`mx-1 h-px w-4 ${i < currentStep ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ReviewStepper;
