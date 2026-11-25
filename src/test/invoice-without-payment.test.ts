import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
const { sendEmail, stamp } = vi.hoisted(() => ({ sendEmail: vi.fn(async () => ({ sent: true })), stamp: vi.fn() }));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail: sendEmail }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ update: stamp.mockReturnValue({ eq: async () => ({ error: null }) }) }) } }));
import { invoiceCompletedTicket } from "@/utils/service-invoice.server";

describe("invoicing before payment collection", () => {
  it("sends a completed service invoice without a payment link or instructions", async () => {
    const db = {
      rpc: async () => ({ data: true }),
      from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
        error: null,
        data: table === "organizations" ? { name: "Test Contractor", payment_link_url: null, payment_instructions: null } : {
          id: "job-1", ticket_number: "MH-1", organization_id: "org-1", status: "completed", charge_amount: 130,
          paid_at: null, invoice_sent_at: null, completed_at: "2026-11-25T01:00:00Z", booth_number: "101", service_type: "inbound_delivery",
          event: { name: "Test Show" }, exhibitor: { company_name: "Test Exhibitor", contact_name: "Jo", contact_email: "jo@example.test" },
        },
      }) }) }) }),
    } as unknown as SupabaseClient<Database>;
    expect(await invoiceCompletedTicket(db, "job-1")).toEqual({ sent: true, to: "jo@example.test" });
    expect(sendEmail).toHaveBeenCalledWith("service-receipt", "jo@example.test", expect.objectContaining({
      templateData: expect.objectContaining({ amount: "$130.00", paymentUrl: undefined, instructions: undefined }),
      idempotencyKey: "service-receipt-job-1",
    }));
    expect(stamp).toHaveBeenCalled();
  });
});