import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendServiceInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; resend?: boolean }) => z.object({ ticketId: z.string().uuid(), resend: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { invoiceCompletedTicket } = await import("./service-invoice.server");
    return invoiceCompletedTicket(context.supabase, data.ticketId, data.resend);
  });

const completionSchema = z.object({
  ticketId: z.string().uuid(), operation: z.enum(["scan", "call_in", "manual"]),
  token: z.string().optional(), action: z.enum(["pickup", "deliver"]).optional(), equipment: z.string().uuid().optional(),
  boothOk: z.boolean().optional(), flag: z.string().optional(), note: z.string().optional(),
});
const scanSchema = z.object({
  ok: z.boolean(), error: z.string().optional(), action: z.string().optional(), freight_code: z.string().optional(),
  freight_id: z.string().optional(), description: z.string().optional(), exhibitor: z.string().optional(),
  booth: z.string().nullable().optional(), ticket_number: z.string().optional(), timer_stopped: z.boolean().optional(), job_completed: z.boolean().optional(),
});

export const completeAndInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof completionSchema>) => completionSchema.parse(input))
  .handler(async ({ data, context }) => {
    let scan: z.infer<typeof scanSchema> | null = null;
    if (data.operation === "scan") {
      if (!data.token || !data.action || !data.equipment) throw new Error("Missing scan details");
      const { data: result, error } = await context.supabase.rpc("op_scan_freight", {
        _ticket: data.ticketId, _token: data.token, _action: data.action, _equipment: data.equipment,
        ...(data.boothOk !== undefined ? { _booth_ok: data.boothOk } : {}),
        ...(data.flag ? { _flag: data.flag } : {}), ...(data.note ? { _note: data.note } : {}),
      });
      if (error) throw new Error(error.message);
      scan = scanSchema.parse(result);
      if (!scan.ok || !scan.job_completed) return { scan, invoice: null };
    } else {
      const result = data.operation === "call_in"
        ? await context.supabase.rpc("op_complete_call_in", { _ticket: data.ticketId })
        : await context.supabase.rpc("operator_complete_job", { _ticket: data.ticketId, _notes: data.note ?? "" });
      if (result.error) throw new Error(result.error.message);
    }
    const { invoiceCompletedTicket } = await import("./service-invoice.server");
    try { return { scan, invoice: await invoiceCompletedTicket(context.supabase, data.ticketId) }; }
    catch { return { scan, invoice: { sent: false as const, reason: "send_failed" } }; }
  });

export const INVOICE_REASON: Record<string, string> = {
  no_charge: "Charge not calculated yet — check the event rates",
  forbidden: "Only staff or this job’s driver can send its invoice",
  send_failed: "Invoice not sent — retry from the job page",
  not_found: "Job not found",
  not_completed: "Job isn't completed yet",
  already_paid: "Already marked paid",
  already_sent: "Receipt already sent",
  no_email: "This exhibitor has no contact email",
  no_payment_setup: "Add your payment link in Settings first",
  recipient_suppressed: "This email address has opted out of emails",
};
