import { supabase } from "@/integrations/supabase/client";
import { useCookieConsent } from "@/hooks/useCookieConsent";

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

export async function trackEvent(
  eventName: string,
  metadata: Record<string, any> = {},
  pagePath?: string
) {
  const consent = useCookieConsent.getState();
  if (!consent.analytical) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("analytics_events" as any).insert({
      user_id: user?.id ?? null,
      session_id: getSessionId(),
      event_name: eventName,
      page_path: pagePath ?? window.location.pathname,
      metadata,
    } as any);
  } catch {
    // Silently fail analytics
  }
}

export function trackPageView(path?: string) {
  trackEvent("page_view", {
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
  }, path);
}

export function trackSearch(query: string, resultsCount: number) {
  trackEvent("search", { query, results_count: resultsCount });
}

export function trackFeatureUse(feature: string, details?: Record<string, any>) {
  trackEvent("feature_use", { feature, ...details });
}

export function trackConversion(step: string) {
  trackEvent("conversion_funnel", { step });
}
