import { Link } from "@tanstack/react-router";
import { FileText, Printer, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrivalBadge } from "./badges";
import { FreightHistoryDialog } from "./freight-history-dialog";
import { ReportFreightIssueDialog } from "./freight-issues";
import { InboundReceive } from "./inbound-receive";
import { inboundCounts, inboundOverview } from "@/lib/inbound";
import { fmtDateTime } from "@/lib/format";
import type { InboundShipment, TicketListItem } from "@/lib/queries";

async function openDocument(path: string) {
  const { data, error } = await supabase.storage.from("bol-documents").createSignedUrl(path, 300);
  if (error) toast.error(error.message);
  else window.open(data.signedUrl, "_blank", "noopener");
}

export function InboundList({ shipments, search, selectedId, staff, tickets }: {
  shipments: InboundShipment[]; search: string; selectedId: string; staff: boolean; tickets: TicketListItem[];
}) {
  const q = search.trim().toLowerCase();
  const shown = shipments.filter((s) => !q || [s.exhibitor?.company_name, s.booth_number, s.carrier, s.id].some((v) => v?.toLowerCase().includes(q)));
  if (!shipments.length) return null;
  return <section className="min-w-0 border-b border-border pb-6" aria-label="Inbound shipments">
    <h2 className="mb-4 font-display text-lg font-semibold">Inbound shipments ({shown.length})</h2>
    <div className="grid gap-3">{shown.map((s) => {
      const c = inboundCounts(s, s.freight);
      const moving = new Set(tickets.filter((t) => t.status === "in_progress").flatMap((t) => t.ticket_freight.filter((f) => f.picked_up_at && !f.delivered_at).map((f) => f.freight_id)));
      const transit = s.freight.filter((f) => moving.has(f.id)).length;
      return <details key={s.id} open={selectedId === s.id ? true : undefined} className="min-w-0 rounded-md border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm"><span className="font-semibold">{s.exhibitor?.company_name} · Booth {s.booth_number}</span><span className="ml-3 text-muted-foreground">{s.carrier || "Carrier not entered"} · {s.expected_arrival || "Unscheduled"}</span><span className="mt-1 block text-xs">{c.status} · {c.actual} received / {c.expected} expected{c.missing > 0 ? ` · ${c.missing} missing` : ""}{c.extra > 0 ? ` · ${c.extra} ${s.unexpected ? "unregistered" : "extra"}` : ""}</span></summary>
        <div className="grid min-w-0 gap-3 border-t border-border p-4">
          <div className="flex flex-wrap gap-4 text-xs"><span>{c.waiting - transit > 0 ? c.waiting - transit : 0} waiting for delivery</span><span>{transit} in transit</span><span>{c.delivered} at booth</span><span className="font-mono">Shipment {s.id.slice(0, 8)}</span></div>
          {s.note && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{s.note}</p>}
          <div className="flex flex-wrap gap-2">{staff && <InboundReceive shipment={s} />}
            {staff && s.storage_path && <Button variant="outline" size="sm" onClick={() => { if (s.storage_path) void openDocument(s.storage_path); }}><FileText /> {s.original_filename || "BOL"}</Button>}
            {staff && <ReportFreightIssueDialog freight={s.freight} orgId={s.organization_id} trigger={<Button variant="outline" size="sm"><AlertTriangle /> Report issue</Button>} />}
            {staff && <Button variant="outline" size="sm" asChild><Link to="/tickets/new">New ticket</Link></Button>}
          </div>
          <div className="divide-y divide-border">{s.freight.map((f) => <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
            <FreightHistoryDialog freightId={f.id} freightCode={f.freight_code} trigger={<Button variant="ghost" size="sm" className="font-mono">{f.freight_code}</Button>} />
            <span className="min-w-0 break-words text-muted-foreground">{f.description}{f.inbound_extra ? " · Extra" : ""}</span><ArrivalBadge status={f.arrival_status} />
            <Button asChild variant="outline" size="icon" aria-label={`Print ${f.freight_code}`} title={`Print ${f.freight_code}`}><Link to="/labels/$freightId" params={{ freightId: f.id }}><Printer /></Link></Button>
          </div>)}</div>
          {staff && s.receipts.length > 0 && <div className="grid gap-2 border-t border-border pt-3">{s.receipts.map((r) => <div key={r.id} className="text-xs"><span className="font-semibold">{r.received_count} received · {fmtDateTime(r.created_at)}</span>{r.note && <p className="whitespace-pre-wrap break-words text-muted-foreground">{r.note}</p>}{r.storage_path && <Button variant="ghost" size="sm" onClick={() => { if (r.storage_path) void openDocument(r.storage_path); }}><FileText />{r.original_filename || "Arrival BOL"}</Button>}</div>)}</div>}
        </div>
      </details>;
    })}</div>
  </section>;
}

export function InboundOverview({ shipments }: { shipments: InboundShipment[] }) {
  const s = inboundOverview(shipments);
  return <section className="min-w-0 border-y border-border py-5" aria-label="Inbound freight overview">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">Inbound freight</h2><Button variant="outline" size="sm" asChild><Link to="/shipments" search={{ eventId: "" }}>View shipments</Link></Button></div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{[
      ["Expected shipments", s.expectedShipments], ["With arrivals", s.receivedShipments], ["Received / expected pieces", `${s.actual} / ${s.expected}`], ["Outstanding shipments", s.outstanding], ["Unexpected arrivals", s.unexpected],
    ].map(([label, value]) => <div key={label}><div className="font-display text-2xl font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}</div>
    {!!shipments.length && <ul className="mt-4 divide-y divide-border">{shipments.slice(0, 5).map((row) => { const c = inboundCounts(row, row.freight); return <li key={row.id}><Link to="/shipments" search={{ eventId: row.event_id, shipmentId: row.id }} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{row.exhibitor?.company_name} · Booth {row.booth_number}</span><span className="text-muted-foreground">{c.status} · {c.actual} / {c.expected} pieces</span></Link></li>; })}</ul>}
  </section>;
}