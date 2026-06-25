import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProviderInfo {
  id: string;
  name: string;
  models: Array<{ id: string; name: string; description: string }>;
}

const PROVIDER_MODELS: Record<string, ProviderInfo> = {
  groq: {
    id: "groq",
    name: "Groq",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Rápido e versátil" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Ultra rápido" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "Bom para análise" },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Mais capaz para análises complexas" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Rápido para maioria das tarefas" },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Mais capaz" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "Rápido e eficiente" },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    models: [
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Rápido e multimodal" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Mais capaz" },
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", description: "Via OpenRouter" },
    ],
  },
  google: {
    id: "google",
    name: "Google AI",
    models: [
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", description: "Melhor custo-benefício, rápido e eficiente" },
      { id: "gemini-3-flash", name: "Gemini 3 Flash", description: "Rápido e econômico" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Rápido e eficiente" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Mais capaz" },
    ],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: activeKeys } = await supabase
      .from("ai_api_keys")
      .select("provider")
      .eq("is_active", true);

    const providers: ProviderInfo[] = [];

    // Add external providers with active keys
    if (activeKeys) {
      const uniqueProviders = [...new Set(activeKeys.map((k) => k.provider))];
      for (const providerId of uniqueProviders) {
        const info = PROVIDER_MODELS[providerId];
        if (info) providers.push(info);
      }
    }

    // Always add Lovable AI as fallback
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      providers.push({
        id: "lovable",
        name: "Lovable AI",
        models: [
          { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Rápido e eficiente" },
          { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Balanceado" },
          { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Mais capaz" },
          { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Rápido e poderoso" },
          { id: "openai/gpt-5", name: "GPT-5", description: "Máxima capacidade" },
        ],
      });
    }

    return new Response(JSON.stringify({ providers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ providers: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
