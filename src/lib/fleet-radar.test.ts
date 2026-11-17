import { describe, it, expect } from "vitest";
import { radarState } from "./fleet-radar";
const base = { online: true, ready: true, jobStatus: "in_progress", total: 2, picked: 2, delivered: 0 };
describe("radarState", () => {
  it("offline wins", () => expect(radarState({ ...base, online: false })).toBe("Offline"));
  it("idle ready driver is ready now", () => expect(radarState({ ...base, jobStatus: null })).toBe("Ready now"));
  it("all loaded, half delivered is finishing soon", () => expect(radarState({ ...base, delivered: 1 })).toBe("Finishing soon"));
  it("not all loaded stays in progress", () => expect(radarState({ ...base, picked: 1, delivered: 1 })).toBe("In progress"));
});
