import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { freightQuery, type TicketListItem } from "@/lib/queries";
import { buildDockQueue, type DockStatus } from "@/lib/dock-queue";
import { fmtAgo } from "@/lib/format";

const STATUS: Record<DockStatus, { label: string; tone: string }> = {
  waiting: { label: "Waiting at dock", tone: "text-status-requested" },
  in_transit: { label: "In transit", tone: "text-status-assigned" },
  delivered: { label: "Delivered", tone: "text-status-completed" },
  no_ticket: { label: "No ticket printed", tone: "text-muted-foreground" },
};

export function DockQueue({ eventId, tickets }: { eventId: string; tickets: TicketListItem[] }) {
  const { data: freight } = useSuspenseQuery({ ...freightQuery(), refetchInterval: 15_000 });
  const rows = buildDockQueue(freight.filter(f => f.event_id === eventId), tickets);
  return (
    <section className="grid gap-3 border-b border-border pb-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Truck className="size-4 text-teal" />Inbound freight queue · first truck in, first served</h2>
      {!rows.length && <p className="py-3 text-sm text-muted-foreground">No exhibitors with freight at this show yet.</p>}
      <ol className="grid gap-2">{rows.map(r => {
        const next = r.tickets.find(t => t.status !== "completed");
        return (
          <li key={r.exhibitorId} className={`grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-[3rem_1fr_auto] sm:items-center ${r.status === "waiting" ? "border-status-requested" : "border-border"}`}>
            <div className="font-mono text-2xl font-bold text-teal">{r.truck ? `#${r.truck}` : "—"}</div>
            <div className="min-w-0">
              <div className="font-semibold">{r.company} <span className="font-normal text-muted-foreground">· Booth {r.booth ?? "—"}</span></div>
              <div className="text-xs text-muted-foreground">{r.freightCount} freight · {r.pieces} pcs · {r.weight.toLocaleString()} lb · <span className="font-mono">{r.codes.slice(0, 3).join(", ")}{r.codes.length > 3 ? ` +${r.codes.length - 3}` : ""}</span></div>
              {r.firstPrintedAt && <div className="text-xs text-muted-foreground">First ticket printed {fmtAgo(r.firstPrintedAt)}{r.truck ? ` · Truck ${r.truck}` : ""}</div>}
            </div>
            <div className="text-left sm:text-right">
              <div className={`text-sm font-semibold ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</div>
              {r.forklifts.length > 0 && <div className="text-xs text-muted-foreground">On {r.forklifts.join(", ")}</div>}
              {next && <Link to="/tickets/$ticketId" params={{ ticketId: next.id }} className="text-xs hover:underline">{next.ticket_number}</Link>}
            </div>
          </li>
        );
      })}</ol>
    </section>
  );
}
