import { describe, expect, it } from "vitest";
import { boothStatus } from "@/lib/floor-plan";

describe("boothStatus", () => {
  it("stays grey (waiting) when freight exists but no job has started", () => {
    expect(boothStatus([], false, true)).toBe("waiting");
    expect(boothStatus([{ status: "cancelled" }], false, true)).toBe("waiting");
  });

  it("flags booths with no freight ordered", () => {
    expect(boothStatus([], false, false)).toBe("no_freight");
  });

  it("puts the booth on hold when an unresolved issue report exists", () => {
    expect(boothStatus([{ status: "in_progress" }], true)).toBe("on_hold");
    expect(boothStatus([{ status: "completed" }], true)).toBe("on_hold");
  });

  it("shows the most active open ticket status", () => {
    expect(
      boothStatus([{ status: "requested" }, { status: "assigned" }, { status: "in_progress" }], false),
    ).toBe("in_progress");
    expect(boothStatus([{ status: "requested" }, { status: "assigned" }], false)).toBe("assigned");
    expect(boothStatus([{ status: "requested" }], false)).toBe("pending");
  });

  it("returns completed when every ticket finished", () => {
    expect(boothStatus([{ status: "completed" }, { status: "completed" }], false)).toBe("completed");
  });
});
