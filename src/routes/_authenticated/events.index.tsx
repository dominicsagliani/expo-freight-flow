import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { EventStatusBadge } from "@/components/app/badges";
import { EventFormDialog } from "@/components/app/event-form-dialog";
import { DeleteEventButton } from "@/components/app/admin-reset-actions";
import { eventsQuery, membershipQuery, isAdmin, ticketsQuery } from "@/lib/queries";
import { fmtDateRange, fmtShortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({
    meta: [
      { title: "Events — ExpoHaul" },
      { name: "description", content: "Trade shows and exhibitions managed by your company." },
      { property: "og:title", content: "Events — ExpoHaul" },
      { property: "og:description", content: "Trade shows and exhibitions managed in ExpoHaul." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(eventsQuery()), queryClient.ensureQueryData(ticketsQuery())]),
  component: EventsPage,
});

function EventsPage() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: tickets } = useSuspenseQuery(ticketsQuery());

  const openByEvent = new Map<string, number>();
  for (const t of tickets) {
    if (t.status === "requested" || t.status === "assigned" || t.status === "in_progress") {
      openByEvent.set(t.event_id, (openByEvent.get(t.event_id) ?? 0) + 1);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Event management"
        title="Events"
        description="Shows, venues, move-in windows, and participating exhibitors."
        actions={
          isAdmin(m) && m.organizationId ? (
            <EventFormDialog
              organizationId={m.organizationId}
              trigger={
                <Button variant="teal">
                  <Plus /> New event
                </Button>
              }
            />
          ) : null
        }
      />

      <Panel>
        {events.length === 0 ? (
          <EmptyState title="No events yet" description="Create an event to start registering exhibitors and freight." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-2.5 font-semibold">Event</th>
                  <th className="px-4 py-2.5 font-semibold">Venue</th>
                  <th className="px-4 py-2.5 font-semibold">Move-in</th>
                  <th className="px-4 py-2.5 font-semibold">Show dates</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Exhibitors</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Open tickets</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  {isAdmin(m) && <th className="w-12"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: e.id }}
                        className="font-medium text-foreground hover:text-status-progress hover:underline"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span>
                          {e.venue}
                          {e.city ? `, ${e.city}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtShortDate(e.move_in_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        {fmtDateRange(e.start_date, e.end_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{e.event_exhibitors.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{openByEvent.get(e.id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <EventStatusBadge status={e.status} />
                    </td>
                    {isAdmin(m) && <td className="px-2 py-3"><DeleteEventButton eventId={e.id} name={e.name} compact /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
