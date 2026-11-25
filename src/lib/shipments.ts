type Freight = { id: string; pieces: number; arrival_status: string; arrived_at: string | null };
type Job = { status: string; charge_amount: number | null; paid_at: string | null; invoice_sent_at: string | null; ticket_freight: { freight_id: string; picked_up_at?: string | null; delivered_at?: string | null }[] };

/** Current freight state is authoritative; only open pickup scans imply transit. */
export function shipmentSummary(freight: Freight[], jobs: Job[]) {
  const moving = new Set(jobs.filter((j) => j.status === "in_progress").flatMap((j) => j.ticket_freight.filter((f) => f.picked_up_at && !f.delivered_at).map((f) => f.freight_id)));
  let expected = 0, received = 0, delivered = 0, transit = 0;
  for (const f of freight) {
    expected += f.pieces;
    if (f.arrival_status === "delivered_to_booth") delivered += f.pieces;
    else if (moving.has(f.id)) transit += f.pieces;
    if (f.arrived_at || f.arrival_status !== "expected" || moving.has(f.id)) received += f.pieces;
  }
  const done = jobs.filter((j) => j.status === "completed");
  return {
    expected, received, delivered, transit,
    notArrived: expected - received,
    total: Math.round(done.reduce((n, j) => n + Number(j.charge_amount ?? 0), 0) * 100) / 100,
    unpaid: Math.round(done.filter((j) => !j.paid_at).reduce((n, j) => n + Number(j.charge_amount ?? 0), 0) * 100) / 100,
    pendingInvoices: done.filter((j) => !j.paid_at && !j.invoice_sent_at).length,
    awaitingCharge: done.filter((j) => j.charge_amount == null).length,
  };
}

export function sortBoothLabels<T extends { booth_number: string | null; freight_code: string }>(labels: T[]): T[] {
  return [...labels].sort((a, b) => (a.booth_number ?? "").localeCompare(b.booth_number ?? "", "en", { numeric: true }) || a.freight_code.localeCompare(b.freight_code));
}