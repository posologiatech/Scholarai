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
    modelMap: { "google/gemini-3-flash-preview": "gemini-2.5-flash" },
    defaultModel: "gemini-2.5-flash",
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

export async function callAI(options: ChatCompletionOptions): Promise<Response> {
  const activeKeys = await getActiveApiKeys();
  const forceProvider = (options as any)._forceProvider;
  
  // Clean internal fields
  const cleanOptions = { ...options };
  delete (cleanOptions as any)._forceProvider;

  // If a specific provider is forced, try only that one
  const keysToTry = forceProvider 
    ? activeKeys.filter(k => k.provider === forceProvider)
    : activeKeys;

  // Try each configured external provider
  for (const keyRecord of keysToTry) {
    const providerConfig = PROVIDERS.find((p) => p.id === keyRecord.provider);
    if (!providerConfig) continue;

    // Skip Anthropic for streaming (complex SSE format differences)
    if (!providerConfig.isOpenAICompatible && options.stream) continue;

    const model = forceProvider ? (cleanOptions.model || providerConfig.defaultModel) : (providerConfig.modelMap[cleanOptions.model || ""] || providerConfig.defaultModel);

    let requestBody: any;
    if (providerConfig.transformRequest) {
      requestBody = providerConfig.transformRequest({
        ...cleanOptions,
        model,
      });
    } else {
      requestBody = { ...cleanOptions, model };
    }

    // Remove internal fields
    delete requestBody.modalities;

    try {
      console.log(`[ai-caller] Trying provider: ${keyRecord.provider} (model: ${model})`);

      const response = await fetch(providerConfig.baseUrl, {
        method: "POST",
        headers: providerConfig.headerFn(keyRecord.api_key),
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        console.log(`[ai-caller] SUCCESS with provider: ${keyRecord.provider}`);

        // For non-OpenAI-compatible providers, transform the response
        if (!providerConfig.isOpenAICompatible && !options.stream) {
          const data = await response.json();
          const transformed = transformAnthropicResponse(data);
          return new Response(JSON.stringify(transformed), {
            headers: { "Content-Type": "application/json" },
          });
        }

        return response;
      }

      const errText = await response.text();
      console.error(`[ai-caller] Provider ${keyRecord.provider} failed (${response.status}): ${errText}`);
    } catch (err) {
      console.error(`[ai-caller] Provider ${keyRecord.provider} error:`, err);
    }
  }

  // Fallback to Lovable AI
  console.log("[ai-caller] Falling back to Lovable AI gateway");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("No AI provider available and LOVABLE_API_KEY not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanOptions),
  });

  return response;
}

export async function callEmbeddings(input: string): Promise<Response> {
  // Embeddings always use Lovable AI for now
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured for embeddings");
  }

  return fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/text-embedding-004",
      input: input.slice(0, 8000),
    }),
  });
}
