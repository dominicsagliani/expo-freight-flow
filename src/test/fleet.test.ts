import { describe, it, expect } from "vitest";
import { loadFits } from "@/lib/fleet";
describe("fleet capacity safety", () => {
  it("routes 5000 lb total only to a lift with sufficient capacity", () => {
    expect(loadFits(5000, [3000, 2000])).toBe(true);
    expect(loadFits(5000, [3000, 2001])).toBe(false);
    expect(loadFits(15500, [5001])).toBe(true);
  });
  it("leaves unknown weights for dispatch", () => {
    expect(loadFits(5000, [0])).toBe(false);
    expect(loadFits(5000, [])).toBe(false);
  });
  it("does not route to a machine with unknown capacity", () => {
    expect(loadFits(null, [100])).toBe(false);
  });
});