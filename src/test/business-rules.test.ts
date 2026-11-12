import { describe, expect, it } from "vitest";
import { computeDashboardStats } from "@/lib/dashboard-stats";
import { validateTicketDraft } from "@/lib/ticket-rules";

describe("ticket draft rules", () => {
  it("requires an event", () => {
    expect(validateTicketDraft({ eventId: "", exhibitorId: "x", freightIds: [], allowedFreightIds: [] })).toBe("Choose an event");
  });
  it("requires an exhibitor", () => {
    expect(validateTicketDraft({ eventId: "e", exhibitorId: "", freightIds: [], allowedFreightIds: [] })).toBe("Choose an exhibitor");
  });
  it("allows multiple freight items from the same exhibitor", () => {
    expect(validateTicketDraft({ eventId: "e", exhibitorId: "x", freightIds: ["f1", "f2"], allowedFreightIds: ["f1", "f2", "f3"] })).toBeNull();
  });
  it("rejects freight belonging to another exhibitor", () => {
    expect(validateTicketDraft({ eventId: "e", exhibitorId: "x", freightIds: ["f1", "other"], allowedFreightIds: ["f1"] })).toMatch(/must belong/);
  });
});

describe("overview metrics", () => {
  const now = new Date(2026, 10, 12, 15, 0);
  it("counts open tickets as pending + assigned + in progress", () => {
    const s = computeDashboardStats(
      [
        { status: "requested", priority: "normal", completed_at: null },
        { status: "assigned", priority: "high", completed_at: null },
        { status: "in_progress", priority: "urgent", completed_at: null },
        { status: "completed", priority: "urgent", completed_at: new Date(2026, 10, 12, 9).toISOString() },
        { status: "completed", priority: "normal", completed_at: new Date(2026, 10, 11, 9).toISOString() },
        { status: "cancelled", priority: "normal", completed_at: null },
      ],
      [],
      [],
      now,
    );
    expect(s.open).toBe(3);
    expect(s.urgentOpen).toBe(2);
    expect(s.completedToday).toBe(1);
  });
  it("treats expected freight as not on site", () => {
    const s = computeDashboardStats([], [{ arrival_status: "expected" }, { arrival_status: "received" }, { arrival_status: "in_storage" }], [], now);
    expect(s.freightOnSite).toBe(2);
    expect(s.freightExpected).toBe(1);
  });
});
