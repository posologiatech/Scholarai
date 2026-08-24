import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ChatCompletionOptions {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  modalities?: string[];
  [key: string]: any;
}

interface ProviderConfig {
  id: string;
  baseUrl: string;
  headerFn: (apiKey: string) => Record<string, string>;
  modelMap: Record<string, string>;
  defaultModel: string;
  transformRequest?: (body: any) => any;
  isOpenAICompatible: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    headerFn: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    modelMap: { "google/gemini-3-flash-preview": "llama-3.3-70b-versatile" },
    defaultModel: "llama-3.3-70b-versatile",
    isOpenAICompatible: true,
  },
  {
    id: "openai",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    headerFn: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    modelMap: { "google/gemini-3-flash-preview": "gpt-4o-mini" },
    defaultModel: "gpt-4o-mini",
    isOpenAICompatible: true,
  },
  {
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    headerFn: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    modelMap: {},
    defaultModel: "google/gemini-2.5-flash",
    isOpenAICompatible: true,
  },
  {
    id: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    headerFn: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    modelMap: { "google/gemini-3-flash-preview": "gemini-3.5-flash" },
    defaultModel: "gemini-3.5-flash",
    isOpenAICompatible: true,
  },
  {
    id: "anthropic",
    baseUrl: "https://api.anthropic.com/v1/messages",
    headerFn: (key) => ({
      "x-api-key": key,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    }),
    modelMap: { "google/gemini-3-flash-preview": "claude-sonnet-4-20250514" },
    defaultModel: "claude-sonnet-4-20250514",
    isOpenAICompatible: false,
    transformRequest: (body: any) => {
      // Convert OpenAI format to Anthropic format
      const messages = body.messages || [];
      const systemMsg = messages.find((m: any) => m.role === "system");
      const nonSystem = messages.filter((m: any) => m.role !== "system");
      const transformed: any = {
        model: body.model,
        max_tokens: body.max_tokens || 4096,
        messages: nonSystem,
      };
      if (systemMsg) transformed.system = systemMsg.content;
      if (body.stream) transformed.stream = true;
      if (body.tools) {
        // Convert OpenAI tools format to Anthropic
        transformed.tools = body.tools.map((t: any) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters,
        }));
        if (body.tool_choice) {
          transformed.tool_choice = { type: "tool", name: body.tool_choice.function.name };
        }
      }
      return transformed;
    },
  },
];

async function getActiveApiKeys(): Promise<Array<{ provider: string; api_key: string }>> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("ai_api_keys")
      .select("provider, api_key")
      .eq("is_active", true);

    if (error) {
      console.error("Failed to fetch AI API keys:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error fetching AI API keys:", err);
    return [];
  }
}

function transformAnthropicResponse(data: any): any {
  // Convert Anthropic response to OpenAI format
  const content = data.content || [];
  const textParts = content.filter((c: any) => c.type === "text");
  const toolParts = content.filter((c: any) => c.type === "tool_use");

  const message: any = {
    role: "assistant",
    content: textParts.map((t: any) => t.text).join("") || null,
  };

  if (toolParts.length > 0) {
    message.tool_calls = toolParts.map((t: any) => ({
      id: t.id,
      type: "function",
      function: {
        name: t.name,
        arguments: JSON.stringify(t.input),
      },
    }));
  }

  return {
    choices: [{ message, finish_reason: data.stop_reason || "stop" }],
  };
}

const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Circuit breaker, not a quota: returns false only when a user's total AI cost this
 * month has blown past the generous per-plan ceiling (see get_plan_cost_ceiling in
 * the DB) -- something no per-feature quota caught. Fails open on error so a transient
 * DB issue doesn't take down every AI feature at once.
 */
export async function checkCostCeiling(userId: string): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("check_cost_ceiling", { p_user_id: userId });
    if (error) {
      console.error("[ai-caller] check_cost_ceiling error:", error);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("[ai-caller] check_cost_ceiling threw:", err);
    return true;
  }
}

/**
 * For AI costs that don't flow through callAI() (currently: Gemini image generation
 * in generate-illustration, which hits Google's API directly -- see google-image.ts).
 * Records a flat, non-token-based cost so it still counts toward the cost ceiling.
 */
