import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Cpu, Zap, Sparkles, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Model {
  id: string;
  name: string;
  description: string;
}

interface Provider {
  id: string;
  name: string;
  models: Model[];
}

interface Props {
  value: { provider: string; model: string } | null;
  onChange: (val: { provider: string; model: string }) => void;
}

const TIER_ICONS: Record<string, typeof Cpu> = {
  pro: Sparkles,
  fast: Zap,
  default: Cpu,
};

function getModelTier(model: Model): string {
  const d = model.description.toLowerCase();
  if (d.includes("capaz") || d.includes("máxima") || d.includes("poderoso")) return "pro";
  if (d.includes("rápido") || d.includes("ultra") || d.includes("eficiente")) return "fast";
  return "default";
}

const DataMindModelSelector = ({ value, onChange }: Props) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("datamind-providers");
        if (!error && data?.providers) {
          setProviders(data.providers);
          // Set default if no value
          if (!value && data.providers.length > 0) {
            const first = data.providers[0];
            onChange({ provider: first.id, model: first.models[0].id });
          }
        }
      } catch (e) {
        console.error("Failed to load providers:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectedProvider = providers.find((p) => p.id === value?.provider);
  const selectedModel = selectedProvider?.models.find((m) => m.id === value?.model);

  const displayLabel = selectedModel
    ? `${selectedProvider?.name} · ${selectedModel.name}`
    : "Selecionar modelo";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          disabled={loading}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span className="truncate max-w-[200px]">{loading ? "Carregando..." : displayLabel}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" sideOffset={4}>
        <div className="max-h-80 overflow-y-auto">
          {providers.map((provider) => (
            <div key={provider.id}>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40">
                {provider.name}
              </div>
              {provider.models.map((model) => {
                const isSelected = value?.provider === provider.id && value?.model === model.id;
                const tier = getModelTier(model);
                const TierIcon = TIER_ICONS[tier] || Cpu;

                return (
                  <button
                    key={`${provider.id}-${model.id}`}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                    onClick={() => {
                      onChange({ provider: provider.id, model: model.id });
                      setOpen(false);
                    }}
                  >
                    <TierIcon className={`h-4 w-4 shrink-0 ${
                      tier === "pro" ? "text-amber-500" : tier === "fast" ? "text-emerald-500" : "text-muted-foreground"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        {model.name}
                        {tier === "pro" && (
                          <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded">
                            Pro
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{model.description}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}

          {providers.length === 0 && !loading && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Nenhum provedor disponível
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DataMindModelSelector;
