import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { ExhibitorFormDialog } from "@/components/app/exhibitor-form-dialog";
import { eventsQuery, exhibitorsQuery, freightQuery, isStaff, membershipQuery, ticketsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/exhibitors")({
  head: () => ({
    meta: [
      { title: "Exhibitors — DrayFlow" },
      { name: "description", content: "Exhibitor companies, contacts, and booth assignments." },
      { property: "og:title", content: "Exhibitors — DrayFlow" },
      { property: "og:description", content: "Exhibitor companies, contacts, and booth assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(exhibitorsQuery()),
      queryClient.ensureQueryData(eventsQuery()),
      queryClient.ensureQueryData(ticketsQuery()),
      queryClient.ensureQueryData(freightQuery()),
    ]),
  component: ExhibitorsPage,
});

function ExhibitorsPage() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: exhibitors } = useSuspenseQuery(exhibitorsQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: tickets } = useSuspenseQuery(ticketsQuery());
  const { data: freight } = useSuspenseQuery(freightQuery());
  const [q, setQ] = useState("");

  const eventOptions = events.filter((e) => e.status !== "closed").map((e) => ({ id: e.id, name: e.name }));
  const filtered = exhibitors.filter((x) =>
    [x.company_name, x.contact_name, x.contact_email, ...x.event_exhibitors.map((b) => b.booth_number)]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Exhibitor management"
        title="Exhibitors"
        description="Companies exhibiting at your events, their contacts, and booth assignments."
        actions={
          isStaff(m) && m.organizationId ? (
            <ExhibitorFormDialog
              organizationId={m.organizationId}
              events={eventOptions}
              trigger={
                <Button variant="teal">
                  <Plus /> New exhibitor
                </Button>
              }
            />
          ) : null
        }
      />

      <Panel
        title={
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company, contact, booth"
              className="h-8 pl-8 text-sm font-normal"
            />
          </div>
        }
        action={<span className="text-xs text-muted-foreground">{filtered.length} exhibitors</span>}
      >
        {filtered.length === 0 ? (
          <EmptyState title="No exhibitors found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-4 py-2.5 font-semibold">Event · Booth</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Freight</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Open tickets</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((x) => (
                  <tr key={x.id} className="align-top hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{x.company_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="text-foreground">{x.contact_name ?? "—"}</div>
                      <div className="text-xs">{x.contact_email}</div>
                      <div className="text-xs">{x.contact_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {x.event_exhibitors.length === 0 ? (
                        <span className="text-muted-foreground">Not assigned</span>
                      ) : (
                        <ul className="grid gap-1">
                          {x.event_exhibitors.map((b) => (
                            <li key={b.id} className="flex items-center gap-2">
                              <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs font-medium">
                                {b.booth_number}
                              </span>
                              <Link
                                to="/events/$eventId"
                                params={{ eventId: b.event_id }}
                                className="truncate text-muted-foreground hover:text-foreground hover:underline"
                              >
                                {b.event?.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {freight.filter((f) => f.exhibitor_id === x.id).length}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {
                        tickets.filter(
                          (t) =>
                            t.exhibitor_id === x.id &&
                            (t.status === "requested" || t.status === "assigned" || t.status === "in_progress"),
                        ).length
                      }
                    </td>
                    <td className="px-2 py-2">
                      {isStaff(m) && m.organizationId && (
                        <ExhibitorFormDialog
                          organizationId={m.organizationId}
                          exhibitor={x}
                          events={eventOptions}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Edit ${x.company_name}`}>
                              <Pencil className="text-muted-foreground" />
                            </Button>
                          }
                        />
                      )}
                    </td>
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