export async function logFlatCost(
  userId: string,
  provider: string,
  model: string,
  promptType: string,
  costUsd: number,
) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("ai_usage_log").insert({
      user_id: userId,
      provider,
      model,
      prompt_type: promptType,
      tokens_input: 0,
      tokens_output: 0,
      estimated_cost_usd: costUsd,
    });
  } catch (err) {
    console.error("[ai-caller] logFlatCost failed:", err);
  }
}

export async function notifyCostCeilingBreach(userId: string) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: spent } = await supabase.rpc("get_user_monthly_ai_cost", { p_user_id: userId });
    await supabase.from("admin_notifications").insert({
      type: "cost_ceiling_breach",
      title: `Teto de custo de IA atingido`,
      body: `Usuário ${userId} passou de $${Number(spent ?? 0).toFixed(2)} em custo estimado de IA este mês e foi bloqueado até o próximo período.`,
      link: `/admin?tab=users`,
    });
  } catch (err) {
    console.error("[ai-caller] Failed to notify cost ceiling breach:", err);
  }
}

async function logAIUsage(
  provider: string,
  model: string,
  promptType: string,
  responseData: any,
  userId?: string,
) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const usage = responseData?.usage;
    const tokensInput = usage?.prompt_tokens ?? 0;
    const tokensOutput = usage?.completion_tokens ?? 0;

    // Estimated cost per 1M tokens (approximate, kept in sync with each provider's
    // published pricing -- this feeds get_user_monthly_ai_cost, so a stale entry here
    // means the cost ceiling under/over-fires for that model).
    const costMap: Record<string, { input: number; output: number }> = {
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-4o": { input: 2.5, output: 10 },
      "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
      "gemini-2.5-flash": { input: 0.15, output: 0.6 },
      "gemini-2.5-pro": { input: 1.25, output: 5 },
      "gemini-3-flash-preview": { input: 0.5, output: 3 },
      "gemini-3-flash": { input: 0.5, output: 3 },
      "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
      "claude-sonnet-4-20250514": { input: 3, output: 15 },
    };
    // Unknown model: assume the pricier end of the "flash-tier" models seen above
    // rather than the cheapest, so an un-mapped model can't silently under-report.
    const rates = costMap[model] || { input: 0.5, output: 3 };
    const estimatedCost =
      (tokensInput * rates.input + tokensOutput * rates.output) / 1_000_000;

    await supabase.from("ai_usage_log").insert({
      user_id: userId || PLACEHOLDER_USER_ID,
      provider,
      model,
      prompt_type: promptType,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      estimated_cost_usd: estimatedCost,
    });
  } catch (err) {
    console.error("[ai-caller] Failed to log AI usage:", err);
  }
}

