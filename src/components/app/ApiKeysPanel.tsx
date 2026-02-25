import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Eye, EyeOff, Trash2, ExternalLink, Loader2, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  provider: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

const PROVIDERS = [
  {
    id: "groq",
    label: "Groq",
    url: "https://console.groq.com/keys",
    placeholder: "gsk_...",
  },
  {
    id: "openai",
    label: "OpenAI",
    url: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    url: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    url: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
  },
  {
    id: "google",
    label: "Google AI",
    url: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
  },
];

function maskKey(key: string): string {
  if (key.length <= 10) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

export default function ApiKeysPanel() {
  const { locale } = useLanguage();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  const fetchKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_api_keys")
      .select("*")
      .order("created_at");
    if (!error && data) setKeys(data as ApiKey[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const saveKey = async (provider: string) => {
    const value = inputValues[provider]?.trim();
    if (!value) return;
    setSaving(provider);

    const existing = keys.find((k) => k.provider === provider);
    let error;

    if (existing) {
      ({ error } = await supabase
        .from("ai_api_keys")
        .update({ api_key: value, updated_at: new Date().toISOString() })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("ai_api_keys")
        .insert({ provider, api_key: value }));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        locale === "pt"
          ? `Chave ${provider} salva com sucesso`
          : `${provider} key saved successfully`
      );
      setEditingProvider(null);
      setInputValues((prev) => ({ ...prev, [provider]: "" }));
      fetchKeys();
    }
    setSaving(null);
  };

  const deleteKey = async (provider: string) => {
    const existing = keys.find((k) => k.provider === provider);
    if (!existing) return;

    const { error } = await supabase
      .from("ai_api_keys")
      .delete()
      .eq("id", existing.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        locale === "pt" ? "Chave removida" : "Key removed"
      );
      fetchKeys();
    }
  };

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {locale === "pt" ? "API Keys externas" : "External API Keys"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Configure as API Keys das suas LLMs favoritas. Elas serão usadas com prioridade antes do modelo padrão da plataforma."
            : "Configure API keys for your favorite LLMs. They will be used with priority before the platform's default model."}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {locale === "pt"
            ? "Se nenhuma chave estiver configurada, o sistema usará o modelo padrão. Se a chamada com sua chave falhar, o sistema fará fallback automático."
            : "If no key is configured, the system uses the default model. If a call with your key fails, the system will fallback automatically."}
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const existingKey = keys.find((k) => k.provider === provider.id);
          const isEditing = editingProvider === provider.id;
          const isVisible = visibleKeys.has(provider.id);

          return (
            <div
              key={provider.id}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {provider.label}
                  </span>
                  {existingKey ? (
                    <Badge variant="outline" className="gap-1 border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-normal">
                      <CheckCircle2 className="h-3 w-3" />
                      {locale === "pt" ? "Configurada" : "Configured"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-border text-muted-foreground text-xs font-normal">
                      <Circle className="h-3 w-3" />
                      {locale === "pt" ? "Não configurada" : "Not configured"}
                    </Badge>
                  )}
                </div>
                <a
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {locale === "pt"
                    ? "Adquira sua chave de API"
                    : "Get your API key"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {existingKey && !isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={
                      isVisible
                        ? existingKey.api_key
                        : maskKey(existingKey.api_key)
                    }
                    className="font-mono text-sm bg-muted/50"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleVisibility(provider.id)}
                    title={isVisible ? "Hide" : "Show"}
                  >
                    {isVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingProvider(provider.id);
                      setInputValues((prev) => ({
                        ...prev,
                        [provider.id]: existingKey.api_key,
                      }));
                    }}
                  >
                    {locale === "pt" ? "Editar" : "Edit"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteKey(provider.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder={
                      locale === "pt"
                        ? `Cole aqui sua API Key`
                        : `Paste your API key here`
                    }
                    value={inputValues[provider.id] || ""}
                    onChange={(e) =>
                      setInputValues((prev) => ({
                        ...prev,
                        [provider.id]: e.target.value,
                      }))
                    }
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveKey(provider.id)}
                    disabled={
                      saving === provider.id ||
                      !inputValues[provider.id]?.trim()
                    }
                  >
                    {saving === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : locale === "pt" ? (
                      "Salvar"
                    ) : (
                      "Save"
                    )}
                  </Button>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingProvider(null)}
                    >
                      {locale === "pt" ? "Cancelar" : "Cancel"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
