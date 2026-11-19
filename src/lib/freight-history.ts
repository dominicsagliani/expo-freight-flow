import type { ArrivalStatus, FreightType } from "@/lib/labels";

export type FreightFile = {
  bucket: "ticket-photos" | "freight-issue-photos" | "bol-documents";
  path: string;
  url?: string | null;
};

export type FreightPhoto = FreightFile & { id: string };

export type FreightHistoryEvent = {
  id: string;
  occurred_at: string;
  kind: "received" | "staging" | "dispatch" | "assignment" | "pickup" | "delivery" | "issue" | "resolution" | "correction" | "note" | "status";
  title: string;
  description: string | null;
  actor_name: string | null;
  location: string | null;
  ticket_id: string | null;
  ticket_number: string | null;
  photos: FreightPhoto[];
};

export type FreightHistory = {
  freight: {
    id: string;
    freight_code: string;
    description: string;
    freight_type: FreightType;
    pieces: number;
    weight_lbs: number;
    booth_number: string | null;
    arrival_status: ArrivalStatus;
    storage_location: string | null;
    event_name: string;
    exhibitor_name: string;
    bol: {
      carrier_name: string | null;
      pro_number: string | null;
      shipper_name: string | null;
      consignee_name: string | null;
      created_at: string;
      document: (FreightFile & { filename: string }) | null;
    } | null;
  };
  events: FreightHistoryEvent[];
};
