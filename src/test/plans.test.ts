import { describe, it, expect } from "vitest";
import {
  PLANS,
  annualSavings,
  planIdFromPriceId,
  priceFor,
} from "@/lib/plans";

const byId = (id: string) => PLANS.find((p) => p.id === id)!;

describe("ExpoHaul plan prices", () => {
  it("matches the quoted monthly prices", () => {
    expect(priceFor(byId("starter_plan"), "monthly").amountCents).toBe(29900);
    expect(priceFor(byId("growth_plan"), "monthly").amountCents).toBe(69900);
    expect(priceFor(byId("professional_plan"), "monthly").amountCents).toBe(149900);
  });

  it("matches the quoted annual prepay prices", () => {
    expect(priceFor(byId("starter_plan"), "annual").amountCents).toBe(299000);
    expect(priceFor(byId("growth_plan"), "annual").amountCents).toBe(699000);
    expect(priceFor(byId("professional_plan"), "annual").amountCents).toBe(1499000);
  });

  it("charges a 20% premium for true month-to-month", () => {
    for (const plan of PLANS) {
      const monthly = priceFor(plan, "monthly").amountCents;
      const flex = priceFor(plan, "flex").amountCents;
      expect(flex).toBe(Math.round((monthly * 1.2) / 100) * 100);
    }
    expect(priceFor(byId("starter_plan"), "flex").amountCents).toBe(35900);
    expect(priceFor(byId("growth_plan"), "flex").amountCents).toBe(83900);
    expect(priceFor(byId("professional_plan"), "flex").amountCents).toBe(179900);
  });

  it("gives two months free on annual prepay", () => {
    for (const plan of PLANS) {
      expect(annualSavings(plan)).toBe(priceFor(plan, "monthly").amountCents * 2);
    }
  });

  it("uses one permanent price id per plan and interval", () => {
    const ids = PLANS.flatMap((p) =>
      (["monthly", "annual", "flex"] as const).map((i) => priceFor(p, i).priceId),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("starter_monthly");
    expect(ids).toContain("professional_yearly");
  });

  it("maps a stored price id back to its plan", () => {
    expect(planIdFromPriceId("growth_yearly")).toBe("growth_plan");
    expect(planIdFromPriceId("starter_flex_monthly")).toBe("starter_plan");
    expect(planIdFromPriceId("price_abc123")).toBeNull();
    expect(planIdFromPriceId(null)).toBeNull();
  });
});
