import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const money = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

/** Emails the exhibitor a receipt with the contractor's own pay link for one completed job. */
export const sendServiceInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; resend?: boolean }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input.ticketId)) throw new Error("Invalid job");
    return { ticketId: input.ticketId, resend: !!input.resend };
  })
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase
      .from("tickets")
      .select("id, ticket_number, status, charge_amount, completed_at, booth_number, service_type, invoice_sent_at, paid_at, organization_id, event:events(name), exhibitor:exhibitors(company_name, contact_name, contact_email)")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error || !t) return { sent: false, reason: "not_found" as const };
    if (t.status !== "completed") return { sent: false, reason: "not_completed" as const };
    if (t.paid_at) return { sent: false, reason: "already_paid" as const };
    if (t.invoice_sent_at && !data.resend) return { sent: false, reason: "already_sent" as const };
    const ex = t.exhibitor as { company_name: string; contact_name: string | null; contact_email: string | null } | null;
    if (!ex?.contact_email) return { sent: false, reason: "no_email" as const };
    const { data: org } = await context.supabase
      .from("organizations").select("name, payment_link_url, payment_instructions").eq("id", t.organization_id).maybeSingle();
    if (!org?.payment_link_url && !org?.payment_instructions) return { sent: false, reason: "no_payment_setup" as const };

    const { SERVICE_LABEL } = await import("@/lib/labels");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("service-receipt", ex.contact_email, {
      templateData: {
        contractorName: org.name, contactName: ex.contact_name ?? undefined, exhibitorName: ex.company_name,
        eventName: (t.event as { name: string } | null)?.name, booth: t.booth_number ?? undefined,
        ticketNumber: t.ticket_number, service: SERVICE_LABEL[t.service_type as keyof typeof SERVICE_LABEL],
        completedAt: t.completed_at ? new Date(t.completed_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : undefined,
        amount: money(t.charge_amount), paymentUrl: org.payment_link_url ?? undefined, instructions: org.payment_instructions ?? undefined,
      },
      idempotencyKey: `service-receipt-${t.id}${data.resend ? `-${Date.now()}` : ""}`,
    });
    if (!result.sent) return { sent: false, reason: result.reason };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tickets").update({ invoice_sent_at: new Date().toISOString() }).eq("id", t.id);
    return { sent: true as const, to: ex.contact_email };
  });

export const INVOICE_REASON: Record<string, string> = {
  not_found: "Job not found",
  not_completed: "Job isn't completed yet",
  already_paid: "Already marked paid",
  already_sent: "Receipt already sent",
  no_email: "This exhibitor has no contact email",
  no_payment_setup: "Add your payment link in Settings first",
  recipient_suppressed: "This email address has opted out of emails",
};
