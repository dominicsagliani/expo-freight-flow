export const REQUEST_SOURCES = { phone: "Phone", walk_in: "Walk-in", radio: "Radio" } as const;

export function callLoadFits(capacity: number | null, serviceOnly: boolean, weight: number | null) {
  return capacity !== null && capacity > 0 && (serviceOnly || (weight !== null && weight > 0 && weight <= capacity));
}

export function driverState(heartbeat: string, ready: boolean, busy: boolean, now: number) {
  if (new Date(heartbeat).getTime() <= now - 60_000) return "Offline";
  if (busy) return "On a job";
  return ready ? "Available" : "On break";
}