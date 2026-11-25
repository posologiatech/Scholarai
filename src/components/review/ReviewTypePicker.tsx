import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVAILABLE_TYPES, type ReviewTypeDef } from "@/lib/review/types";

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  locale: "pt" | "en";
}

export function ReviewTypePicker({ value, onChange, locale }: Props) {
  const pt = locale === "pt";
  return (
    <div role="radiogroup" aria-label={pt ? "Tipo de revisão" : "Review type"} className="grid gap-3">
      {AVAILABLE_TYPES.map((def: ReviewTypeDef) => {
        const selected = value === def.id;
        return (
          <button
            key={def.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(def.id)}
            className={cn(
              "min-w-0 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-foreground">{def.label[locale]}</p>
              {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{def.summary[locale]}</p>
            <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <div className="min-w-0"><dt className="text-muted-foreground">{pt ? "Pergunta" : "Question"}</dt><dd className="font-medium">{def.framework.name}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{pt ? "Guia de relato" : "Reporting"}</dt><dd className="font-medium">{def.reportingGuideline.name}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{pt ? "Qualidade dos estudos" : "Appraisal"}</dt><dd className="font-medium">{def.appraisal.required ? (pt ? "Obrigatória" : "Required") : (pt ? "Opcional" : "Optional")}</dd></div>
            </dl>
          </button>
        );
      })}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {pt
          ? "Outros tipos (rápida, guarda-chuva, narrativa, qualitativa, realista) chegam em uma fase posterior."
          : "Other types (rapid, umbrella, narrative, qualitative, realist) arrive in a later phase."}
      </p>
    </div>
  );
}
