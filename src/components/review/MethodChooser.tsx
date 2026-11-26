import { cn } from "@/lib/utils";
import type { Method } from "@/lib/review/synthesis";

interface Props {
  method: Method | undefined;
  justification: string;
  options: { value: Method; label: string; description: string }[];
  locale: "pt" | "en";
  onChange: (patch: { method?: Method; justification?: string }) => void;
}

export function MethodChooser({ method, justification, options, locale, onChange }: Props) {
  const pt = locale === "pt";
  return (
    <div className="space-y-3">
      <div className="space-y-2" role="radiogroup" aria-label={pt ? "Método de síntese" : "Synthesis method"}>
        {options.map((o) => (
          <label key={o.value} className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3", method === o.value ? "border-primary bg-primary/5" : "border-border")}>
            <input type="radio" name="method" className="mt-1" checked={method === o.value} onChange={() => onChange({ method: o.value })} />
            <span className="min-w-0"><span className="block text-sm font-medium">{o.label}</span><span className="text-xs text-muted-foreground">{o.description}</span></span>
          </label>
        ))}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="method-just" className="text-xs font-medium">{pt ? "Justifique a escolha (mínimo 20 caracteres)" : "Justify the choice (at least 20 characters)"}</label>
        <textarea id="method-just" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={justification} onChange={(e) => onChange({ justification: e.target.value })} />
      </div>
    </div>
  );
}
