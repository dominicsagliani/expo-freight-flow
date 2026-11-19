import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, scoreFrom, weekStart, weightsError, isoDate } from "@/lib/incentives";

describe("operator incentive scoring", () => {
  it("starts with 30/25/20/15/10 weights", () => {
    expect(DEFAULT_WEIGHTS).toEqual({ w_productivity: 30, w_accuracy: 25, w_on_time: 20, w_documentation: 15, w_reliability: 10 });
    expect(weightsError(DEFAULT_WEIGHTS)).toBeNull();
  });
  it("rejects weights that do not total 100", () => {
    expect(weightsError({ ...DEFAULT_WEIGHTS, w_productivity: 40 })).toMatch(/110/);
  });
  it("uses management-changed weights", () => {
    const parts = { productivity: 1, accuracy: 0, on_time: 0, documentation: 0, reliability: 0 };
    expect(scoreFrom(parts)).toBe(30);
    expect(scoreFrom(parts, { ...DEFAULT_WEIGHTS, w_productivity: 50, w_accuracy: 5 })).toBe(50);
  });
  it("caps productivity so unsafe extra speed earns nothing more", () => {
    const base = { accuracy: 1, on_time: 1, documentation: 1, reliability: 1 };
    expect(scoreFrom({ ...base, productivity: 3 })).toBe(scoreFrom({ ...base, productivity: 1 }));
  });
  it("weekly periods start on Monday", () => {
    expect(isoDate(weekStart(new Date(2026, 10, 19)))).toBe("2026-11-16");
  });
});
