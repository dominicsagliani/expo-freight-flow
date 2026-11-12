import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CreditCard, ExternalLink, Handshake, Sparkles } from "lucide-react";
import { PageHeader, Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { entitlementQuery, eventsThisYearQuery, isAdmin, membershipQuery, subscriptionsQuery } from "@/lib/queries";
import { getStripeEnvironment } from "@/lib/stripe";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { changePlan, createPortalSession, submitSalesRequest } from "@/utils/payments.functions";
import {
  CUSTOM_PLAN,
  INTERVAL_HINT,
  INTERVAL_LABEL,
  PILOT,
  PLANS,
  annualSavings,
  fmtCents,
  isUpgrade,
  planIdFromPriceId,
  priceFor,
  type BillingInterval,
  type Plan,
} from "@/lib/plans";

type PlansSearch = {
  checkout?: string | undefined;
  session_id?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Plans & Billing — ExpoHaul" },
      {
        name: "description",
        content: "ExpoHaul subscription plans for exhibition contractors, billing management, and pilot requests.",
      },
      { property: "og:title", content: "Plans & Billing — ExpoHaul" },
      {
        property: "og:description",
        content: "Choose the ExpoHaul plan your company runs on and manage billing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): PlansSearch => ({
    checkout: typeof search["checkout"] === "string" ? search["checkout"] : undefined,
    session_id:
      typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(membershipQuery()),
      queryClient.ensureQueryData(subscriptionsQuery()),
    ]),
  component: PlansPage,
});

function safeEnvironment(): "sandbox" | "live" | null {
  try {
    return getStripeEnvironment();
  } catch {
    return null;
  }
}

function isLive(row: { status: string; current_period_end: string | null }) {
  const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  if (row.status === "active" || row.status === "trialing" || row.status === "past_due") return true;
  return row.status === "canceled" && end !== null && end > Date.now();
}

