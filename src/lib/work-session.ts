export type SessionTimes = {
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
};

/** Worked seconds for one forklift session, excluding paused time. */
export function sessionSeconds(s: SessionTimes, now: number = Date.now()): number {
  const end = s.ended_at ? Date.parse(s.ended_at) : now;
  const openPause = !s.ended_at && s.paused_at ? (now - Date.parse(s.paused_at)) / 1000 : 0;
  return Math.max(0, Math.floor((end - Date.parse(s.started_at)) / 1000 - s.paused_seconds - openPause));
}

/** Total worked hours across all forklift sessions on a ticket. */
export function ticketHours(sessions: SessionTimes[], now: number = Date.now()): number {
  return Math.round((sessions.reduce((a, s) => a + sessionSeconds(s, now), 0) / 3600) * 100) / 100;
}

/** A driver's final scan-out closes only their own loaded session. */
export function scanOutStopsTimer(items: { picked_up_session_id: string | null; delivered_at: string | null }[], sessionId: string): boolean {
  return !items.some((item) => item.picked_up_session_id === sessionId && item.delivered_at === null);
}

export function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const ISSUE_TYPES = [
  { key: "damaged", label: "Damaged freight" },
  { key: "missing", label: "Missing freight" },
  { key: "wrong_booth", label: "Wrong booth" },
  { key: "blocked_access", label: "Blocked access" },
  { key: "equipment_problem", label: "Equipment problem" },
  { key: "waiting_assistance", label: "Waiting for assistance" },
  { key: "other", label: "Other" },
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number]["key"];
export const ISSUE_LABEL = Object.fromEntries(ISSUE_TYPES.map((i) => [i.key, i.label])) as Record<string, string>;

export const PAUSE_REASONS = ["Break", "Waiting for freight", "Blocked aisle", "Refuel / charge", "Dispatcher hold", "Other"];
