import { describe, expect, it } from "vitest";
import { callLoadFits, driverState } from "@/lib/dispatch";

describe("call-in queue safety", () => {
  it("routes service-only calls without inventing freight weight", () => {
    expect(callLoadFits(5000, true, null)).toBe(true);
    expect(callLoadFits(null, true, null)).toBe(false);
  });
  it("leaves unknown load weights for dispatch", () => {
    expect(callLoadFits(5000, false, null)).toBe(false);
  });
  it("never assigns a load beyond the selected lift capacity", () => {
    expect(callLoadFits(5000, false, 5000)).toBe(true);
    expect(callLoadFits(5000, false, 5001)).toBe(false);
  });
  it("reports a busy driver as busy even when they remain ready for the next job", () => {
    expect(driverState(new Date(100000).toISOString(), true, true, 100000)).toBe("On a job");
  });
  it("excludes drivers whose heartbeat expired", () => {
    expect(driverState(new Date(40000).toISOString(), true, false, 100000)).toBe("Offline");
  });
});