function PlansPage() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { checkout: checkoutFlag } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: subs } = useSuspenseQuery({
    ...subscriptionsQuery(),
    // After paying, poll until the confirmation creates the subscription row.
    refetchInterval: (q) =>
      checkoutFlag === "success" && !(q.state.data ?? []).some((r) => isLive(r)) ? 2000 : false,
  });
  const { data: entitlement } = useQuery(entitlementQuery(m.organizationId));
  const { data: eventsUsed } = useQuery(eventsThisYearQuery());
  const [switching, setSwitching] = useState<string | null>(null);
  const { checkout, session_id: sessionId } = Route.useSearch();
  const environment = safeEnvironment();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [salesKind, setSalesKind] = useState<"pilot" | "enterprise" | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const rows = subs.filter((s) => !environment || s.environment === environment);
  const active = rows.filter(isLive);
  const activePlanIds = new Set(
    active.map((r) => planIdFromPriceId(r.price_id)).filter((id): id is string => Boolean(id)),
  );
  const primary = active[0] ?? rows[0] ?? null;
  const currentPriceId = active[0]?.price_id ?? null;
  const activated = checkout === "success" && active.length > 0;

  const switchPlan = async (plan: Plan) => {
    if (!environment || !currentPriceId) return;
    const target = priceFor(plan, interval).priceId;
    const up = isUpgrade(currentPriceId, target);
    const ok = window.confirm(
      up
        ? `Switch to ${plan.name} (${INTERVAL_LABEL[interval]}) now? You'll be charged the prorated difference today.`
        : `Switch to ${plan.name} (${INTERVAL_LABEL[interval]}) at your next renewal? You keep your current plan until then.`,
    );
    if (!ok) return;
    setSwitching(target);
    const result = await changePlan({ data: { priceId: target, environment } });
    setSwitching(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(result.mode === "upgraded" ? `Upgraded to ${plan.name}.` : `${plan.name} starts at your next renewal.`);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["entitlement"] });
    }, 2500);
  };
  const canBuy = isAdmin(m);

  const subscribe = (plan: Plan) => {
    if (!environment) {
      toast.error("Checkout isn't configured for this build yet.");
      return;
    }
    openCheckout({
      priceId: priceFor(plan, interval).priceId,
      returnUrl: `${window.location.origin}/plans?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  const manageBilling = async () => {
    if (!environment) return;
    const result = await createPortalSession({
      data: { environment, returnUrl: `${window.location.origin}/plans` },
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    window.open(result.url, "_blank");
  };

  const sendRequest = async () => {
    if (!salesKind) return;
    setSending(true);
    const result = await submitSalesRequest({
      data: { kind: salesKind, companyName, message },
    });
    setSending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(
      salesKind === "pilot"
        ? "Pilot request sent — we'll be in touch about your 30-day start."
        : "Request sent — we'll be in touch about your Enterprise terms.",
    );
    setSalesKind(null);
    setCompanyName("");
    setMessage("");
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Plans"
        title="Plans & Billing"
        description="Your ExpoHaul subscription is separate from the service charges you bill exhibitors."
      />

      {checkout === "success" && (
        <div className="rounded-lg border border-teal/40 bg-teal/10 px-4 py-3 text-sm text-foreground">
          {activated
            ? `You're all set — ${PLANS.find((p) => p.id === planIdFromPriceId(currentPriceId))?.name ?? "your plan"} is active.`
            : "Payment received. Your plan is activating — this page updates on its own in a few seconds."}
          {sessionId ? (
            <span className="ml-1 text-muted-foreground">(Session {sessionId})</span>
          ) : null}
        </div>
      )}

      {!environment && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          Checkout isn't configured for this build yet. Complete payments go-live before taking real
          payments.
        </div>
      )}

      {m.isPlatformOwner && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          Platform owner:{" "}
          <Link to="/plan-requests" className="font-medium text-teal underline">
            review pilot and Enterprise requests
          </Link>
        </div>
      )}

      {primary?.status === "past_due" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          Your last payment failed. Update your card under Manage billing — after 7 days without
          payment your company becomes read-only.
        </div>
      )}

      <Panel title="Current plan" bodyClassName="p-4">
        {entitlement ? (
          <p className="mb-3 text-sm text-muted-foreground">
            {entitlement.source === "pilot" ? "Founding Contractor Pilot" : "Plan"} allows{" "}
            <span className="font-medium text-foreground">{entitlement.event_limit} events</span> a year
            {eventsUsed != null ? ` — ${eventsUsed} used in ${new Date().getFullYear()}` : ""}.
            {entitlement.source === "pilot" && entitlement.ends_at
              ? ` Pilot ends ${new Date(entitlement.ends_at).toLocaleDateString()}.`
              : ""}
          </p>
        ) : (
          <p className="mb-3 text-sm text-foreground">
            Your company is read-only until you choose a plan or your pilot is approved.
          </p>
        )}
        {primary ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-foreground">
                {planIdFromPriceId(primary.price_id)
                  ? PLANS.find((p) => p.id === planIdFromPriceId(primary.price_id))?.name
                  : "ExpoHaul plan"}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {primary.status === "active"
                  ? `Active — renews ${primary.current_period_end ? new Date(primary.current_period_end).toLocaleDateString() : "soon"}`
                  : primary.status === "canceled"
                    ? `Canceled — access until ${primary.current_period_end ? new Date(primary.current_period_end).toLocaleDateString() : "period end"}`
                    : `Status: ${primary.status.replace(/_/g, " ")}`}
                {primary.cancel_at_period_end ? " · set to cancel at period end" : ""}
                {primary.pending_price_id
                  ? ` · switching to ${PLANS.find((p) => p.id === planIdFromPriceId(primary.pending_price_id))?.name ?? "a new plan"} (${primary.pending_price_id.endsWith("_yearly") ? "annual" : "monthly"}) on ${primary.pending_change_at ? new Date(primary.pending_change_at).toLocaleDateString() : "renewal"}`
                  : ""}
              </div>
            </div>
            <Button variant="outline" onClick={manageBilling}>
              <ExternalLink className="size-4" />
              Manage billing
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active plan yet. Pick one below, or ask about the free Founding Contractor Pilot.
          </p>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(INTERVAL_LABEL) as BillingInterval[]).map((key) => (
          <button
            key={key}
            onClick={() => setInterval(key)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              interval === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {INTERVAL_LABEL[key]}
            <span className="ml-2 text-xs font-normal opacity-80">{INTERVAL_HINT[key]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = priceFor(plan, interval);
          const alreadyOn = currentPriceId === price.priceId;
          const hasPlan = currentPriceId !== null;
          return (
            <section
              key={plan.id}
              className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-card"
            >
              <div className="eyebrow">{plan.eventsPerYear}</div>
              <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
                {plan.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-foreground">
                  {fmtCents(price.amountCents)}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{interval === "annual" ? "year" : "month"}
                </span>
              </div>
              {interval === "monthly" && (
                <p className="mt-1 text-xs text-teal">
                  Save {fmtCents(annualSavings(plan))} a year with annual prepay
                </p>
              )}
              {interval === "flex" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  No agreement — {fmtCents(price.amountCents - priceFor(plan, "monthly").amountCents)}{" "}
                  more a month than the 12-month agreement
                </p>
              )}
              <ul className="mt-4 grid flex-1 gap-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full"
                disabled={alreadyOn || !canBuy || !environment || switching !== null}
                onClick={() => (hasPlan ? switchPlan(plan) : subscribe(plan))}
              >
                <CreditCard className="size-4" />
                {alreadyOn
                  ? "Current plan"
                  : switching === price.priceId
                    ? "Switching…"
                    : hasPlan
                      ? `${isUpgrade(currentPriceId, price.priceId) ? "Upgrade" : "Switch"} to ${plan.name}`
                      : `Choose ${plan.name}`}
              </Button>
              {!canBuy && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Only a company admin can change the plan.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5 shadow-card">
          <div className="eyebrow flex items-center gap-2">
            <Handshake className="size-4 text-teal" />
            {PILOT.name}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{PILOT.summary}</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {PILOT.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => setSalesKind("pilot")}
            disabled={!canBuy}
          >
            <Sparkles className="size-4" />
            Request the pilot
          </Button>
          {!canBuy && (
            <p className="mt-2 text-xs text-muted-foreground">Only a company admin can request it.</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-card">
          <div className="eyebrow">{CUSTOM_PLAN.eventsPerYear}</div>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            {CUSTOM_PLAN.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{CUSTOM_PLAN.summary}</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {CUSTOM_PLAN.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-5" onClick={() => setSalesKind("enterprise")}>
            Talk to sales
          </Button>
        </section>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeCheckout()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete your subscription</DialogTitle>
            <DialogDescription>
              Enter your billing details to start. You can change or cancel the plan later.
            </DialogDescription>
          </DialogHeader>
          {checkoutElement}
        </DialogContent>
      </Dialog>

      <Dialog open={salesKind !== null} onOpenChange={(open) => !open && setSalesKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {salesKind === "pilot" ? "Request the Founding Contractor Pilot" : "Talk to sales"}
            </DialogTitle>
            <DialogDescription>
              {salesKind === "pilot"
                ? "Free 30-day pilot for the first three contractors: one event, training, and direct access to the founder."
                : "Tell us about your operation and we'll put together terms."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="company">Company name</Label>
              <Input
                id="company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your contractor company"
              />
            </div>
            <div>
              <Label htmlFor="message">What are you running?</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Shows a year, venues, team size, anything you want us to know."
                rows={4}
              />
            </div>
            <Button onClick={sendRequest} disabled={sending || !companyName.trim()}>
              {sending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
