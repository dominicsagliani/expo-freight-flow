export type RadarState = "Ready now" | "Finishing soon" | "In progress" | "Assigned" | "On break" | "Offline";

/** Derive a driver's readiness from heartbeat, job status and crate scans. */
export function radarState(o: { online: boolean; ready: boolean; jobStatus?: string | null; total: number; picked: number; delivered: number }): RadarState {
  if (!o.online) return "Offline";
  if (!o.jobStatus) return o.ready ? "Ready now" : "On break";
  if (o.jobStatus === "assigned") return "Assigned";
  if (o.total > 0 && o.picked === o.total && o.delivered >= Math.ceil(o.total / 2)) return "Finishing soon";
  return "In progress";
}
