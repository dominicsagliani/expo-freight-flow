import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { PriorityBadge, TicketStatusBadge } from "@/components/app/badges";
import { ticketsQuery } from "@/lib/queries";
import { SERVICE_LABEL, TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tickets/")({
  head: () => ({
    meta: [
      { title: "Material Handling Tickets — DrayFlow" },
      { name: "description", content: "Every forklift and material handling request across your events." },
      { property: "og:title", content: "Material Handling Tickets — DrayFlow" },
      { property: "og:description", content: "Forklift and material handling requests in DrayFlow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(ticketsQuery()),
  component: TicketsPage,
});

const FILTERS: ("open" | "all" | TicketStatus)[] = ["open", "requested", "assigned", "in_progress", "completed", "all"];

function TicketsPage() {
  const { data: tickets } = useSuspenseQuery(ticketsQuery());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");
  const [q, setQ] = useState("");

  const count = (f: (typeof FILTERS)[number]) =>
    tickets.filter((t) =>
      f === "all" ? true : f === "open" ? ["requested", "assigned", "in_progress"].includes(t.status) : t.status === f,
    ).length;

  const rows = tickets.filter((t) => {
    const okStatus =
      filter === "all" ? true : filter === "open" ? ["requested", "assigned", "in_progress"].includes(t.status) : t.status === filter;
    const needle = q.toLowerCase();
    const okQ =
      !needle ||
      [t.ticket_number, t.exhibitor?.company_name, t.booth_number, t.destination, t.operator?.full_name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    return okStatus && okQ;
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Ticket management"
        title="Material Handling Tickets"
        description="Requests from exhibitors and dispatch, with freight attached and full history."
        actions={
          <Button asChild variant="teal">
            <Link to="/tickets/new">
              <Plus /> New ticket
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {f === "open" ? "Open" : f === "all" ? "All" : TICKET_STATUS_LABEL[f]}
              <span className="ml-1.5 tabular-nums opacity-70">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ticket #, exhibitor, booth, operator" className="pl-8" />
        </div>
      </div>

      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="No tickets match" description="Try a different filter or create a new ticket." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface text-left">
                  <tr className="eyebrow">
                    <th className="px-4 py-2.5 font-semibold">Ticket</th>
                    <th className="px-4 py-2.5 font-semibold">Exhibitor · Booth</th>
                    <th className="px-4 py-2.5 font-semibold">Service</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Freight</th>
                    <th className="px-4 py-2.5 font-semibold">Priority</th>
                    <th className="px-4 py-2.5 font-semibold">Operator</th>
                    <th className="px-4 py-2.5 font-semibold">Requested</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link
                          to="/tickets/$ticketId"
                          params={{ ticketId: t.id }}
                          className="font-mono text-sm font-medium text-foreground hover:text-status-progress hover:underline"
                        >
                          {t.ticket_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.exhibitor?.company_name}</div>
                        <div className="text-xs text-muted-foreground">Booth {t.booth_number ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{SERVICE_LABEL[t.service_type]}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.ticket_freight.length}</td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.operator?.full_name ?? "—"}
                        {t.equipment ? <span className="ml-1 font-mono text-xs">· {t.equipment.unit_number}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDateTime(t.requested_at)}</td>
                      <td className="px-4 py-3">
                        <TicketStatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((t) => (
                <li key={t.id}>
                  <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="block px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium">{t.ticket_number}</span>
                      <TicketStatusBadge status={t.status} />
                    </div>
                    <div className="mt-1 text-sm font-medium">{t.exhibitor?.company_name}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Booth {t.booth_number ?? "—"} · {SERVICE_LABEL[t.service_type]}
                      </span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
