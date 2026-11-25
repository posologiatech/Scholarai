import { CheckCircle2, Circle } from "lucide-react";
import type { GateResult, StageDef } from "@/lib/review/types";

interface Props { stage: StageDef; gate: GateResult; locale: "pt" | "en" }

/** What still has to be true before the user can leave this stage. */
export function GatePanel({ stage, gate, locale }: Props) {
  const pt = locale === "pt";
  if (stage.gate.length === 0) return null;
  const missing = new Set(gate.missing.map((m) => m.pt));
  return (
    <section aria-label={pt ? "Para concluir esta etapa" : "To complete this stage"} className="rounded-lg border border-border bg-muted/30 p-4">
      <h3 className="mb-2 text-sm font-medium text-foreground">{pt ? "Para concluir esta etapa" : "To complete this stage"}</h3>
      <ul className="space-y-1.5">
        {stage.gate.map((g, i) => {
          const done = !missing.has(g.label.pt);
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              {done
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label={pt ? "Cumprido" : "Done"} />
                : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={pt ? "Pendente" : "Pending"} />}
              <span className={done ? "text-muted-foreground line-through" : "text-foreground"}>{g.label[locale]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
