import { describe, expect, it } from "vitest";
import { scanOutStopsTimer, sessionSeconds, ticketHours } from "@/lib/work-session";

const t0 = Date.parse("2026-11-13T10:00:00Z");
const iso = (min: number) => new Date(t0 + min * 60_000).toISOString();

describe("forklift work sessions", () => {
  it("scan-in is the start and scan-out freezes driver elapsed time", () => {
    const scanned = { started_at: iso(10), ended_at: iso(25), paused_at: null, paused_seconds: 0 };
    expect(sessionSeconds(scanned, t0 + 120 * 60_000)).toBe(900);
  });
  it("keeps timing until all freight scanned into that driver session is scanned out", () => {
    expect(scanOutStopsTimer([{ picked_up_session_id: "driver-a", delivered_at: iso(20) }, { picked_up_session_id: "driver-a", delivered_at: null }], "driver-a")).toBe(false);
  });
  it("stops one driver's timer without stopping another driver's load", () => {
    expect(scanOutStopsTimer([{ picked_up_session_id: "driver-a", delivered_at: iso(20) }, { picked_up_session_id: "driver-b", delivered_at: null }], "driver-a")).toBe(true);
  });
  it("excludes completed pause time", () => {
    expect(sessionSeconds({ started_at: iso(0), ended_at: iso(60), paused_at: null, paused_seconds: 600 })).toBe(3000);
  });
  it("a paused session's clock stops while paused", () => {
    const s = { started_at: iso(0), ended_at: null, paused_at: iso(30), paused_seconds: 0 };
    expect(sessionSeconds(s, t0 + 90 * 60_000)).toBe(1800);
  });
  it("ticket hours sum independent forklifts, one finishing doesn't stop the other", () => {
    const done = { started_at: iso(0), ended_at: iso(60), paused_at: null, paused_seconds: 0 };
    const running = { started_at: iso(30), ended_at: null, paused_at: null, paused_seconds: 0 };
    expect(ticketHours([done, running], t0 + 120 * 60_000)).toBe(2.5);
  });
});
