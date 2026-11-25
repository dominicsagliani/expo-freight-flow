import { describe, expect, it } from "vitest";
import { shipmentSummary, sortBoothLabels } from "@/lib/shipments";

describe("shipment tracking", () => {
  it("shows two of three pieces delivered without declaring all arrived", () => {
    const s = shipmentSummary([
      { id: "1", pieces: 1, arrival_status: "delivered_to_booth", arrived_at: "2026-11-25" },
      { id: "2", pieces: 1, arrival_status: "delivered_to_booth", arrived_at: "2026-11-25" },
      { id: "3", pieces: 1, arrival_status: "expected", arrived_at: null },
    ], []);
    expect(s.delivered).toBe(2);
    expect(s.expected).toBe(3);
    expect(s.notArrived).toBe(1);
  });
  it("derives transit only from active undelivered pickups", () => {
    const s = shipmentSummary([{ id: "1", pieces: 1, arrival_status: "received", arrived_at: null }], [
      { status: "in_progress", charge_amount: null, paid_at: null, invoice_sent_at: null, ticket_freight: [{ freight_id: "1", picked_up_at: "now", delivered_at: null }] },
    ]);
    expect(s.transit).toBe(1);
    expect(s.received).toBe(1);
    expect(s.delivered).toBe(0);
  });
  it("bills only completed jobs and separates paid invoices", () => {
    const s = shipmentSummary([], [
      { status: "completed", charge_amount: 130, paid_at: null, invoice_sent_at: "now", ticket_freight: [] },
      { status: "completed", charge_amount: 65, paid_at: "now", invoice_sent_at: "now", ticket_freight: [] },
      { status: "in_progress", charge_amount: 999, paid_at: null, invoice_sent_at: null, ticket_freight: [] },
    ]);
    expect(s.total).toBe(195);
    expect(s.unpaid).toBe(130);
    expect(s.pendingInvoices).toBe(0);
  });
  it("orders batch labels by booth number", () => {
    expect(sortBoothLabels([{ booth_number: "10", freight_code: "B" }, { booth_number: "2", freight_code: "A" }]).map((f) => f.booth_number)).toEqual(["2", "10"]);
  });
});