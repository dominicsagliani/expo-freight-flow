import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BolAiPage, BolExtractionResponse } from "@/lib/bol-ai";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BASE64_CHARS = 24_000_000;

export const extractBolDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; pages: BolAiPage[] }) => {
    if (!UUID.test(input.eventId)) throw new Error("Choose a valid event before AI extraction");
    if (!Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > 5) throw new Error("Prepare between one and five document pages");
    let total = 0;
    for (const page of input.pages) {
      if (page.mediaType !== "image/jpeg" || !page.data || !/^[a-zA-Z0-9+/=]+$/.test(page.data)) throw new Error("Invalid document page");
      total += page.data.length;
    }
    if (total > MAX_BASE64_CHARS) throw new Error("The prepared document is too large for AI extraction");
    return { eventId: input.eventId, pages: input.pages };
  })
  .handler(async ({ data, context }): Promise<BolExtractionResponse> => {
    const { data: event, error: eventError } = await context.supabase
      .from("events").select("id, organization_id").eq("id", data.eventId).maybeSingle();
    if (eventError || !event) return { ok: false, status: 404, message: "Event not found" };
    const { data: staff } = await context.supabase.rpc("is_org_staff", { _org: event.organization_id });
    if (!staff) return { ok: false, status: 403, message: "Only company staff can use AI BOL extraction" };

    const { data: boothRows, error: boothError } = await context.supabase
      .from("event_exhibitors")
      .select("exhibitor_id, booth_number, exhibitor:exhibitors(company_name)")
      .eq("event_id", event.id);
    if (boothError) return { ok: false, status: 500, message: boothError.message };
    const exhibitors = (boothRows ?? []).map((row) => ({
      id: row.exhibitor_id,
      company_name: (row.exhibitor as { company_name: string } | null)?.company_name ?? "",
      booth_number: row.booth_number,
    }));

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, status: 500, message: "AI document extraction is not configured yet" };
    const { extractBolWithAi } = await import("./ai/bol-extraction.server");
    return extractBolWithAi({ apiKey, pages: data.pages, exhibitors });
  });
