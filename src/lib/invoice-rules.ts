export function invoiceEligibility(ticket: { status: string; paid_at: string | null; invoice_sent_at: string | null; charge_amount: number | null }, resend = false): string | null {
  if (ticket.status !== "completed") return "not_completed";
  if (ticket.paid_at) return "already_paid";
  if (ticket.invoice_sent_at && !resend) return "already_sent";
  if (ticket.charge_amount == null || !Number.isFinite(Number(ticket.charge_amount))) return "no_charge";
  return null;
}