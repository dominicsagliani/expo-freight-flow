import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { invoiceEligibility } from "@/lib/invoice-rules";

const money = (n: number | null | undefined) => n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

export async function invoiceCompletedTicket(db: SupabaseClient<Database>, ticketId: string, resend = false): Promise<{ sent: true; to: string } | { sent: false; reason: string }> {
    const { data: allowed } = await db.rpc("can_work_ticket", { _ticket: ticketId });
    if (!allowed) return { sent: false as const, reason: "forbidden" };
    const { data: t, error } = await db
      .from("tickets")
      .select("id, ticket_number, status, charge_amount, completed_at, booth_number, service_type, invoice_sent_at, paid_at, organization_id, event:events(name), exhibitor:exhibitors(company_name, contact_name, contact_email)")
      .eq("id", ticketId)
      .maybeSingle();
    if (error || !t) return { sent: false, reason: "not_found" as const };
    const ineligible = invoiceEligibility(t, resend);
    if (ineligible) return { sent: false as const, reason: ineligible };
    const ex = t.exhibitor as { company_name: string; contact_name: string | null; contact_email: string | null } | null;
    if (!ex?.contact_email) return { sent: false, reason: "no_email" as const };
    const { data: org } = await db
      .from("organizations").select("name, payment_link_url, payment_instructions").eq("id", t.organization_id).maybeSingle();
    if (!org) return { sent: false, reason: "not_found" };

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
      idempotencyKey: `service-receipt-${t.id}${resend ? `-${Date.now()}` : ""}`,
    });
    if (!result.sent) return { sent: false, reason: result.reason };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: stampError } = await supabaseAdmin.from("tickets").update({ invoice_sent_at: new Date().toISOString() }).eq("id", t.id);
    if (stampError) throw new Error("Invoice sent, but its status could not be saved; retry is safe");
    return { sent: true as const, to: ex.contact_email };
}
