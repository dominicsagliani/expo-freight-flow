import { describe, expect, it } from "vitest";
import { dispatchSimulation, emptySimulation, moveSimulation, pairCrew, type SimJob } from "@/lib/crew-simulator";
const job = (id: string): SimJob => ({ id, freightId: null, label: id, booth: "104", weight: 1000, equipmentClass: "forklift", status: "waiting", hourlyRate: 130 });
const lifts = ["fl1", "fl2"].map(id => ({ id, capacity_lbs: 5000, equipment_class: "forklift", status: "available" }));
describe("solo crew simulator", () => {
  it("pairs multiple drivers under one simulation, exclusively per machine", () => {
    let s = pairCrew(emptySimulation(), "Mike", "fl1");
    s = pairCrew(s, "Dillon", "fl2");
    expect(s.crews).toHaveLength(2);
    expect(pairCrew(s, "Mike", "fl2").crews).toEqual([{ operatorId: "Mike", equipmentId: "fl2" }]);
  });
  it("dispatches separate jobs to separate drivers without starting billing", () => {
    const s = dispatchSimulation({ crews: [{ operatorId: "Mike", equipmentId: "fl1" }, { operatorId: "Dillon", equipmentId: "fl2" }], jobs: [job("1"), job("2"), job("3")], next: 4 }, lifts);
    expect(s.jobs.map(j => j.status)).toEqual(["assigned", "assigned", "waiting"]);
    expect(s.jobs.map(j => j.operatorId)).toEqual(["Mike", "Dillon", undefined]);
    expect(s.jobs[0]?.startedAt).toBeUndefined();
  });
  it("keeps unknown, overweight and incompatible loads waiting", () => {
    const s = dispatchSimulation({ crews: [{ operatorId: "Mike", equipmentId: "fl1" }], jobs: [{ ...job("1"), weight: 0 }, { ...job("2"), weight: 5001 }, { ...job("3"), equipmentClass: "telehandler" }], next: 4 }, lifts);
    expect(s.jobs.map(j => j.status)).toEqual(["waiting", "waiting", "waiting"]);
  });
  it("starts on pickup, charges $130 for an hour, and ignores delivery retries", () => {
    const s = { ...emptySimulation(), jobs: [{ ...job("1"), status: "assigned" as const }] };
    const started = moveSimulation(s, "1", "pickup", 1000);
    const done = moveSimulation(started, "1", "delivery", 3601000);
    expect(done.jobs[0]?.charge).toBe(130);
    expect(moveSimulation(done, "1", "delivery", 7201000)).toEqual(done);
    expect(s.jobs[0]?.status).toBe("assigned");
  });
});