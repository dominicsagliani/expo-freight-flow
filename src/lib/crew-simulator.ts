export type SimCrew = { operatorId: string; equipmentId: string };
export type SimJob = { id: string; freightId: string | null; label: string; booth: string; weight: number; equipmentClass: string; status: "waiting" | "assigned" | "working" | "done"; operatorId?: string; equipmentId?: string; startedAt?: number; completedAt?: number; hourlyRate: number; charge?: number };
export type SimState = { crews: SimCrew[]; jobs: SimJob[]; next: number };
export type SimLift = { id: string; capacity_lbs: number | null; equipment_class: string; status: string };
export const emptySimulation = (): SimState => ({ crews: [], jobs: [], next: 1 });
export function pairCrew(state: SimState, operatorId: string, equipmentId: string): SimState {
  const busy = state.jobs.some(j => ["assigned", "working"].includes(j.status) && (j.operatorId === operatorId || j.equipmentId === equipmentId));
  if (busy) throw new Error("Finish this crew's test job before changing its pairing.");
  return { ...state, crews: [...state.crews.filter(c => c.operatorId !== operatorId && c.equipmentId !== equipmentId), { operatorId, equipmentId }] };
}
export function dispatchSimulation(state: SimState, lifts: SimLift[]): SimState {
  const jobs = state.jobs.map(j => ({ ...j }));
  for (const job of jobs.filter(j => j.status === "waiting")) {
    const crew = state.crews.find(c => {
      const lift = lifts.find(l => l.id === c.equipmentId);
      return lift && lift.status !== "maintenance" && lift.equipment_class === job.equipmentClass && job.weight > 0 && lift.capacity_lbs !== null && job.weight <= lift.capacity_lbs && !jobs.some(j => ["assigned", "working"].includes(j.status) && (j.operatorId === c.operatorId || j.equipmentId === c.equipmentId));
    });
    if (crew) Object.assign(job, { status: "assigned", operatorId: crew.operatorId, equipmentId: crew.equipmentId });
  }
  return { ...state, jobs };
}
export function moveSimulation(state: SimState, id: string, action: "pickup" | "delivery", now: number): SimState {
  return { ...state, jobs: state.jobs.map(j => {
    if (j.id !== id) return j;
    if (action === "pickup" && j.status === "assigned") return { ...j, status: "working", startedAt: now };
    if (action === "delivery" && j.status === "working" && j.startedAt !== undefined) return { ...j, status: "done", completedAt: now, charge: Math.round(Math.max(0, now - j.startedAt) / 3600000 * j.hourlyRate * 100) / 100 };
    return j;
  }) };
}