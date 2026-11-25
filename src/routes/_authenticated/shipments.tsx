import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp, Printer, Search, Package, Truck, CheckCircle2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { ExhibitorImportDialog } from "@/components/app/exhibitor-import-dialog";
import { FreightHistoryDialog } from "@/components/app/freight-history-dialog";
import { ServicePayment } from "@/components/app/service-payment";
import { ArrivalBadge } from "@/components/app/badges";
import { eventsQuery, exhibitorsQuery, freightQuery, ticketsQuery, membershipQuery, isStaff, isAdmin } from "@/lib/queries";
import { shipmentSummary } from "@/lib/shipments";
import { fmtMoney } from "@/lib/billing";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ShipmentInvitations } from "@/components/app/shipment-invitations";
import { ReceiveShipment } from "@/components/app/receive-shipment";

export const Route = createFileRoute("/_authenticated/shipments")({
  validateSearch: (s: Record<string, unknown>) => ({ eventId: typeof s["eventId"] === "string" ? s["eventId"] : "" }),
  loader: ({ context: { queryClient } }) => Promise.all([
    queryClient.ensureQueryData(eventsQuery()), queryClient.ensureQueryData(exhibitorsQuery()),
    queryClient.ensureQueryData(freightQuery()), queryClient.ensureQueryData(ticketsQuery()),
  ]),
  head: () => ({ meta: [
    { title: "Shipments & tracking — ExpoHaul" },
    { name: "description", content: "Exhibitor freight arrivals, booth deliveries, charges and invoices in one event workspace." },
    { property: "og:title", content: "Shipments & tracking — ExpoHaul" },
    { property: "og:description", content: "Follow each freight piece from expected arrival to booth delivery and payment." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ShipmentsPage,
});

function ShipmentsPage() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: exhibitors } = useSuspenseQuery(exhibitorsQuery());
  const { data: freight } = useSuspenseQuery(freightQuery());
  const { data: tickets } = useSuspenseQuery(ticketsQuery());
  const { eventId: selected } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const eventId = selected || events.find((e) => e.status !== "closed")?.id || events[0]?.id || "";
  const staff = isStaff(m);
  const changeEvent = (id: string) => void navigate({ to: "/shipments", search: { eventId: id } });
  useRealtimeRefresh(["freight_items", "tickets", "ticket_freight"], [["freight"], ["tickets"]]);
  const eventFreight = freight.filter((f) => f.event_id === eventId);
  const eventTickets = tickets.filter((t) => t.event_id === eventId);
  const all = shipmentSummary(eventFreight, eventTickets);
  const companies = exhibitors.filter((x) => x.event_exhibitors.some((b) => b.event_id === eventId) || eventFreight.some((f) => f.exhibitor_id === x.id))
    .filter((x) => `${x.company_name} ${x.event_exhibitors.map((b) => b.booth_number).join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="grid min-w-0 gap-6">
    <PageHeader eyebrow={staff ? "Event operations" : "Exhibitor portal"} title={staff ? "Shipments" : "My freight"} actions={staff && m.organizationId ? <div className="flex flex-wrap gap-2">
      <ExhibitorImportDialog organizationId={m.organizationId} events={events.filter((e) => e.status !== "closed")} existing={exhibitors} onImported={changeEvent}
        trigger={<Button variant="teal"><FileUp /> Import exhibitors</Button>} />
      <Button variant="outline" disabled={!eventFreight.length} asChild><Link to="/shipment-labels" search={{ eventId }}><Printer /> Print all labels</Link></Button>
    </div> : undefined} />
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
      <Select value={eventId} onValueChange={changeEvent}><SelectTrigger className="w-full sm:w-80" aria-label="Shipment event"><SelectValue placeholder="Choose event" /></SelectTrigger><SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
      {staff && <Button variant="outline" asChild><Link to="/freight">Receiving</Link></Button>}
      {staff && <Button variant="outline" asChild><Link to="/dispatch">Dispatch</Link></Button>}
      {isAdmin(m) && eventId && <ShipmentInvitations eventId={eventId} contacts={exhibitors.filter((x) => x.contact_email && x.event_exhibitors.some((b) => b.event_id === eventId)).length} />}
    </div>
    <div className="grid grid-cols-2 gap-4 border-b border-border pb-6 lg:grid-cols-4">
      {[
        { label: "Arrived at venue", value: `${all.received} / ${all.expected}`, icon: Package },
        { label: "In transit", value: all.transit, icon: Truck },
        { label: "At booth", value: `${all.delivered} / ${all.expected}`, icon: CheckCircle2 },
        { label: "Completed charges", value: fmtMoney(all.total), icon: Receipt },
      ].map((s) => <div key={s.label} className="min-w-0"><s.icon className="mb-2 size-5 text-status-progress" /><div className="break-words font-display text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>)}
    </div>
    <div className="relative max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or booth" /></div>
    {!companies.length && <EmptyState title={staff ? "No exhibitors for this event" : "No freight assigned to your account"} />}
    <div className="divide-y divide-border">
      {companies.map((ex) => {
        const items = eventFreight.filter((f) => f.exhibitor_id === ex.id);
        const jobs = eventTickets.filter((t) => t.exhibitor_id === ex.id);
        const s = shipmentSummary(items, jobs);
        const booth = ex.event_exhibitors.find((b) => b.event_id === eventId)?.booth_number;
        return <section key={ex.id} className="min-w-0 py-5 first:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="break-words font-display text-lg font-bold">{ex.company_name}</h2><p className="text-sm text-muted-foreground">Booth {booth ?? "—"} · {s.delivered} of {s.expected} pieces at booth</p></div>
            <div className="text-sm"><span className="font-semibold">{fmtMoney(s.unpaid)} unpaid</span><div className="text-xs text-muted-foreground">{fmtMoney(s.total)} completed services{s.awaitingCharge ? ` · ${s.awaitingCharge} charge pending` : ""}</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span className={s.notArrived ? "text-status-requested" : "text-status-completed"}>{s.expected === 0 ? "No pieces registered" : s.notArrived ? `${s.notArrived} not yet arrived` : "All registered pieces arrived"}</span>
            <span>{s.transit} in transit</span>
            {s.pendingInvoices > 0 && <span className="text-status-requested">{s.pendingInvoices} invoice{ s.pendingInvoices === 1 ? "" : "s"} pending</span>}
            {staff && !ex.contact_email && <span className="text-destructive">Contact email missing</span>}
          </div>
          {staff && m.organizationId && items.some((f) => f.arrival_status === "expected" && !f.bol_id) && <div className="mt-3"><ReceiveShipment eventId={eventId} exhibitorId={ex.id} organizationId={m.organizationId} pieces={items.filter((f) => f.arrival_status === "expected" && !f.bol_id)} /></div>}
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-status-progress">Freight & invoices</summary>
            <div className="mt-3 grid gap-2">
              {items.map((f) => <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm">
                <FreightHistoryDialog freightId={f.id} freightCode={f.freight_code} trigger={<Button variant="ghost" size="sm" className="font-mono">{f.freight_code}</Button>} />
                <span className="min-w-0 break-words text-muted-foreground">{f.description}{f.storage_location ? ` · ${f.storage_location}` : ""}</span>
                <ArrivalBadge status={f.arrival_status} />
              </div>)}
              {jobs.filter((t) => t.status === "completed").map((t) => <div key={t.id} className="grid gap-2 border-t border-border py-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm"><Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="font-mono font-semibold text-status-progress">{t.ticket_number}</Link><span>{fmtMoney(t.charge_amount)}</span></div>
                <ServicePayment t={t} canManage={staff} />
              </div>)}
            </div>
          </details>
        </section>;
      })}
    </div>
  </div>;
}