import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { EventStatusBadge } from "@/components/app/badges";
import { fmtDateRange } from "@/lib/format";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { BoothFreightDialog } from "@/components/app/freight-history-dialog";

export const Route = createFileRoute("/_authenticated/event-status")({
  head: () => ({
    meta: [
      { title: "Event status — ExpoHaul" },
      { name: "description", content: "Read-only live freight and delivery progress for venue and show organizer partners." },
      { property: "og:title", content: "Event status — ExpoHaul" },
      { property: "og:description", content: "Live freight and delivery progress per booth, without pricing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventStatusPage,
});

function EventStatusPage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["viewer-events"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("viewer_events");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const [eventId, setEventId] = useState("");
  useEffect(() => { if (!eventId && events[0]) setEventId(events[0].id); }, [events, eventId]);
  useRealtimeRefresh(["tickets", "freight_items"], [["event-board"], ["event-freight"]]);
  const { data: rows = [] } = useQuery({
    queryKey: ["event-board", eventId],
    enabled: !!eventId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("event_status_board", { _event: eventId });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const { data: crates = [] } = useQuery({
    queryKey: ["event-freight", eventId],
    enabled: !!eventId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("event_freight_status", { _event: eventId });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const ev = events.find((e) => e.id === eventId);
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const stats = [
    ["Freight pieces", sum("freight_total")],
    ["Received", sum("freight_received")],
    ["Delivered", sum("freight_delivered")],
    ["Open jobs", sum("jobs_open")],
    ["On hold", sum("jobs_held")],
    ["Open issues", sum("open_issues")],
  ] as const;

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader eyebrow="Read-only view" title="Event status" description="Live freight and delivery progress by booth. Prices and contact details are never shown here."
        actions={events.length > 1 ? (
          <select aria-label="Event" className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        ) : undefined}
      />
      {!isLoading && events.length === 0 ? (
        <EmptyState title="No events shared with you yet" />
      ) : ev && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-display text-lg font-semibold">{ev.name}</span>
            <span className="text-muted-foreground">{ev.venue} · {fmtDateRange(ev.start_date, ev.end_date)}</span>
            <EventStatusBadge status={ev.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-card p-3">
                <div className="eyebrow">{l}</div>
                <div className="font-display text-2xl font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <Panel title={`Booths (${rows.length})`} className="min-w-0">
            {rows.length === 0 ? <EmptyState title="No exhibitors on this event yet" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface text-left">
                    <tr className="eyebrow">
                      <th className="px-4 py-2.5">Booth</th><th className="px-4 py-2.5">Exhibitor</th>
                      <th className="px-4 py-2.5 text-right">Freight</th><th className="px-4 py-2.5 text-right">Received</th>
                      <th className="px-4 py-2.5 text-right">Delivered</th><th className="px-4 py-2.5 text-right">Open jobs</th>
                      <th className="px-4 py-2.5 text-right">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.booth_number + r.exhibitor_name}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold">
                          <BoothFreightDialog
                            boothNumber={r.booth_number}
                            exhibitorName={r.exhibitor_name}
                            crates={crates.filter((crate) => crate.exhibitor_name === r.exhibitor_name && crate.booth_number === r.booth_number)}
                            trigger={<button type="button" className="font-mono text-xs font-semibold text-teal hover:underline" aria-label={`View crates for booth ${r.booth_number}`}>{r.booth_number}</button>}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{r.exhibitor_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.freight_total}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.freight_received}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.freight_delivered}{r.freight_total > 0 && r.freight_delivered === r.freight_total ? " ✓" : ""}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.jobs_open}{r.jobs_held ? ` (+${r.jobs_held} held)` : ""}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${r.open_issues ? "font-semibold text-destructive" : ""}`}>{r.open_issues}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
