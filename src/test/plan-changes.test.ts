import { describe, expect, it } from "vitest";
import { isUpgrade } from "@/lib/plans";

describe("plan change rules", () => {
  it("higher tier is an immediate upgrade", () => {
    expect(isUpgrade("starter_monthly", "growth_monthly")).toBe(true);
    expect(isUpgrade("growth_yearly", "professional_flex_monthly")).toBe(true);
  });
  it("lower tier waits for renewal", () => {
    expect(isUpgrade("professional_monthly", "starter_yearly")).toBe(false);
  });
  it("same tier moving to annual prepay is an upgrade", () => {
    expect(isUpgrade("growth_monthly", "growth_yearly")).toBe(true);
  });
  it("same tier leaving annual prepay waits for renewal", () => {
    expect(isUpgrade("growth_yearly", "growth_monthly")).toBe(false);
  });
});
