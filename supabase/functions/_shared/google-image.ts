// Direct Google Gemini image generation.
// callAI() in ai-caller.ts only handles text chat completions across providers —
// image generation has no equivalent unified surface, so functions that need it
// call the Google Gemini API directly using the admin's configured Google AI key.

export async function getGoogleApiKey(supabase: any): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_api_keys")
    .select("api_key")
    .eq("provider", "google")
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data.api_key;
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function urlToInlineDataPart(url: string): Promise<GeminiPart> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL");
    return { inline_data: { mime_type: match[1], data: match[2] } };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image URL: ${res.status}`);
  const mimeType = res.headers.get("content-type") || "image/png";
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const CHUNK_SIZE = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return { inline_data: { mime_type: mimeType, data: btoa(binary) } };
}

export async function generateGoogleImage(opts: {
  apiKey: string;
  model: string;
  systemText?: string;
  textPrompt: string;
  imageUrls?: string[];
}): Promise<string> {
  const parts: GeminiPart[] = [];
  if (opts.imageUrls) {
    for (const url of opts.imageUrls) {
      parts.push(await urlToInlineDataPart(url));
    }
  }
  parts.push({ text: opts.textPrompt });

  const body: any = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };
  if (opts.systemText) {
    body.systemInstruction = { parts: [{ text: opts.systemText }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    const err: any = new Error(`Google Gemini image API error: ${response.status} ${errText.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const candidateParts = data.candidates?.[0]?.content?.parts || [];
  for (const part of candidateParts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      const mimeType = inline.mimeType || inline.mime_type || "image/png";
      return `data:${mimeType};base64,${inline.data}`;
    }
  }
  throw new Error("Google Gemini did not return an image");
}
