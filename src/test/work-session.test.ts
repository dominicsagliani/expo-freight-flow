import { describe, expect, it } from "vitest";
import { sessionSeconds, ticketHours } from "@/lib/work-session";

const t0 = Date.parse("2026-11-13T10:00:00Z");
const iso = (min: number) => new Date(t0 + min * 60_000).toISOString();

describe("forklift work sessions", () => {
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
