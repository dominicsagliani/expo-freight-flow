export type DockTicket = { id: string; exhibitor_id: string | null; status: string; created_at: string; ticket_number: string; ticket_freight?: { freight_id: string }[] | null; equipment?: { unit_number: string } | null };
export type DockFreight = { id: string; exhibitor_id: string; weight_lbs: number; pieces: number; freight_code: string; booth_number: string | null; arrival_status: string; exhibitor?: { id: string; company_name: string } | null };
export type DockStatus = "waiting" | "in_transit" | "delivered" | "no_ticket";
export type DockRow = { exhibitorId: string; company: string; booth: string | null; firstPrintedAt: string | null; truck: number | null; freightCount: number; pieces: number; weight: number; codes: string[]; status: DockStatus; tickets: DockTicket[]; forklifts: string[] };

/** Exhibitors with freight, ranked by their first printed (created) ticket — first truck in, first served. */
export function buildDockQueue(freight: DockFreight[], tickets: DockTicket[]): DockRow[] {
  const byEx = new Map<string, DockFreight[]>();
  for (const f of freight) byEx.set(f.exhibitor_id, [...(byEx.get(f.exhibitor_id) ?? []), f]);
  const rows: DockRow[] = [...byEx.entries()].map(([id, items]) => {
    const ts = tickets.filter(t => t.exhibitor_id === id && t.status !== "cancelled").sort((a, b) => a.created_at.localeCompare(b.created_at));
    const open = ts.filter(t => t.status !== "completed");
    const awaitingDelivery = items.some(i => !["delivered_to_booth", "shipped"].includes(i.arrival_status));
    const status: DockStatus = !ts.length ? "no_ticket" : open.some(t => t.status === "requested") ? "waiting" : open.length ? "in_transit" : awaitingDelivery ? "waiting" : "delivered";
    return { exhibitorId: id, company: items[0]?.exhibitor?.company_name ?? "Exhibitor", booth: items.find(i => i.booth_number)?.booth_number ?? null, firstPrintedAt: ts[0]?.created_at ?? null, truck: null, freightCount: items.length, pieces: items.reduce((s, i) => s + i.pieces, 0), weight: items.reduce((s, i) => s + Number(i.weight_lbs || 0), 0), codes: items.map(i => i.freight_code), status, tickets: ts, forklifts: [...new Set(open.map(t => t.equipment?.unit_number).filter((u): u is string => !!u))] };
  });
  rows.sort((a, b) => a.firstPrintedAt === b.firstPrintedAt ? a.company.localeCompare(b.company) : !a.firstPrintedAt ? 1 : !b.firstPrintedAt ? -1 : a.firstPrintedAt.localeCompare(b.firstPrintedAt));
  let n = 0;
  for (const r of rows) if (r.firstPrintedAt) r.truck = ++n;
  return rows;
}