export async function callAI(options: ChatCompletionOptions): Promise<Response> {
  const forceProvider = (options as any)._forceProvider;
  const userId = (options as any)._userId;
  const promptType = (options as any)._promptType || "chat";

  if (userId && userId !== PLACEHOLDER_USER_ID) {
    const withinCeiling = await checkCostCeiling(userId);
    if (!withinCeiling) {
      notifyCostCeilingBreach(userId).catch(() => {});
      return new Response(
        JSON.stringify({
          error: "cost_ceiling_exceeded",
          message: "Você atingiu o teto de custo de IA do seu plano para este mês. Ele será renovado no próximo período, ou entre em contato com o suporte.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const activeKeys = await getActiveApiKeys();

  // Clean internal fields
  const cleanOptions = { ...options };
  const skipProviders: string[] = (cleanOptions as any)._skipProviders || [];
  delete (cleanOptions as any)._forceProvider;
  delete (cleanOptions as any)._userId;
  delete (cleanOptions as any)._promptType;
  delete (cleanOptions as any)._skipProviders;

  // If a specific provider is forced, try only that one
  const keysToTry = forceProvider 
    ? activeKeys.filter(k => k.provider === forceProvider)
    : activeKeys.filter(k => !skipProviders.includes(k.provider));

  // Try each configured external provider
  for (const keyRecord of keysToTry) {
    const providerConfig = PROVIDERS.find((p) => p.id === keyRecord.provider);
    if (!providerConfig) continue;

    if (!providerConfig.isOpenAICompatible && options.stream) continue;
    if (keyRecord.provider === "groq" && options.tools && options.tools.length > 0) continue;

    const primaryModel = forceProvider
      ? (cleanOptions.model || providerConfig.defaultModel)
      : (providerConfig.modelMap[cleanOptions.model || ""] || providerConfig.defaultModel);

    // Per-provider fallback models — used when primary returns 503/429 (overload)
    const modelCandidates: string[] = [primaryModel];
    if (keyRecord.provider === "google") {
      for (const alt of ["gemini-3-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]) {
        if (!modelCandidates.includes(alt)) modelCandidates.push(alt);
      }
    } else if (keyRecord.provider === "openai") {
      for (const alt of ["gpt-4o-mini", "gpt-4o"]) {
        if (!modelCandidates.includes(alt)) modelCandidates.push(alt);
      }
    }

    for (const model of modelCandidates) {
      let requestBody: any;
      if (providerConfig.transformRequest) {
        requestBody = providerConfig.transformRequest({ ...cleanOptions, model });
      } else {
        requestBody = { ...cleanOptions, model };
      }
      delete requestBody.modalities;

      try {
        console.log(`[ai-caller] Trying provider: ${keyRecord.provider} (model: ${model})`);

        const response = await fetch(providerConfig.baseUrl, {
          method: "POST",
          headers: providerConfig.headerFn(keyRecord.api_key),
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          console.log(`[ai-caller] SUCCESS with provider: ${keyRecord.provider} (model: ${model})`);

          if (!providerConfig.isOpenAICompatible && !options.stream) {
            const data = await response.json();
            const transformed = transformAnthropicResponse(data);
            logAIUsage(keyRecord.provider, model, promptType, {
              usage: {
                prompt_tokens: data.usage?.input_tokens ?? 0,
                completion_tokens: data.usage?.output_tokens ?? 0,
              },
            }, userId);
            return new Response(JSON.stringify(transformed), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (!options.stream) {
            const cloned = response.clone();
            cloned.json().then((data) => {
              logAIUsage(keyRecord.provider, model, promptType, data, userId);
            }).catch(() => {});
          }

          return response;
        }

        const errText = await response.text();
        console.error(`[ai-caller] Provider ${keyRecord.provider} (${model}) failed (${response.status}): ${errText.slice(0, 300)}`);

        // 429/5xx are transient → try next candidate model (same provider)
        const isTransient = [429, 500, 502, 503, 504].includes(response.status);
        if (!isTransient) break; // hard error (auth/quota/4xx) → skip remaining models
      } catch (err) {
        console.error(`[ai-caller] Provider ${keyRecord.provider} (${model}) error:`, err);
      }
    }
  }

  // No configured provider could handle the request — do not fall back to any
  // platform-wide key. Admins must configure at least one API key.
  console.error("[ai-caller] No configured AI provider succeeded and no provider was available");
  throw new Error(
    "Nenhuma chave de API de IA configurada ou todas as chaves configuradas falharam. Configure uma chave em Configurações → API Keys.",
  );
}

interface EmbeddingProviderConfig {
  id: "google" | "openai";
  baseUrl: string;
  model: string;
}

const EMBEDDING_PROVIDERS: EmbeddingProviderConfig[] = [
  {
    id: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/embeddings",
    model: "text-embedding-004",
  },
  {
    id: "openai",
    baseUrl: "https://api.openai.com/v1/embeddings",
    model: "text-embedding-3-small",
  },
];

async function tryEmbeddingProvider(
  provider: EmbeddingProviderConfig,
  apiKey: string,
  input: string,
): Promise<number[] | null> {
  try {
    const response = await fetch(provider.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        input: input.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ai-caller] Embeddings provider ${provider.id} failed (${response.status}): ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error(`[ai-caller] Embeddings provider ${provider.id} error:`, err);
    return null;
  }
}

export async function callEmbeddings(input: string): Promise<Response> {
  const activeKeys = await getActiveApiKeys();
  const keyByProvider = new Map(activeKeys.map((k) => [k.provider, k.api_key]));

  // Priority: Google first, then OpenAI — the only two configurable providers
  // that expose an embeddings endpoint.
  for (const provider of EMBEDDING_PROVIDERS) {
    const apiKey = keyByProvider.get(provider.id);
    if (!apiKey) continue;

    const embedding = await tryEmbeddingProvider(provider, apiKey, input);
    if (embedding) {
      return new Response(JSON.stringify({ data: [{ embedding }] }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  throw new Error(
    "Nenhuma chave de API do Google AI ou OpenAI configurada (ou ambas falharam) para gerar embeddings. Configure uma chave em Configurações → API Keys.",
  );
}
