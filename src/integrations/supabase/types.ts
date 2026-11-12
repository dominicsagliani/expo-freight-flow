export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json
          event_id: string | null
          freight_id: string | null
          id: string
          organization_id: string
          ticket_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json
          event_id?: string | null
          freight_id?: string | null
          id?: string
          organization_id: string
          ticket_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json
          event_id?: string | null
          freight_id?: string | null
          id?: string
          organization_id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freight_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          capacity_lbs: number | null
          created_at: string
          description: string | null
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["equipment_status"]
          unit_number: string
        }
        Insert: {
          capacity_lbs?: number | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["equipment_status"]
          unit_number: string
        }
        Update: {
          capacity_lbs?: number | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["equipment_status"]
          unit_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_exhibitors: {
        Row: {
          booth_number: string
          created_at: string
          event_id: string
          exhibitor_id: string
          id: string
          organization_id: string
        }
        Insert: {
          booth_number: string
          created_at?: string
          event_id: string
          exhibitor_id: string
          id?: string
          organization_id: string
        }
        Update: {
          booth_number?: string
          created_at?: string
          event_id?: string
          exhibitor_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_exhibitors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_exhibitors_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_exhibitors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          move_in_date: string | null
          move_out_date: string | null
          name: string
          notes: string | null
          organization_id: string
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          move_in_date?: string | null
          move_out_date?: string | null
          name: string
          notes?: string | null
          organization_id: string
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          move_in_date?: string | null
          move_out_date?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibitors: {
        Row: {
          billing_address: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_items: {
        Row: {
          arrival_status: Database["public"]["Enums"]["arrival_status"]
          arrived_at: string | null
          booth_number: string | null
          created_at: string
          created_by: string | null
          description: string
          event_id: string
          exhibitor_id: string
          freight_code: string
          freight_type: Database["public"]["Enums"]["freight_type"]
          height_in: number | null
          id: string
          length_in: number | null
          organization_id: string
          pieces: number
          qr_token: string
          storage_location: string | null
          updated_at: string
          weight_lbs: number
          width_in: number | null
        }
        Insert: {
          arrival_status?: Database["public"]["Enums"]["arrival_status"]
          arrived_at?: string | null
          booth_number?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          event_id: string
          exhibitor_id: string
          freight_code: string
          freight_type?: Database["public"]["Enums"]["freight_type"]
          height_in?: number | null
          id?: string
          length_in?: number | null
          organization_id: string
          pieces?: number
          qr_token?: string
          storage_location?: string | null
          updated_at?: string
          weight_lbs?: number
          width_in?: number | null
        }
        Update: {
          arrival_status?: Database["public"]["Enums"]["arrival_status"]
          arrived_at?: string | null
          booth_number?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          event_id?: string
          exhibitor_id?: string
          freight_code?: string
          freight_type?: Database["public"]["Enums"]["freight_type"]
          height_in?: number | null
          id?: string
          length_in?: number | null
          organization_id?: string
          pieces?: number
          qr_token?: string
          storage_location?: string | null
          updated_at?: string
          weight_lbs?: number
          width_in?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_items_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          certification_expires: string | null
          certification_number: string | null
          created_at: string
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          status: Database["public"]["Enums"]["operator_status"]
          user_id: string | null
        }
        Insert: {
          certification_expires?: string | null
          certification_number?: string | null
          created_at?: string
          full_name: string
          id?: string
          organization_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["operator_status"]
          user_id?: string | null
        }
        Update: {
          certification_expires?: string | null
          certification_number?: string | null
          created_at?: string
          full_name?: string
          id?: string
          organization_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["operator_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_cards: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_cards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_requests: {
        Row: {
          company_name: string
          contact_email: string
          created_at: string | null
          id: string
          kind: string
          message: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          company_name?: string
          contact_email?: string
          created_at?: string | null
          id?: string
          kind: string
          message?: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          company_name?: string
          contact_email?: string
          created_at?: string | null
          id?: string
          kind?: string
          message?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      service_rates: {
        Row: {
          created_at: string
          id: string
          minimum_charge: number
          organization_id: string
          rate: number
          rate_card_id: string
          service_type: Database["public"]["Enums"]["service_type"]
          unit: Database["public"]["Enums"]["rate_unit"]
        }
        Insert: {
          created_at?: string
          id?: string
          minimum_charge?: number
          organization_id: string
          rate: number
          rate_card_id: string
          service_type: Database["public"]["Enums"]["service_type"]
          unit: Database["public"]["Enums"]["rate_unit"]
        }
        Update: {
          created_at?: string
          id?: string
          minimum_charge?: number
          organization_id?: string
          rate?: number
          rate_card_id?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          unit?: Database["public"]["Enums"]["rate_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "service_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_rates_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          organization_id: string | null
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          organization_id?: string | null
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          organization_id?: string | null
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ticket_freight: {
        Row: {
          created_at: string
          freight_id: string
          organization_id: string
          scanned_at: string | null
          scanned_by: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          freight_id: string
          organization_id: string
          scanned_at?: string | null
          scanned_by?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          freight_id?: string
          organization_id?: string
          scanned_at?: string | null
          scanned_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_freight_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freight_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_freight_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_freight_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_photos: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_photos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_at: string | null
          assigned_equipment_id: string | null
          assigned_operator_id: string | null
          booth_number: string | null
          charge_amount: number | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          destination: string | null
          event_id: string
          exhibitor_id: string
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          requested_at: string
          requested_by: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          special_instructions: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_equipment_id?: string | null
          assigned_operator_id?: string | null
          booth_number?: string | null
          charge_amount?: number | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          destination?: string | null
          event_id: string
          exhibitor_id: string
          id?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requested_at?: string
          requested_by?: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          special_instructions?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_equipment_id?: string | null
          assigned_operator_id?: string | null
          booth_number?: string | null
          charge_amount?: number | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          destination?: string | null
          event_id?: string
          exhibitor_id?: string
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requested_at?: string
          requested_by?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          special_instructions?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_equipment_id_fkey"
            columns: ["assigned_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          exhibitor_id: string | null
          id: string
          operator_id: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          exhibitor_id?: string | null
          id?: string
          operator_id?: string | null
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          exhibitor_id?: string | null
          id?: string
          operator_id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_ticket: { Args: { _ticket: string }; Returns: boolean }
      can_work_ticket: { Args: { _ticket: string }; Returns: boolean }
      compute_ticket_charge: { Args: { _ticket: string }; Returns: number }
      exhibitor_event_ids: { Args: never; Returns: string[] }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_org_role: {
        Args: { _org: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      is_org_staff: { Args: { _org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          _action: string
          _at?: string
          _details: Json
          _event: string
          _freight: string
          _org: string
          _ticket: string
        }
        Returns: undefined
      }
      operator_complete_job: {
        Args: { _notes?: string; _ticket: string }
        Returns: undefined
      }
      operator_exhibitor_ids: { Args: never; Returns: string[] }
      operator_freight_ids: { Args: never; Returns: string[] }
      operator_start_job: { Args: { _ticket: string }; Returns: undefined }
      operator_ticket_ids: { Args: never; Returns: string[] }
      org_has_active_subscription: {
        Args: { _org: string; check_env?: string }
        Returns: boolean
      }
      user_exhibitor_ids: { Args: never; Returns: string[] }
      user_operator_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "company_admin"
        | "dispatcher"
        | "operator"
        | "exhibitor"
      arrival_status:
        | "expected"
        | "received"
        | "in_storage"
        | "delivered_to_booth"
        | "outbound"
        | "shipped"
      equipment_status: "available" | "in_use" | "maintenance"
      event_status: "planning" | "move_in" | "live" | "move_out" | "closed"
      freight_type: "crate" | "pallet" | "skid" | "carton" | "loose" | "other"
      operator_status: "available" | "on_job" | "off_shift"
      rate_unit: "per_cwt" | "per_piece" | "per_hour" | "flat"
      service_type:
        | "inbound_delivery"
        | "outbound_pickup"
        | "empty_crate_return"
        | "storage_move"
        | "equipment_lift"
        | "rigging_assist"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "requested"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "company_admin",
        "dispatcher",
        "operator",
        "exhibitor",
      ],
      arrival_status: [
        "expected",
        "received",
        "in_storage",
        "delivered_to_booth",
        "outbound",
        "shipped",
      ],
      equipment_status: ["available", "in_use", "maintenance"],
      event_status: ["planning", "move_in", "live", "move_out", "closed"],
      freight_type: ["crate", "pallet", "skid", "carton", "loose", "other"],
      operator_status: ["available", "on_job", "off_shift"],
      rate_unit: ["per_cwt", "per_piece", "per_hour", "flat"],
      service_type: [
        "inbound_delivery",
        "outbound_pickup",
        "empty_crate_return",
        "storage_move",
        "equipment_lift",
        "rigging_assist",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "requested",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
