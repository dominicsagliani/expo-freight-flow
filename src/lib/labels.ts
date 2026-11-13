import type { Database } from "@/integrations/supabase/types";

export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
export type ServiceType = Database["public"]["Enums"]["service_type"];
export type ArrivalStatus = Database["public"]["Enums"]["arrival_status"];
export type EventStatus = Database["public"]["Enums"]["event_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type FreightType = Database["public"]["Enums"]["freight_type"];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  requested: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  inbound_delivery: "Inbound delivery to booth",
  outbound_pickup: "Outbound pickup from booth",
  empty_crate_return: "Empty crate return",
  storage_move: "Storage move",
  equipment_lift: "Equipment lift",
  rigging_assist: "Rigging assist",
};

export const ARRIVAL_LABEL: Record<ArrivalStatus, string> = {
  expected: "Expected",
  received: "Received at dock",
  in_storage: "In storage",
  delivered_to_booth: "Delivered to booth",
  outbound: "Outbound staged",
  shipped: "Shipped",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  planning: "Planning",
  move_in: "Move-in",
  live: "Show open",
  move_out: "Move-out",
  closed: "Closed",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super admin",
  company_admin: "Company admin",
  dispatcher: "Dispatcher",
  operator: "Forklift operator",
  exhibitor: "Exhibitor",
};

export const FREIGHT_TYPE_LABEL: Record<FreightType, string> = {
  crate: "Crate",
  pallet: "Pallet",
  skid: "Skid",
  carton: "Carton",
  loose: "Loose",
  other: "Other",
};

export type ActivityDetails = {
  from?: string | null;
  to?: string | null;
  operator?: string | null;
  equipment?: string | null;
  freight_code?: string | null;
  service_type?: string | null;
  ticket_number?: string | null;
};

export const OPEN_STATUSES: TicketStatus[] = ["requested", "assigned", "in_progress"];

export const ACTIVITY_LABEL: Record<string, string> = {
  ticket_created: "Ticket created",
  status_changed: "Status changed",
  assigned: "Assignment updated",
  freight_attached: "Freight attached",
  freight_scanned: "Freight scanned",
  freight_registered: "Freight registered",
  freight_status_changed: "Freight updated",
  delivery_update: "Delivery update",
  labor_hours_set: "Labor hours entered",
  charge_adjusted: "Charge adjusted",
  charge_reset: "Charge reset to calculated",
};

export const DELIVERY_UPDATE_LABEL = {
  picked_up: "Picked up",
  in_transit: "In transit",
  at_booth: "At booth",
  delivered: "Delivered",
  exception: "Problem reported",
  note: "Note",
} as const;
export type DeliveryUpdateKind = keyof typeof DELIVERY_UPDATE_LABEL;
