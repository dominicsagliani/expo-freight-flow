import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { EventStatusBadge, PriorityBadge, TicketStatusBadge } from "@/components/app/badges";
import {
  eventsQuery,
  freightQuery,
  membershipQuery,
  operatorsQuery,
  recentActivityQuery,
  ticketsQuery,
  isStaff,
} from "@/lib/queries";
import { computeDashboardStats } from "@/lib/dashboard-stats";
import { ACTIVITY_LABEL, SERVICE_LABEL, TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/labels";
import { fmtAgo, fmtDateRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — DrayFlow" },
      { name: "description", content: "Live material handling overview: open tickets, freight on site, and operator status." },
      { property: "og:title", content: "Overview — DrayFlow" },
      { property: "og:description", content: "Live material handling overview for your events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(ticketsQuery()),
      queryClient.ensureQueryData(freightQuery()),
      queryClient.ensureQueryData(operatorsQuery()),
      queryClient.ensureQueryData(recentActivityQuery()),
      queryClient.ensureQueryData(eventsQuery()),
    ]),
  component: Dashboard,
});

const PIPELINE: { key: TicketStatus; bar: string }[] = [
  { key: "requested", bar: "bg-status-requested" },
  { key: "assigned", bar: "bg-status-assigned" },
  { key: "in_progress", bar: "bg-status-progress" },
  { key: "completed", bar: "bg-status-completed" },
];

function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 font-display text-3xl font-semibold tabular-nums ${accent ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function describeActivity(a: { action: string; details: unknown }) {
  const d = (a.details ?? {}) as Record<string, string | null>;
  switch (a.action) {
    case "status_changed":
      return `${TICKET_STATUS_LABEL[d.from as TicketStatus] ?? d.from} → ${TICKET_STATUS_LABEL[d.to as TicketStatus] ?? d.to}`;
    case "assigned":
      return [d.operator, d.equipment].filter(Boolean).join(" · ") || "Unassigned";
    case "freight_attached":
    case "freight_scanned":
    case "freight_registered":
      return d.freight_code ?? "";
    case "ticket_created":
      return d.service_type ? SERVICE_LABEL[d.service_type as keyof typeof SERVICE_LABEL] : "";
    default:
      return "";
  }
}

function Dashboard() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: tickets } = useSuspenseQuery(ticketsQuery());
  const { data: freight } = useSuspenseQuery(freightQuery());
  const { data: operators } = useSuspenseQuery(operatorsQuery());
  const { data: activity } = useSuspenseQuery(recentActivityQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());

  const stats = computeDashboardStats(tickets, freight, operators);
  const activeEvent = events.find((e) => e.status !== "closed") ?? events[0];
  const queue = tickets
    .filter((t) => t.status === "requested" || t.status === "assigned" || t.status === "in_progress")
    .sort((a, b) => {
      const rank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
      return rank[a.priority] - rank[b.priority] || a.requested_at.localeCompare(b.requested_at);
    })
    .slice(0, 7);
  const pipelineTotal = PIPELINE.reduce((s, p) => s + stats.byStatus[p.key], 0) || 1;
  const operatorJob = new Map(
    tickets
      .filter((t) => t.status === "in_progress" || t.status === "assigned")
      .map((t) => [t.assigned_operator_id, t] as const),
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Overview"
        title={activeEvent ? activeEvent.name : "Operations overview"}
        description={
          activeEvent ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {activeEvent.venue} · Show {fmtDateRange(activeEvent.start_date, activeEvent.end_date)}
              <EventStatusBadge status={activeEvent.status} />
            </span>
          ) : (
            "Create your first event to start tracking material handling."
          )
        }
        actions={
          <>
            {isStaff(m) && (
              <Button asChild variant="outline">
                <Link to="/events">All events</Link>
              </Button>
            )}
            <Button asChild variant="teal">
              <Link to="/tickets/new">
                <Plus /> New ticket
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Open tickets" value={stats.open} sub={`${stats.urgentOpen} high or urgent`} />
        <Kpi label="Awaiting dispatch" value={stats.byStatus.requested} sub="Pending assignment" accent="text-status-requested" />
        <Kpi label="In progress" value={stats.byStatus.in_progress} sub={`${stats.completedToday} completed today`} accent="text-status-progress" />
        <Kpi
          label="Freight on site"
          value={`${stats.freightOnSite}/${stats.freightTotal}`}
          sub={`${stats.freightExpected} still expected`}
        />
      </div>

      <Panel title="Ticket pipeline" bodyClassName="p-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {PIPELINE.map((p) => (
            <div key={p.key} className={p.bar} style={{ width: `${(stats.byStatus[p.key] / pipelineTotal) * 100}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PIPELINE.map((p) => (
            <div key={p.key} className="flex items-center gap-2 text-sm">
              <span className={`size-2.5 rounded-sm ${p.bar}`} />
              <span className="text-muted-foreground">{TICKET_STATUS_LABEL[p.key]}</span>
              <span className="ml-auto font-semibold tabular-nums">{stats.byStatus[p.key]}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Priority queue"
          action={
            <Link to="/tickets" className="inline-flex items-center gap-1 text-xs font-medium text-status-progress hover:underline">
              All tickets <ArrowUpRight className="size-3.5" />
            </Link>
          }
        >
          {queue.length === 0 ? (
            <EmptyState title="No open tickets" description="New requests from exhibitors and dispatch will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/tickets/$ticketId"
                    params={{ ticketId: t.id }}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/60"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.exhibitor?.company_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Booth {t.booth_number ?? "—"} · {SERVICE_LABEL[t.service_type]}
                        {t.operator ? ` · ${t.operator.full_name}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <PriorityBadge priority={t.priority} />
                      <TicketStatusBadge status={t.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid content-start gap-6">
          {isStaff(m) && (
            <Panel
              title="Operators"
              action={
                <span className="text-xs text-muted-foreground">
                  {stats.operatorsAvailable} available · {stats.operatorsOnJob} on job
                </span>
              }
            >
              <ul className="divide-y divide-border">
                {operators.map((o) => {
                  const job = operatorJob.get(o.id);
                  return (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={`size-2 rounded-full ${o.status === "available" ? "bg-status-completed" : o.status === "on_job" ? "bg-status-progress" : "bg-status-cancelled"}`}
                      />
                      <span className="flex-1 text-sm font-medium">{o.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {job ? `${job.ticket_number} · ${TICKET_STATUS_LABEL[job.status]}` : o.status === "off_shift" ? "Off shift" : "Idle"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          <Panel title="Recent activity">
            {activity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ol className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {activity.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{ACTIVITY_LABEL[a.action] ?? a.action}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtAgo(a.created_at)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.ticket ? <span className="font-mono">{a.ticket.ticket_number}</span> : null}
                      {a.ticket ? " · " : ""}
                      {describeActivity(a)} · {a.actor_name ?? "System"}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
