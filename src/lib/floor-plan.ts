import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TicketListItem } from "@/lib/queries";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

export const floorPlansQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["floor_plans", eventId],
    enabled: !!eventId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("floor_plans")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at"),
      ),
  });

export const boothMarkersQuery = (floorPlanId: string) =>
  queryOptions({
    queryKey: ["booth_markers", floorPlanId],
    enabled: !!floorPlanId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("booth_markers")
          .select(
            "*, exhibitor:exhibitors(id, company_name, contact_name, contact_phone, contact_email)",
          )
          .eq("floor_plan_id", floorPlanId)
          .order("booth_number"),
      ),
  });

export type BoothMarker = Awaited<
  ReturnType<NonNullable<ReturnType<typeof boothMarkersQuery>["queryFn"]>>
>[number];

export const floorPlanFileQuery = (path: string) =>
  queryOptions({
    queryKey: ["floor_plan_file", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("floor-plans").createSignedUrl(path, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });

/** Unresolved issue reports for an event, keyed to the exhibitor through the ticket. */
export const openIssuesQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["open_issues", eventId],
    enabled: !!eventId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("delivery_updates")
          .select("ticket_id, ticket:tickets!inner(exhibitor_id, event_id)")
          .eq("ticket.event_id", eventId)
          .not("issue_type", "is", null)
          .is("resolved_at", null),
      ),
  });

export type BoothStatus = "pending" | "assigned" | "in_progress" | "completed" | "on_hold" | "waiting" | "no_freight";

/**
 * One marker summarizes every job for that booth: an unresolved issue report
 * puts the booth on hold; otherwise the most active open ticket wins; a booth
 * whose tickets all finished shows completed; no tickets means no jobs.
 */
export function boothStatus(
  tickets: Pick<TicketListItem, "status">[],
  hasOpenIssue: boolean,
  hasFreight = true,
): BoothStatus {
  const open = tickets.filter((t) => t.status !== "cancelled");
  if (hasOpenIssue && open.length > 0) return "on_hold";
  if (open.length === 0) return hasFreight ? "waiting" : "no_freight";
  if (open.some((t) => t.status === "in_progress")) return "in_progress";
  if (open.some((t) => t.status === "assigned")) return "assigned";
  if (open.some((t) => t.status === "requested")) return "pending";
  return "completed";
}

export const BOOTH_STATUS_META: Record<BoothStatus, { label: string; dot: string }> = {
  pending: { label: "Pending", dot: "bg-status-requested" },
  assigned: { label: "Assigned", dot: "bg-status-assigned" },
  in_progress: { label: "In progress", dot: "bg-status-progress" },
  completed: { label: "Completed", dot: "bg-status-completed" },
  on_hold: { label: "On hold", dot: "bg-status-hold" },
  waiting: { label: "Waiting", dot: "bg-status-cancelled" },
  no_freight: { label: "No freight ordered", dot: "bg-status-nofreight" },
};

export const FLOOR_PLAN_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
