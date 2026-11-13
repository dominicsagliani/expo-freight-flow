import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
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
      let rows = unwrap(roles);
      // A user with no company yet may have pending invitations for their confirmed email.
      if (!rows.some((r) => r.organization_id)) {
        const { data: accepted } = await supabase.rpc("accept_my_invitations");
        if (accepted && accepted > 0) {
          rows = unwrap(
            await supabase
              .from("user_roles")
              .select("id, role, organization_id, exhibitor_id, operator_id, organization:organizations(id, name)")
              .eq("user_id", user.id),
          );
        }
      }
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
        isPlatformOwner: rows.some((r) => r.role === "super_admin"),
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "*, event_exhibitors(id, booth_number, exhibitor_id, exhibitor:exhibitors(id, company_name, contact_name, contact_email, contact_phone))",
        )
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
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
  "*, exhibitor:exhibitors(id, company_name), event:events(id, name), operator:operators!tickets_assigned_operator_id_fkey(id, full_name), equipment:equipment!tickets_assigned_equipment_id_fkey(id, unit_number), ticket_freight(freight_id), work_sessions(billable_hours, billable_amount, hourly_rate)";

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "*, exhibitor:exhibitors(id, company_name, contact_name, contact_phone, contact_email), event:events(id, name, venue), operator:operators!tickets_assigned_operator_id_fkey(id, full_name, phone), equipment:equipment!tickets_assigned_equipment_id_fkey(id, unit_number, description), ticket_freight(scanned_at, freight:freight_items(id, freight_code, description, freight_type, pieces, weight_lbs, length_in, width_in, height_in, arrival_status, storage_location))",
        )
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
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
    queryFn: async () => unwrap(await supabase.from("equipment").select("*").is("retired_at", null).order("unit_number")),
  });

export const ticketPhotosQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ["ticket_photos", ticketId],
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from("ticket_photos").select("*").eq("ticket_id", ticketId).order("created_at"),
      );
      if (rows.length === 0) return [];
      const { data } = await supabase.storage.from("ticket-photos").createSignedUrls(rows.map((r) => r.storage_path), 3600);
      return rows.map((r, i) => ({ ...r, url: data?.[i]?.signedUrl ?? null }));
    },
  });

export const rateCardsQuery = () =>
  queryOptions({
    queryKey: ["rate_cards"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("rate_cards")
          .select("*, event:events(id, name), service_rates(*)")
          .order("is_default", { ascending: false }),
      ),
  });

export const exhibitorCountQuery = () =>
  queryOptions({
    queryKey: ["exhibitors", "count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("exhibitors").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

// The company's ExpoHaul subscription rows (test and live rows coexist, so
// every read keeps the environment column and filters it in the UI).
export const subscriptionsQuery = () =>
  queryOptions({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Not signed in");
      const { data: roles } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .not("organization_id", "is", null)
        .limit(1);
      const orgId = roles?.[0]?.organization_id ?? null;
      const orFilter = orgId
        ? `user_id.eq.${user.id},organization_id.eq.${orgId}`
        : `user_id.eq.${user.id}`;
      return unwrap(
        await supabase
          .from("subscriptions")
          .select("*")
          .or(orFilter)
          .order("created_at", { ascending: false }),
      );
    },
    staleTime: 30_000,
  });

// What the caller's company may do right now (plan, yearly event limit).
export const entitlementQuery = (orgId: string | null) =>
  queryOptions({
    queryKey: ["entitlement", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc("org_entitlement", { _org: orgId });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  });

export const eventsThisYearQuery = () =>
  queryOptions({
    queryKey: ["events", "this-year"],
    queryFn: async () => {
      const y = new Date().getFullYear();
      const { count, error } = await supabase
        .from("events").select("id", { count: "exact", head: true })
        .gte("start_date", `${y}-01-01`).lte("start_date", `${y}-12-31`);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

export const salesRequestsQuery = () =>
  queryOptions({
    queryKey: ["sales-requests"],
    queryFn: async () => {
      const [reqs, grants] = await Promise.all([
        supabase.from("sales_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("pilot_grants").select("*").order("created_at", { ascending: false }),
      ]);
      return { requests: unwrap(reqs), grants: unwrap(grants) };
    },
  });

export const deliveryUpdatesQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ["delivery_updates", ticketId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("delivery_updates")
          .select("id, kind, note, location, created_at, created_by, freight:freight_items(id, freight_code)")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false }),
      ),
  });

export const jobAssignmentsQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ["job_assignments", ticketId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("job_assignments")
          .select("id, assigned_at, released_at, release_reason, operator:operators(id, full_name), equipment:equipment(id, unit_number)")
          .eq("ticket_id", ticketId)
          .order("assigned_at", { ascending: false }),
      ),
  });

export const invitationsQuery = (orgId: string | null) =>
  queryOptions({
    queryKey: ["invitations", orgId],
    enabled: !!orgId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("invitations")
          .select("id, email, role, status, created_at, expires_at, exhibitor:exhibitors(company_name), operator:operators(full_name)")
          .eq("organization_id", orgId!)
          .order("created_at", { ascending: false }),
      ),
  });
