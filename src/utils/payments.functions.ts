import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };
type SalesRequestResult = { ok: true } | { error: string };

const PRICE_ID_RE = /^[a-zA-Z0-9_-]+$/;

// Look up an existing Customer by userId metadata (then by email), or create
// one. Putting userId on the Customer object is what makes later reads
// (portal, dashboards, subscriptions.search) resolvable.
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string | undefined; userId?: string | undefined; organizationId?: string | null | undefined },
): Promise<string> {
  // One provider customer per company, so a second admin reuses it.
  if (options.organizationId && /^[a-f0-9-]+$/.test(options.organizationId)) {
    const byOrg = await stripe.customers.search({
      query: `metadata['organization_id']:'${options.organizationId}'`,
      limit: 1,
    });
    if (byOrg.data[0]) return byOrg.data[0].id;
  }
  // userId is interpolated into a Stripe Search query string below;
  // reject anything that could break out of the quoted value.
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    const match = found.data[0];
    if (match) return match.id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      const meta = { ...customer.metadata } as Record<string, string>;
      if (options.userId && !meta["userId"]) meta["userId"] = options.userId;
      if (options.organizationId) meta["organization_id"] = options.organizationId;
      await stripe.customers.update(customer.id, { metadata: meta });
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: {
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.organizationId ? { organization_id: options.organizationId } : {}),
    },
  });
  return created.id;
}

// The caller's company, read through RLS so the client cannot claim another
// organization's subscription.
async function callerIsOrgAdmin(supabase: SupabaseClient<Database>, org: string) {
  const { data } = await supabase.rpc("is_org_admin", { _org: org });
  return data === true;
}

// Test-mode checkout is only allowed outside the production domains, so the
// published site can't be unlocked with a test card.
const PRODUCTION_HOSTS = ["expohaul.com", "www.expohaul.com", "expo-freight-flow.lovable.app"];
async function assertEnvironmentAllowed(env: StripeEnv) {
  if (env !== "sandbox") return;
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const host = (getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "").split(":")[0];
  if (host && PRODUCTION_HOSTS.includes(host)) throw new Error("Test payments are not available on the live site.");
}

