import type { Database } from "@/integrations/supabase/types";

export type Performance = Database["public"]["Functions"]["operator_performance"]["Returns"][number];
export type BonusStatus = "ineligible" | "pending_review" | "approved" | "rejected" | "paid";
export type IncentivePeriod = "daily" | "weekly" | "event";

export const BONUS_STATUS_LABEL: Record<BonusStatus, string> = {
  ineligible: "Ineligible",
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};
export const PERIOD_LABEL: Record<IncentivePeriod, string> = { daily: "Daily", weekly: "Weekly", event: "Event completion" };

export const DEFAULT_WEIGHTS = { w_productivity: 30, w_accuracy: 25, w_on_time: 20, w_documentation: 15, w_reliability: 10 };
export type Weights = typeof DEFAULT_WEIGHTS;
export const WEIGHT_LABEL: Record<keyof Weights, string> = {
  w_productivity: "Productivity",
  w_accuracy: "Scan & delivery accuracy",
  w_on_time: "On-time performance",
  w_documentation: "Documentation & accountability",
  w_reliability: "Reliability & shifts",
};

/** Returns an error message, or null when the weights are usable (whole numbers, none negative, total 100). */
export function weightsError(w: Weights): string | null {
  const vals = Object.values(w);
  if (vals.some((v) => !Number.isInteger(v) || v < 0)) return "Each weight must be a whole number of 0 or more.";
  const total = vals.reduce((a, b) => a + b, 0);
  return total === 100 ? null : `Weights must add up to 100 (now ${total}).`;
}

/** Mirrors the database's incentive_score: each part is 0..1, multiplied by its weight. */
export function scoreFrom(parts: { productivity: number; accuracy: number; on_time: number; documentation: number; reliability: number }, w: Weights = DEFAULT_WEIGHTS) {
  const c = (v: number) => Math.min(1, Math.max(0, v || 0));
  const raw = c(parts.productivity) * w.w_productivity + c(parts.accuracy) * w.w_accuracy + c(parts.on_time) * w.w_on_time
    + c(parts.documentation) * w.w_documentation + c(parts.reliability) * w.w_reliability;
  return Math.round(raw * 10) / 10;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Monday of the week containing d. */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function dayRange(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const to = new Date(from); to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
export const fmtMin = (m: number | null | undefined) => (m == null ? "—" : m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
export const fmtPct = (p: number | null | undefined) => (p == null ? "—" : `${Math.round(p)}%`);
