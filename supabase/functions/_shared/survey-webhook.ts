// Shared by survey-respond (fires on every real response) and survey-webhook-test (the
// researcher's manual "Testar" button in WebhookTab.tsx) so both send an identically-shaped,
// identically-signed request. The webhook URL/secret are the survey owner's own choice
// (stored in surveys.settings.webhook) — SSRF exposure here is limited to the owner pointing
// their own survey at their own internal endpoint, the same trust level as any user-supplied
// webhook URL (Slack/Zapier-style integrations), so no IP/host allowlisting is applied.

export interface SurveyWebhookConfig {
  enabled?: boolean;
  url?: string;
  secret?: string;
}

export interface SurveyWebhookResult {
  ok: boolean;
  status?: number;
  error?: string;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendSurveyWebhook(
  webhook: SurveyWebhookConfig | null | undefined,
  payload: Record<string, unknown>
): Promise<SurveyWebhookResult> {
  if (!webhook?.url) return { ok: false, error: "missing_url" };

  let url: URL;
  try {
    url = new URL(webhook.url);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "invalid_protocol" };
  }

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhook.secret) {
    headers["X-Scholar-Signature"] = `sha256=${await hmacHex(webhook.secret, body)}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), { method: "POST", headers, body, signal: controller.signal });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
