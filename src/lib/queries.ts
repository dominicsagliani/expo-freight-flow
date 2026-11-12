import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const membershipQuery = () =>
  queryOptions({
    queryKey: ["membership"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Not signed in");
      const [roles, profile] = await Promise.all([
        supabase
          .from("user_roles")
          .select("id, role, organization_id, exhibitor_id, operator_id, organization:organizations(id, name)")
          .eq("user_id", user.id),
        supabase.from("profiles").select("id, full_name, email").eq("id", user.id).maybeSingle(),
      ]);
      const rows = unwrap(roles);
      const primary = rows.find((r) => r.organization_id) ?? rows[0] ?? null;
      return {
        userId: user.id,
        email: user.email ?? "",
        fullName: profile.data?.full_name ?? user.email ?? "",
        roles: rows,
        organizationId: primary?.organization_id ?? null,
        organizationName: primary?.organization?.name ?? "No organization",
        role: primary?.role ?? null,
        exhibitorId: primary?.exhibitor_id ?? null,
        operatorId: primary?.operator_id ?? null,
      };
    },
    staleTime: 60_000,
  });

export type Membership = Awaited<ReturnType<NonNullable<ReturnType<typeof membershipQuery>["queryFn"]>>>;

export function isStaff(m: Pick<Membership, "role">) {
  return m.role === "company_admin" || m.role === "dispatcher" || m.role === "super_admin";
}
export function isAdmin(m: Pick<Membership, "role">) {
  return m.role === "company_admin" || m.role === "super_admin";
}

export const eventsQuery = () =>
  queryOptions({
    queryKey: ["events"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("events")
          .select("*, event_exhibitors(id)")
          .order("start_date", { ascending: true }),
      ),
  });

export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["events", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("events")
          .select(
            "*, event_exhibitors(id, booth_number, exhibitor_id, exhibitor:exhibitors(id, company_name, contact_name, contact_email, contact_phone))",
          )
          .eq("id", id)
          .single(),
      ),
  });

export const exhibitorsQuery = () =>
  queryOptions({
    queryKey: ["exhibitors"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("exhibitors")
          .select("*, event_exhibitors(id, booth_number, event_id, event:events(id, name))")
          .order("company_name"),
      ),
  });

export const eventExhibitorsQuery = () =>
  queryOptions({
    queryKey: ["event_exhibitors"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("event_exhibitors")
          .select("id, event_id, exhibitor_id, booth_number, exhibitor:exhibitors(id, company_name)"),
      ),
  });

const TICKET_LIST_SELECT =
  "*, exhibitor:exhibitors(id, company_name), event:events(id, name), operator:operators(id, full_name), equipment:equipment(id, unit_number), ticket_freight(freight_id)";

export const ticketsQuery = () =>
  queryOptions({
    queryKey: ["tickets"],
    queryFn: async () =>
      unwrap(
        await supabase.from("tickets").select(TICKET_LIST_SELECT).order("requested_at", { ascending: false }),
      ),
  });

export type TicketListItem = Awaited<ReturnType<NonNullable<ReturnType<typeof ticketsQuery>["queryFn"]>>>[number];

export const ticketQuery = (id: string) =>
  queryOptions({
    queryKey: ["tickets", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("tickets")
          .select(
            "*, exhibitor:exhibitors(id, company_name, contact_name, contact_phone, contact_email), event:events(id, name, venue), operator:operators(id, full_name, phone), equipment:equipment(id, unit_number, description), ticket_freight(scanned_at, freight:freight_items(id, freight_code, description, freight_type, pieces, weight_lbs, length_in, width_in, height_in, arrival_status, storage_location))",
          )
          .eq("id", id)
          .single(),
      ),
  });

export const ticketActivityQuery = (id: string) =>
  queryOptions({
    queryKey: ["activity", "ticket", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("activity_log")
          .select("*")
          .eq("ticket_id", id)
          .order("created_at", { ascending: false }),
      ),
  });

export const recentActivityQuery = () =>
  queryOptions({
    queryKey: ["activity", "recent"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("activity_log")
          .select("*, ticket:tickets(id, ticket_number)")
          .order("created_at", { ascending: false })
          .limit(14),
      ),
  });

export const freightQuery = () =>
  queryOptions({
    queryKey: ["freight"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("freight_items")
          .select("*, exhibitor:exhibitors(id, company_name), event:events(id, name)")
          .order("created_at", { ascending: false }),
      ),
  });

export const operatorsQuery = () =>
  queryOptions({
    queryKey: ["operators"],
    queryFn: async () => unwrap(await supabase.from("operators").select("*").order("full_name")),
  });

export const equipmentQuery = () =>
  queryOptions({
    queryKey: ["equipment"],
    queryFn: async () => unwrap(await supabase.from("equipment").select("*").order("unit_number")),
  });
