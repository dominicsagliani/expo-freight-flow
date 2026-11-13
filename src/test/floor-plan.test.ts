import { describe, expect, it } from "vitest";
import { boothStatus } from "@/lib/floor-plan";

describe("boothStatus", () => {
  it("returns none when the booth has no active tickets", () => {
    expect(boothStatus([], false)).toBe("none");
    expect(boothStatus([{ status: "cancelled" }], false)).toBe("none");
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
