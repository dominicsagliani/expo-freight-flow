import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteShipmentExhibitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: event, error } = await db.from("events").select("id, name, organization_id, event_exhibitors(booth_number, exhibitor:exhibitors(id, company_name, contact_email))").eq("id", data.eventId).single();
    if (error || !event) throw new Error("Event not available");
    const { data: admin } = await db.rpc("is_org_admin", { _org: event.organization_id });
    if (!admin) throw new Error("Only a company admin can invite exhibitors");
    const contacts = event.event_exhibitors.filter((b) => b.exhibitor?.contact_email);
    if (contacts.length > 300) throw new Error("Send invitations for at most 300 exhibitors at once");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const outcomes: { company: string; sent: boolean; reason?: string }[] = [];
    // One user-requested event invitation per recipient; no recurring campaign or queue.
    for (const booth of contacts) {
      const ex = booth.exhibitor;
      if (!ex?.contact_email) continue;
      try {
        const email = ex.contact_email.trim().toLowerCase();
        const { data: existing, error: lookupError } = await db.from("invitations").select("id, status, expires_at")
          .eq("organization_id", event.organization_id).eq("exhibitor_id", ex.id).eq("email", email).eq("role", "exhibitor")
          .in("status", ["pending", "accepted"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (lookupError) throw lookupError;
        let invitationId = existing?.id;
        if (!existing || (existing.status === "pending" && new Date(existing.expires_at).getTime() < Date.now())) {
          const { data: invitation, error: insertError } = await db.from("invitations").insert({
            organization_id: event.organization_id, email, role: "exhibitor", exhibitor_id: ex.id,
          }).select("id").single();
          if (insertError) throw insertError;
          invitationId = invitation.id;
        }
        const result = await sendTemplateEmail("shipment-access", email, {
          templateData: { companyName: ex.company_name, eventName: event.name, booth: booth.booth_number, trackingUrl: `https://expohaul.com/shipments?eventId=${event.id}` },
          idempotencyKey: `shipment-access-${event.id}-${invitationId}`,
        });
        outcomes.push({ company: ex.company_name, ...result });
      } catch { outcomes.push({ company: ex.company_name, sent: false, reason: "Could not send — retry later" }); }
    }
    return { sent: outcomes.filter((r) => r.sent).length, failed: outcomes.filter((r) => !r.sent), missingEmails: event.event_exhibitors.length - contacts.length };
  });