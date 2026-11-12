import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  ARRIVAL_LABEL,
  EVENT_STATUS_LABEL,
  PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  type ArrivalStatus,
  type EventStatus,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/labels";

const pill = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        requested: "bg-status-requested-soft text-status-requested",
        assigned: "bg-status-assigned-soft text-status-assigned",
        progress: "bg-status-progress-soft text-status-progress",
        completed: "bg-status-completed-soft text-status-completed",
        neutral: "bg-status-cancelled-soft text-status-cancelled",
        urgent: "bg-priority-urgent-soft text-priority-urgent",
        high: "bg-priority-high-soft text-priority-high",
        teal: "bg-teal-soft text-status-progress",
      },
    },
  },
);

const dot = "size-1.5 rounded-full bg-current";

const STATUS_TONE = {
  requested: "requested",
  assigned: "assigned",
  in_progress: "progress",
  completed: "completed",
  cancelled: "neutral",
} as const;

export function TicketStatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span className={cn(pill({ tone: STATUS_TONE[status] }), className)}>
      <span className={dot} />
      {TICKET_STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_TONE = { low: "neutral", normal: "neutral", high: "high", urgent: "urgent" } as const;

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={pill({ tone: PRIORITY_TONE[priority] })}>{PRIORITY_LABEL[priority]}</span>;
}

const ARRIVAL_TONE = {
  expected: "requested",
  received: "assigned",
  in_storage: "neutral",
  delivered_to_booth: "completed",
  outbound: "progress",
  shipped: "neutral",
} as const;

export function ArrivalBadge({ status }: { status: ArrivalStatus }) {
  return (
    <span className={pill({ tone: ARRIVAL_TONE[status] })}>
      <span className={dot} />
      {ARRIVAL_LABEL[status]}
    </span>
  );
}

const EVENT_TONE = {
  planning: "neutral",
  move_in: "teal",
  live: "completed",
  move_out: "high",
  closed: "neutral",
} as const;

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={pill({ tone: EVENT_TONE[status] })}>
      <span className={dot} />
      {EVENT_STATUS_LABEL[status]}
    </span>
  );
}
