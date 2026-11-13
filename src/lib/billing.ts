export type RateUnit = "per_cwt" | "per_piece" | "per_hour" | "flat";

/** Mirrors the database charge rule used when a ticket is completed. */
export function computeCharge(
  rate: { unit: RateUnit; rate: number; minimum_charge: number },
  work: { weightLbs: number; pieces: number; hours: number; laborHours?: number | null },
) {
  let amt: number;
  if (rate.unit === "per_cwt") amt = Math.ceil(work.weightLbs / 100) * rate.rate;
  else if (rate.unit === "per_piece") amt = work.pieces * rate.rate;
  else if (rate.unit === "per_hour" && work.laborHours != null) amt = work.laborHours * rate.rate;
  else if (rate.unit === "per_hour") amt = Math.max(0.5, Math.ceil(work.hours * 2) / 2) * rate.rate;
  else amt = rate.rate;
  return Math.round(Math.max(amt, rate.minimum_charge) * 100) / 100;
}

export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  per_cwt: "per 100 lbs",
  per_piece: "per piece",
  per_hour: "per hour",
  flat: "flat",
};

export function fmtMoney(n: number | string | null | undefined) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((c) => { const s = c == null ? "" : String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(","))
    .join("\n");
}