async function callerOrg(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .not("organization_id", "is", null)
    .limit(1);
  return data?.[0]?.organization_id ?? null;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!PRICE_ID_RE.test(data.priceId)) throw new Error("Invalid priceId");
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid return URL");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    const { userId, supabase } = context;
    try {
      const stripe = createStripeClient(data.environment);
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email ?? undefined;
      const organizationId = await callerOrg(supabase, userId);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");
      if (stripePrice.type !== "recurring") {
        throw new Error("This price is not a subscription");
      }

      await assertEnvironmentAllowed(data.environment);
      if (!organizationId) return { error: "Your account isn't linked to a company yet." };
      if (!(await callerIsOrgAdmin(supabase, organizationId))) {
        return { error: "Only a company admin can change the plan." };
      }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId, organizationId });

      // One subscription per company: plan changes go through changePlan.
      for (const status of ["active", "trialing", "past_due"] as const) {
        const existing = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
        if (existing.data.length) {
          return { error: "Your company already has a plan. Use Switch plan instead of buying a second one." };
        }
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        // US seller, digital SaaS: the provider handles tax compliance,
        // fraud protection, disputes and transaction-level support.
        managed_payments: { enabled: true },
        metadata: { userId, organization_id: organizationId ?? "" },
        subscription_data: {
          metadata: { userId, organization_id: organizationId ?? "" },
        },
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string | undefined; environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;
    try {
      const organizationId = await callerOrg(supabase, userId);
      const orFilter = organizationId
        ? `user_id.eq.${userId},organization_id.eq.${organizationId}`
        : `user_id.eq.${userId}`;
      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .or(orFilter)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subError) throw new Error(subError.message);
      if (!sub?.stripe_customer_id) throw new Error("No subscription found");

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// Pilot / Enterprise interest from a signed-in company. Stored so the
// platform owner can follow up; no money changes hands here.
export const submitSalesRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: string; companyName: string; message: string }) => {
    if (data.kind !== "pilot" && data.kind !== "enterprise") throw new Error("Unknown request");
    const companyName = data.companyName.trim().slice(0, 160);
    const message = data.message.trim().slice(0, 2000);
    if (!companyName) throw new Error("Company name is required");
    return { ...data, companyName, message };
  })
  .handler(async ({ data, context }): Promise<SalesRequestResult> => {
    const { supabase, userId } = context;
    try {
      const organizationId = await callerOrg(supabase, userId);
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from("sales_requests").insert({
        user_id: userId,
        organization_id: organizationId,
        kind: data.kind,
        company_name: data.companyName,
        contact_email: authData.user?.email ?? "",
        message: data.message,
      });
      if (error) return { error: error.message };
      return { ok: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Request failed" };
    }
  });

// Tier order and plan-change rules. Upgrade = higher tier, or same tier moving
// to annual prepay. Everything else is a downgrade, applied at renewal.
const TIER_RANK: Record<string, number> = { starter: 1, growth: 2, professional: 3 };
export function isUpgrade(fromPriceId: string, toPriceId: string): boolean {
  const [fromTier] = fromPriceId.split("_");
  const [toTier] = toPriceId.split("_");
  const a = TIER_RANK[fromTier ?? ""] ?? 0;
  const b = TIER_RANK[toTier ?? ""] ?? 0;
  if (b !== a) return b > a;
  return toPriceId.endsWith("_yearly") && !fromPriceId.endsWith("_yearly");
}

type ChangePlanResult = { ok: true; mode: "upgraded" | "scheduled" } | { error: string };

export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; environment: StripeEnv }) => {
    if (!PRICE_ID_RE.test(data.priceId)) throw new Error("Invalid priceId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
  })
  .handler(async ({ data, context }): Promise<ChangePlanResult> => {
    const { supabase, userId } = context;
    try {
      await assertEnvironmentAllowed(data.environment);
      const organizationId = await callerOrg(supabase, userId);
      if (!organizationId || !(await callerIsOrgAdmin(supabase, organizationId))) {
        return { error: "Only a company admin can change the plan." };
      }
      const { data: row } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id, price_id")
        .eq("organization_id", organizationId)
        .eq("environment", data.environment)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!row) return { error: "No active plan to change." };
      if (row.price_id === data.priceId) return { error: "You're already on this plan." };

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      const target = prices.data[0];
      if (!target) return { error: "Price not found" };
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      const item = sub.items.data[0];
      if (!item) return { error: "Subscription has no items" };

      // Clear any previously scheduled change first.
      if (sub.schedule) {
        const scheduleId = typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id;
        await stripe.subscriptionSchedules.release(scheduleId);
      }

      if (isUpgrade(row.price_id, data.priceId)) {
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price: target.id }],
          proration_behavior: "always_invoice",
          payment_behavior: "error_if_incomplete",
          cancel_at_period_end: false,
          metadata: { ...sub.metadata, pending_price_id: "", pending_change_at: "" },
        });
        return { ok: true, mode: "upgraded" };
      }

      const periodEnd = item.current_period_end;
      const schedule = await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
      const current = schedule.phases[0];
      if (!current) return { error: "Could not read the current billing period." };
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        phases: [
          {
            items: [{ price: item.price.id, quantity: 1 }],
            start_date: current.start_date,
            end_date: periodEnd,
          },
          { items: [{ price: target.id, quantity: 1 }], duration: { interval: "month", interval_count: 1 } },
        ],
      });
      await stripe.subscriptions.update(sub.id, {
        metadata: { ...sub.metadata, pending_price_id: data.priceId, pending_change_at: String(periodEnd) },
      });
      return { ok: true, mode: "scheduled" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// Platform owner reviews pilot / enterprise requests.
export const reviewSalesRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string; decision: "approve" | "decline" }) => {
    if (!/^[a-f0-9-]{36}$/.test(data.requestId)) throw new Error("Invalid request");
    if (data.decision !== "approve" && data.decision !== "decline") throw new Error("Invalid decision");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("is_super_admin");
    if (!isSuper) return { error: "Only the platform owner can review requests." };
    const { data: req } = await supabase
      .from("sales_requests").select("id, kind, organization_id, status").eq("id", data.requestId).maybeSingle();
    if (!req) return { error: "Request not found" };
    if (req.status !== "pending") return { error: "This request was already reviewed." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.decision === "approve" && req.kind === "pilot") {
      if (!req.organization_id) return { error: "Requester has no company." };
      const { count } = await supabaseAdmin.from("pilot_grants").select("id", { count: "exact", head: true });
      if ((count ?? 0) >= 3) return { error: "All three Founding Contractor Pilot spots are taken." };
      const { error } = await supabaseAdmin.from("pilot_grants").insert({
        organization_id: req.organization_id, sales_request_id: req.id, granted_by: userId,
      });
      if (error) return { error: error.message };
    }
    const { error } = await supabase
      .from("sales_requests")
      .update({ status: data.decision === "approve" ? "approved" : "declined" })
      .eq("id", req.id);
    if (error) return { error: error.message };
    return { ok: true };
  });
