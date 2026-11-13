import { describe, expect, it } from "vitest";
import { computeCharge, toCsv } from "@/lib/billing";

describe("charge rules", () => {
  it("rounds weight up to the next 100 lbs", () => {
    expect(computeCharge({ unit: "per_cwt", rate: 98.5, minimum_charge: 197 }, { weightLbs: 1250, pieces: 1, hours: 0 })).toBe(1280.5);
  });
  it("applies the minimum charge", () => {
    expect(computeCharge({ unit: "per_cwt", rate: 98.5, minimum_charge: 197 }, { weightLbs: 80, pieces: 1, hours: 0 })).toBe(197);
  });
  it("charges per piece", () => {
    expect(computeCharge({ unit: "per_piece", rate: 45, minimum_charge: 90 }, { weightLbs: 0, pieces: 4, hours: 0 })).toBe(180);
  });
  it("bills hours in half-hour steps", () => {
    expect(computeCharge({ unit: "per_hour", rate: 165, minimum_charge: 0 }, { weightLbs: 0, pieces: 0, hours: 1.2 })).toBe(247.5);
  });
  it("uses dispatcher-entered labor hours at the contractor's hourly rate", () => {
    expect(computeCharge({ unit: "per_hour", rate: 130, minimum_charge: 0 }, { weightLbs: 0, pieces: 0, hours: 5, laborHours: 2.25 })).toBe(292.5);
  });
  it("still applies the minimum to labor hours", () => {
    expect(computeCharge({ unit: "per_hour", rate: 130, minimum_charge: 195 }, { weightLbs: 0, pieces: 0, hours: 0, laborHours: 1 })).toBe(195);
  });
});

describe("csv export", () => {
  it("quotes values with commas", () => {
    expect(toCsv([["a,b", 1]])).toBe('"a,b",1');
  });
});
