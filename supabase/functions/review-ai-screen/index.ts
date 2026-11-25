// review-ai-screen: AI suggestions for title/abstract screening.
//
// The suggestion is stored as a review_decisions row with source = 'ai'. Row-level security
// forbids users from writing such rows, so a vote cannot be forged from the browser: only this
// function (service role) writes them, after checking the caller is on the review. The row never
// counts as a reviewer's vote; it is an aid shown to reviewers and a way to order the queue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";
const MAX_RECORDS = 10; // one model call per request keeps us inside the function time limit

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Suggestion { id: string; decision: "include" | "exclude" | "maybe"; score: number; reason: string }

/** Pulls the JSON array out of a model reply and keeps only well-formed suggestions for known ids. */
export function parseSuggestions(text: string, allowed: Set<string>): Suggestion[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let raw: unknown;
  try { raw = JSON.parse(m[0]); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const x of raw as Record<string, unknown>[]) {
    const id = String(x?.id ?? "");
    const decision = x?.decision;
    if (!allowed.has(id) || seen.has(id) || !["include", "exclude", "maybe"].includes(decision as string)) continue;
    const score = Math.min(1, Math.max(0, Number(x.score)));
    seen.add(id);
    out.push({ id, decision: decision as Suggestion["decision"], score: Number.isFinite(score) ? score : 0.5, reason: String(x.reason ?? "").slice(0, 400) });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { reviewId, recordIds } = await req.json();
    if (typeof reviewId !== "string" || !Array.isArray(recordIds) || recordIds.length === 0 || recordIds.length > MAX_RECORDS) {
      return json({ error: `reviewId and 1-${MAX_RECORDS} recordIds are required` }, 400);
    }

    const { data: allowed } = await auth.supabase.rpc("can_access_review", { _user_id: auth.userId, _review_id: reviewId });
    if (allowed !== true) return json({ error: "forbidden" }, 403);

    // Read through the caller's own RLS: they can only see what they are allowed to.
    const { data: review } = await auth.supabase.from("reviews")
      .select("question, eligibility, framework, protocol_locked_at, locale, ai_disclosure").eq("id", reviewId).single();
    if (!review) return json({ error: "review not found" }, 404);
    if (!review.protocol_locked_at) return json({ error: "protocol_not_locked", message: "Lock the protocol before AI screening." }, 409);

    const { data: records } = await auth.supabase.from("review_records")
      .select("id, title, abstract").eq("review_id", reviewId).in("id", recordIds);
    if (!records?.length) return json({ error: "no records" }, 404);

    const pt = review.locale === "pt";
    const criteria = (review.eligibility as { kind: string; text: string }[] | null ?? [])
      .map((c) => `- ${c.kind === "include" ? "INCLUDE if" : "EXCLUDE if"}: ${c.text}`).join("\n");
    const framework = Object.entries((review.framework as Record<string, string>) ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
    const list = records.map((r: { id: string; title: string; abstract: string | null }) =>
      `[ID: ${r.id}]\nTitle: ${r.title}\nAbstract: ${r.abstract?.slice(0, 1800) || "(none)"}`).join("\n\n");

    const system = `You assist title/abstract screening for a literature review. You are a second opinion for human reviewers, never the decision-maker.
Rules:
1. Sensitivity over specificity: exclude only when the title/abstract clearly fails an eligibility criterion.
2. With no abstract, judge by the title and answer "maybe" when unsure.
3. Do not invent facts that are not in the text.
Return ONLY a JSON array, one object per record: {"id": "<the ID>", "decision": "include|exclude|maybe", "score": 0.0-1.0 (likelihood it meets the criteria), "reason": "one short sentence in ${pt ? "Portuguese (pt-BR)" : "English"}"}.`;

    const response = await callAI({
      _userId: auth.userId,
      _promptType: "review_screening",
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Review question: ${review.question}\n${framework}\n\nEligibility criteria:\n${criteria || "(none stated)"}\n\nRecords:\n\n${list}` },
      ],
      temperature: 0.2,
    });
    if (!response.ok) {
      const body = await response.text();
      return new Response(body, { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await response.json();
    const suggestions = parseSuggestions(data.choices?.[0]?.message?.content ?? "", new Set(records.map((r: { id: string }) => r.id)));

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const ids = suggestions.map((s) => s.id);
    if (ids.length) {
      // The unique index on AI rows is partial, which upsert cannot target: replace explicitly.
      await admin.from("review_decisions").delete().eq("review_id", reviewId).eq("phase", "title_abstract").eq("source", "ai").in("record_id", ids);
      const { error } = await admin.from("review_decisions").insert(suggestions.map((s) => ({
        review_id: reviewId, record_id: s.id, phase: "title_abstract", decision: s.decision, source: "ai",
        user_id: null, ai_model: MODEL, ai_score: s.score, reason: s.reason,
      })));
      if (error) throw error;

      const disclosure = (review.ai_disclosure as { feature: string }[] | null) ?? [];
      if (!disclosure.some((d) => d.feature === "title_abstract_screening")) {
        await admin.from("reviews").update({
          ai_disclosure: [...disclosure, {
            feature: "title_abstract_screening", model: MODEL, first_used_at: new Date().toISOString(),
            role: "Second-opinion aid shown to reviewers; never counted as a reviewer vote.",
          }],
        }).eq("id", reviewId);
      }
    }
    return json({ suggested: suggestions.length, requested: records.length });
  } catch (e) {
    console.error("[review-ai-screen]", e);
    return json({ error: e instanceof Error ? e.message : "screening failed" }, 500);
  }
});
