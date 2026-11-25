import { describe, expect, it } from "vitest";
import { invoiceEligibility } from "@/lib/invoice-rules";
const job = { status: "completed", paid_at: null, invoice_sent_at: null, charge_amount: 130 };
describe("completion invoices", () => {
  it("allows an invoice immediately on job completion", () => { expect(invoiceEligibility(job)).toBeNull(); });
  it("never invoices work still in progress", () => { expect(invoiceEligibility({ ...job, status: "in_progress" })).toBe("not_completed"); });
  it("does not duplicate an invoice on retry", () => { expect(invoiceEligibility({ ...job, invoice_sent_at: "2026-11-25" })).toBe("already_sent"); });
  it("does not send an unknown charge as an amount due", () => { expect(invoiceEligibility({ ...job, charge_amount: null })).toBe("no_charge"); });
});