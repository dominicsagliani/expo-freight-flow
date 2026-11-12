// ExpoHaul subscription plans sold to exhibition contractors.
// Price IDs are permanent sync keys between test and live — never rename one,
// and never mint a variant ID for the same logical price.

export type BillingInterval = "monthly" | "annual" | "flex";

export type PlanPrice = {
  /** Provider price ID used to open checkout (stable across test and live). */
  priceId: string;
  /** Amount in the currency's minor unit (cents for USD). */
  amountCents: number;
  currency: "usd";
};

export type Plan = {
  id: string;
  name: string;
  eventsPerYear: string;
  summary: string;
  features: string[];
  prices: Record<BillingInterval, PlanPrice>;
};

export const INTERVAL_LABEL: Record<BillingInterval, string> = {
  monthly: "Monthly agreement",
  annual: "Annual prepay",
  flex: "Month-to-month",
};

export const INTERVAL_HINT: Record<BillingInterval, string> = {
  monthly: "12-month agreement, billed every month",
  annual: "One payment a year — two months free",
  flex: "Cancel any month, no agreement",
};

export const PLANS: Plan[] = [
  {
    id: "starter_plan",
    name: "Starter",
    eventsPerYear: "Up to 3 events a year",
    summary: "For a contractor running a handful of shows.",
    features: [
      "Digital material-handling tickets",
      "QR freight tracking",
      "Basic dispatch dashboard",
      "Operator accounts",
      "Exhibitor portal",
      "Basic reporting",
    ],
    prices: {
      monthly: { priceId: "starter_monthly", amountCents: 29900, currency: "usd" },
      annual: { priceId: "starter_yearly", amountCents: 299000, currency: "usd" },
      flex: { priceId: "starter_flex_monthly", amountCents: 35900, currency: "usd" },
    },
  },
  {
    id: "growth_plan",
    name: "Growth",
    eventsPerYear: "Up to 10 events a year",
    summary: "For a contractor with several shows running at once.",
    features: [
      "Everything in Starter",
      "Multiple simultaneous events",
      "Advanced operator management",
      "Show management portal",
      "Billing and revenue reports",
      "Advanced freight tracking",
    ],
    prices: {
      monthly: { priceId: "growth_monthly", amountCents: 69900, currency: "usd" },
      annual: { priceId: "growth_yearly", amountCents: 699000, currency: "usd" },
      flex: { priceId: "growth_flex_monthly", amountCents: 83900, currency: "usd" },
    },
  },
  {
    id: "professional_plan",
    name: "Professional",
    eventsPerYear: "Up to 25 events a year",
    summary: "For multi-venue and multi-team operations.",
    features: [
      "Everything in Growth",
      "Multiple venues and teams",
      "Advanced analytics",
      "Custom workflows",
      "Priority support",
      "Expanded reporting",
    ],
    prices: {
      monthly: { priceId: "professional_monthly", amountCents: 149900, currency: "usd" },
      annual: { priceId: "professional_yearly", amountCents: 1499000, currency: "usd" },
      flex: { priceId: "professional_flex_monthly", amountCents: 179900, currency: "usd" },
    },
  },
];

/** Plans with no self-serve price: handled through a sales conversation. */
export const CUSTOM_PLAN = {
  id: "enterprise_plan",
  name: "Enterprise",
  eventsPerYear: "25+ events a year",
  summary: "National operations, multiple locations, custom terms.",
  features: [
    "Multiple business locations",
    "Integrations",
    "Custom permissions",
    "Dedicated implementation",
  ],
};

export const PILOT = {
  id: "founding_pilot",
  name: "Founding Contractor Pilot",
  summary: "Free 30-day pilot for the first three contractors.",
  features: [
    "One event",
    "30 days of access",
    "Dispatcher and operator training",
    "QR freight identification",
    "Digital ticketing",
    "Live office dashboard",
    "Direct access to the founder for feedback",
  ],
};

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function priceFor(plan: Plan, interval: BillingInterval): PlanPrice {
  return plan.prices[interval];
}

/** What a customer pays each year under a plan, in cents. */
export function annualCost(plan: Plan, interval: BillingInterval): number {
  const price = priceFor(plan, interval);
  return interval === "annual" ? price.amountCents : price.amountCents * 12;
}

/** Savings of annual prepay versus the monthly agreement, in cents. */
export function annualSavings(plan: Plan): number {
  return annualCost(plan, "monthly") - annualCost(plan, "annual");
}

export function fmtCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(cents / 100) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function planPriceLabel(plan: Plan, interval: BillingInterval): string {
  const price = priceFor(plan, interval);
  return `${fmtCents(price.amountCents)}/${interval === "annual" ? "yr" : "mo"}`;
}
