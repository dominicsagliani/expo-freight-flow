import { describe, it, expect } from "vitest";
import { buildDockQueue } from "@/lib/dock-queue";
const f = (id: string, ex: string, arrival_status = "delivered_to_booth") => ({ id, exhibitor_id: ex, weight_lbs: 100, pieces: 1, freight_code: id, booth_number: "1", arrival_status, exhibitor: { id: ex, company_name: ex } });
const t = (id: string, ex: string, at: string, status = "requested") => ({ id, exhibitor_id: ex, status, created_at: at, ticket_number: id });
describe("dock queue", () => {
  it("ranks exhibitors by first printed ticket", () => {
    const q = buildDockQueue([f("1", "B"), f("2", "A")], [t("x", "A", "2026-01-01T10:00"), t("y", "B", "2026-01-01T09:00"), t("z", "A", "2026-01-01T08:00", "cancelled")]);
    expect(q.map(r => [r.company, r.truck])).toEqual([["B", 1], ["A", 2]]);
  });
  it("only lists exhibitors with freight, ticketless last", () => {
    const q = buildDockQueue([f("1", "A"), f("2", "C")], [t("x", "A", "2026-01-01T10:00", "completed"), t("y", "Z", "2026-01-01T01:00")]);
    expect(q.map(r => [r.company, r.status, r.truck])).toEqual([["A", "delivered", 1], ["C", "no_ticket", null]]);
  });
  it("shows reset crates as waiting even when their completed job history remains", () => {
    const q = buildDockQueue([f("1", "A", "received")], [t("x", "A", "2026-01-01T10:00", "completed")]);
    expect(q[0]?.status).toBe("waiting");
  });
});
