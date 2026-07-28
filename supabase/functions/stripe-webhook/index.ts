import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { planFromProductId } from "../_shared/stripe-plans.ts";

// Keeps subscriptions.plan/status in sync with Stripe in real time, instead
// of relying solely on the client calling check-subscription on page load
// (which never fires if a user cancels via the billing portal and doesn't
// come back). Handles checkout completion and the full subscription
// lifecycle (created/updated/deleted — covers cancellations, past_due,
// unpaid, and plan changes).

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

async function syncSubscriptionRow(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const productId = sub.items.data[0]?.price?.product as string | undefined;
  const isEntitled = sub.status === "active" || sub.status === "trialing";
  const plan = isEntitled ? planFromProductId(productId) : "free";

  const payload = {
    plan,
    status: sub.status,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
  };

  const userId = sub.metadata?.user_id;
  if (userId) {
    await supabaseAdmin.from("subscriptions").upsert({ user_id: userId, ...payload }, { onConflict: "user_id" });
    logStep("Synced by metadata.user_id", { userId, plan, status: sub.status });
    return;
  }

  // Older subscriptions created before create-checkout started stamping
  // subscription_data.metadata.user_id won't have it — fall back to
  // matching the customer ID already on file.
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin.from("subscriptions").update(payload).eq("user_id", existing.user_id);
    logStep("Synced by stripe_customer_id fallback", { userId: existing.user_id, plan, status: sub.status });
  } else {
    logStep("No matching user found for customer, skipped", { customerId, subscriptionId: sub.id });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    logStep("Signature verification failed", { message: err instanceof Error ? err.message : String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  logStep("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);

          // Backfill user_id onto the subscription itself if create-checkout
          // only had the chance to stamp it on the session (e.g. before this
          // field was added), so future subscription.* events are self-sufficient.
          if (!sub.metadata?.user_id && session.metadata?.user_id) {
            await stripe.subscriptions.update(subId, { metadata: { user_id: session.metadata.user_id } });
            sub.metadata = { ...sub.metadata, user_id: session.metadata.user_id };
          }

          await syncSubscriptionRow(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionRow(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        // Unhandled event types are expected — we only subscribe to the
        // events above in the Stripe dashboard, but Stripe may retry/resend
        // others depending on endpoint configuration.
        break;
    }
  } catch (err) {
    logStep("Handler error", { message: err instanceof Error ? err.message : String(err) });
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
