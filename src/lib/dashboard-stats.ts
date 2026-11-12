import type { TicketPriority, TicketStatus, ArrivalStatus } from "./labels";

export interface StatTicket {
  status: TicketStatus;
  priority: TicketPriority;
  completed_at: string | null;
}
export interface StatFreight {
  arrival_status: ArrivalStatus;
}
export interface StatOperator {
  status: "available" | "on_job" | "off_shift";
}

const ON_SITE: ArrivalStatus[] = ["received", "in_storage", "delivered_to_booth", "outbound"];

/** Overview metrics. "Completed today" uses the caller's local calendar day. */
export function computeDashboardStats(
  tickets: StatTicket[],
  freight: StatFreight[],
  operators: StatOperator[],
  now: Date = new Date(),
) {
  const byStatus: Record<TicketStatus, number> = {
    requested: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const t of tickets) byStatus[t.status]++;

  const sameDay = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    );
  };

  const open = byStatus.requested + byStatus.assigned + byStatus.in_progress;
  const urgentOpen = tickets.filter(
    (t) => (t.priority === "urgent" || t.priority === "high") &&
      (t.status === "requested" || t.status === "assigned" || t.status === "in_progress"),
  ).length;

  return {
    byStatus,
    open,
    urgentOpen,
    completedToday: tickets.filter((t) => t.status === "completed" && t.completed_at && sameDay(t.completed_at)).length,
    freightTotal: freight.length,
    freightOnSite: freight.filter((f) => ON_SITE.includes(f.arrival_status)).length,
    freightExpected: freight.filter((f) => f.arrival_status === "expected").length,
    operatorsAvailable: operators.filter((o) => o.status === "available").length,
    operatorsOnJob: operators.filter((o) => o.status === "on_job").length,
    operatorsTotal: operators.length,
  };
}
