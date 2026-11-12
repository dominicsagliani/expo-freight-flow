import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

// Defer client construction until first use so env var availability is not
// assumed at module load time.
let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

// Prefer `lookup_key` (set when the price was created) — stable across test
// and live — then legacy metadata, then the raw provider price id.
function priceIdOf(item: any): string {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id ||
    ""
  );
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

// Created and updated events can arrive in any order, so both upsert the
// full row. Pending downgrades live in subscription metadata.
async function upsertSubscription(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = priceIdOf(item);
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const pending = subscription.metadata?.pending_price_id || null;
  const pendingAt = Number(subscription.metadata?.pending_change_at) || null;
  const row = {
    organization_id: subscription.metadata?.organization_id || null,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    product_id: typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? "",
    price_id: priceId,
    status: subscription.status,
    current_period_start: isoFromUnix(periodStart),
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    pending_price_id: pending && pending !== priceId ? pending : null,
    pending_change_at: pending && pending !== priceId ? isoFromUnix(pendingAt) : null,
    environment: env,
    updated_at: new Date().toISOString(),
  };
  const userId = subscription.metadata?.userId;
  if (userId) {
    const { error } = await getSupabase().from("subscriptions").upsert({ ...row, user_id: userId }, { onConflict: "stripe_subscription_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await getSupabase().from("subscriptions").update(row).eq("stripe_subscription_id", subscription.id).eq("environment", env);
    if (error) throw new Error(error.message);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_end: isoFromUnix(subscription.ended_at) ?? new Date().toISOString(),
      pending_price_id: null,
      pending_change_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed": {
      // Subscription state is written by customer.subscription.* events; this
      // only confirms the checkout finished. Delayed-notification payment
      // methods settle later via the async events below.
      const session = event.data.object;
      if (session.payment_status === "unpaid") {
        console.log("Checkout completed but payment is pending:", session.id);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
    case "invoice.paid":
    case "invoice.payment_failed":
      console.log("Payments event received:", event.type);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error(
            "Webhook received with invalid or missing env query parameter:",
            rawEnv,
          );
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
