import { describe, expect, it } from "vitest";
import { inboundCounts, inboundOverview } from "@/lib/inbound";

const piece = (id: string, status = "received", extra = false) => ({ id, pieces: 1, arrival_status: status, arrived_at: status === "expected" ? null : "2026-11-25", inbound_extra: extra });
describe("inbound reconciliation", () => {
  it("keeps three expected when two arrive", () => {
    expect(inboundCounts({ expected_pieces: 3, unexpected: false }, [piece("1"), piece("2"), piece("3", "expected")])).toMatchObject({ expected: 3, actual: 2, missing: 1, status: "Partial arrival" });
  });
  it("shows an extra without replacing a missing expected crate", () => {
    expect(inboundCounts({ expected_pieces: 3, unexpected: false }, [piece("1"), piece("2"), piece("3", "expected"), piece("4", "received", true)])).toMatchObject({ actual: 3, missing: 1, extra: 1 });
  });
  it("counts four arrivals against three expected as one extra", () => {
    expect(inboundCounts({ expected_pieces: 3, unexpected: false }, [piece("1"), piece("2"), piece("3"), piece("4", "received", true)])).toMatchObject({ expected: 3, actual: 4, extra: 1, missing: 0 });
  });
  it("keeps partial shipments outstanding in the office overview", () => {
    expect(inboundOverview([{ expected_pieces: 3, unexpected: false, freight: [piece("1"), piece("2")] }, { expected_pieces: 0, unexpected: true, freight: [piece("3", "received", true)] }])).toEqual({ expectedShipments: 1, receivedShipments: 2, outstanding: 1, unexpected: 1, expected: 3, actual: 3 });
  });
  it("derives waiting and delivered from existing freight states", () => {
    expect(inboundCounts({ expected_pieces: 3, unexpected: false }, [piece("1"), piece("2", "delivered_to_booth"), piece("3", "expected")])).toMatchObject({ waiting: 1, delivered: 1 });
  });
});