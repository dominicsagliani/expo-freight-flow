import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
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
  options: { email?: string; userId?: string },
): Promise<string> {
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
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

// The caller's company, read through RLS so the client cannot claim another
// organization's subscription.
async function callerOrg(
  supabase: ReturnType<
    NonNullable<Parameters<Parameters<typeof createServerFn>["prototype"]>["handler"]>
  > extends never
    ? never
    : any,
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
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      if (stripePrice.type !== "recurring") {
        throw new Error("This price is not a subscription");
      }

      // One active subscription per plan: don't let a company pay twice for
      // the same plan under a different billing interval.
      const existing = await stripe.subscriptions.list({
        customer: await resolveOrCreateCustomer(stripe, { email, userId }),
        status: "active",
        price: stripePrice.id,
        limit: 1,
      });
      if (existing.data.length) {
        return { error: "This plan is already active on your account." };
      }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

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
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => {
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
