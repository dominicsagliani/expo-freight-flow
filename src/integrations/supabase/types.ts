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
      bills_of_lading: {
        Row: {
          booth_number: string | null
          carrier_name: string | null
          consignee_name: string | null
          created_at: string
          declared_pieces: number
          description: string | null
          event_id: string
          exhibitor_id: string
          file_size_bytes: number
          id: string
          intake_key: string
          mime_type: string
          organization_id: string
          original_filename: string
          pro_number: string | null
          received_by: string | null
          shipper_name: string | null
          special_instructions: string | null
          storage_path: string
          total_weight_lbs: number | null
        }
        Insert: {
          booth_number?: string | null
          carrier_name?: string | null
          consignee_name?: string | null
          created_at?: string
          declared_pieces: number
          description?: string | null
          event_id: string
          exhibitor_id: string
          file_size_bytes: number
          id?: string
          intake_key?: string
          mime_type: string
          organization_id: string
          original_filename: string
          pro_number?: string | null
          received_by?: string | null
          shipper_name?: string | null
          special_instructions?: string | null
          storage_path: string
          total_weight_lbs?: number | null
        }
        Update: {
          booth_number?: string | null
          carrier_name?: string | null
          consignee_name?: string | null
          created_at?: string
          declared_pieces?: number
          description?: string | null
          event_id?: string
          exhibitor_id?: string
          file_size_bytes?: number
          id?: string
          intake_key?: string
          mime_type?: string
          organization_id?: string
          original_filename?: string
          pro_number?: string | null
          received_by?: string | null
          shipper_name?: string | null
          special_instructions?: string | null
          storage_path?: string
          total_weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_of_lading_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_of_lading_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_of_lading_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          bonus_id: string | null
          created_at: string
          details: Json
          id: string
          operator_id: string | null
          organization_id: string
          program_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          bonus_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          operator_id?: string | null
          organization_id: string
          program_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          bonus_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          operator_id?: string | null
          organization_id?: string
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_audit_log_bonus_id_fkey"
            columns: ["bonus_id"]
            isOneToOne: false
            referencedRelation: "operator_bonuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_audit_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_audit_log_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "incentive_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      booth_markers: {
        Row: {
          booth_number: string
          created_at: string
          exhibitor_id: string | null
          floor_plan_id: string
          hall: string | null
          id: string
          organization_id: string
          updated_at: string
          x_pct: number
          y_pct: number
        }
        Insert: {
          booth_number: string
          created_at?: string
          exhibitor_id?: string | null
          floor_plan_id: string
          hall?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          x_pct: number
          y_pct: number
        }
        Update: {
          booth_number?: string
          created_at?: string
          exhibitor_id?: string | null
          floor_plan_id?: string
          hall?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          x_pct?: number
          y_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "booth_markers_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booth_markers_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booth_markers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_updates: {
        Row: {
          created_at: string
          created_by: string | null
          freight_id: string | null
          id: string
          issue_type: string | null
          kind: Database["public"]["Enums"]["delivery_update_kind"]
          location: string | null
          note: string | null
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          freight_id?: string | null
          id?: string
          issue_type?: string | null
          kind?: Database["public"]["Enums"]["delivery_update_kind"]
          location?: string | null
          note?: string | null
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          freight_id?: string | null
          id?: string
          issue_type?: string | null
          kind?: Database["public"]["Enums"]["delivery_update_kind"]
          location?: string | null
          note?: string | null
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_updates_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freight_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_updates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_updates_ticket_id_fkey"
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
          equipment_class: string
          fuel_type: string
          id: string
          model: string | null
          organization_id: string
          photo_path: string | null
          retired_at: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          unit_number: string
        }
        Insert: {
          capacity_lbs?: number | null
          created_at?: string
          description?: string | null
          equipment_class?: string
          fuel_type?: string
          id?: string
          model?: string | null
          organization_id: string
          photo_path?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          unit_number: string
        }
        Update: {
          capacity_lbs?: number | null
          created_at?: string
          description?: string | null
          equipment_class?: string
          fuel_type?: string
          id?: string
          model?: string | null
          organization_id?: string
          photo_path?: string | null
          retired_at?: string | null
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
      event_operators: {
        Row: {
          added_by: string | null
          created_at: string
          event_id: string
          operator_id: string
          organization_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          event_id: string
          operator_id: string
          organization_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          event_id?: string
          operator_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_operators_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_operators_organization_id_fkey"
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
          first_name: string | null
          id: string
          last_name: string | null
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
          first_name?: string | null
          id?: string
          last_name?: string | null
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
          first_name?: string | null
          id?: string
          last_name?: string | null
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
      floor_plans: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          mime_type: string
          name: string
          organization_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          mime_type: string
          name: string
          organization_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          mime_type?: string
          name?: string
          organization_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_issues: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          freight_id: string
          id: string
          kind: string
          note: string | null
          organization_id: string
          photo_path: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          freight_id: string
          id?: string
          kind: string
          note?: string | null
          organization_id: string
          photo_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          freight_id?: string
          id?: string
          kind?: string
          note?: string | null
          organization_id?: string
          photo_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_issues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_issues_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freight_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_issues_organization_id_fkey"
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
          bol_crate_number: number | null
          bol_id: string | null
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
          bol_crate_number?: number | null
          bol_id?: string | null
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
          bol_crate_number?: number | null
          bol_id?: string | null
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
            foreignKeyName: "freight_items_bol_id_fkey"
            columns: ["bol_id"]
            isOneToOne: false
            referencedRelation: "bills_of_lading"
            referencedColumns: ["id"]
          },
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
      freight_staging: {
        Row: {
          area: string
          event_id: string | null
          freight_id: string
          id: string
          landmark: string | null
          location_note: string | null
          organization_id: string
          photo_path: string | null
          staged_at: string
          staged_by: string | null
          staged_by_name: string | null
        }
        Insert: {
          area: string
          event_id?: string | null
          freight_id: string
          id?: string
          landmark?: string | null
          location_note?: string | null
          organization_id: string
          photo_path?: string | null
          staged_at?: string
          staged_by?: string | null
          staged_by_name?: string | null
        }
        Update: {
          area?: string
          event_id?: string | null
          freight_id?: string
          id?: string
          landmark?: string | null
          location_note?: string | null
          organization_id?: string
          photo_path?: string | null
          staged_at?: string
          staged_by?: string | null
          staged_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_staging_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_staging_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freight_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_staging_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_programs: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          created_by: string | null
          ends_on: string | null
          event_id: string | null
          id: string
          min_crates: number
          min_jobs: number
          min_scan_compliance: number
          min_score: number
          min_shifts: number
          name: string
          organization_id: string
          period: string
          requires_approval: boolean
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          event_id?: string | null
          id?: string
          min_crates?: number
          min_jobs?: number
          min_scan_compliance?: number
          min_score?: number
          min_shifts?: number
          name: string
          organization_id: string
          period: string
          requires_approval?: boolean
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          event_id?: string | null
          id?: string
          min_crates?: number
          min_jobs?: number
          min_scan_compliance?: number
          min_score?: number
          min_shifts?: number
          name?: string
          organization_id?: string
          period?: string
          requires_approval?: boolean
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_programs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_settings: {
        Row: {
          daily_goal_crates: number
          on_time_minutes: number
          organization_id: string
          target_units_per_hour: number
          time_zone: string
          updated_at: string
          updated_by: string | null
          w_accuracy: number
          w_documentation: number
          w_on_time: number
          w_productivity: number
          w_reliability: number
        }
        Insert: {
          daily_goal_crates?: number
          on_time_minutes?: number
          organization_id: string
          target_units_per_hour?: number
          time_zone?: string
          updated_at?: string
          updated_by?: string | null
          w_accuracy?: number
          w_documentation?: number
          w_on_time?: number
          w_productivity?: number
          w_reliability?: number
        }
        Update: {
          daily_goal_crates?: number
          on_time_minutes?: number
          organization_id?: string
          target_units_per_hour?: number
          time_zone?: string
          updated_at?: string
          updated_by?: string | null
          w_accuracy?: number
          w_documentation?: number
          w_on_time?: number
          w_productivity?: number
          w_reliability?: number
        }
        Relationships: [
          {
            foreignKeyName: "incentive_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          event_id: string | null
          exhibitor_id: string | null
          expires_at: string
          id: string
          invited_by: string | null
          operator_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          event_id?: string | null
          exhibitor_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          operator_id?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          event_id?: string | null
          exhibitor_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          operator_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          equipment_id: string | null
          id: string
          operator_id: string | null
          organization_id: string
          release_reason: string | null
          released_at: string | null
          ticket_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          equipment_id?: string | null
          id?: string
          operator_id?: string | null
          organization_id: string
          release_reason?: string | null
          released_at?: string | null
          ticket_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          equipment_id?: string | null
          id?: string
          operator_id?: string | null
          organization_id?: string
          release_reason?: string | null
          released_at?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_bonuses: {
        Row: {
          amount: number
          calculated_at: string
          created_at: string
          event_id: string | null
          id: string
          ineligible_reasons: string[]
          metrics: Json
          operator_id: string
          organization_id: string
          paid_at: string | null
          paid_marked_by: string | null
          payment_reference: string | null
          period: string
          period_end: string
          period_start: string
          program_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          source_ticket_ids: string[]
          status: string
        }
        Insert: {
          amount?: number
          calculated_at?: string
          created_at?: string
          event_id?: string | null
          id?: string
          ineligible_reasons?: string[]
          metrics?: Json
          operator_id: string
          organization_id: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_reference?: string | null
          period: string
          period_end: string
          period_start: string
          program_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          source_ticket_ids?: string[]
          status?: string
        }
        Update: {
          amount?: number
          calculated_at?: string
          created_at?: string
          event_id?: string | null
          id?: string
          ineligible_reasons?: string[]
          metrics?: Json
          operator_id?: string
          organization_id?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_reference?: string | null
          period?: string
          period_end?: string
          period_start?: string
          program_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          source_ticket_ids?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_bonuses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_bonuses_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_bonuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_bonuses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "incentive_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          operator_id: string
          pin_hash: string
          set_at: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          operator_id: string
          pin_hash: string
          set_at?: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          operator_id?: string
          pin_hash?: string
          set_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_pins_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_unlocks: {
        Row: {
          event_id: string | null
          expires_at: string
          operator_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          event_id?: string | null
          expires_at: string
          operator_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          event_id?: string | null
          expires_at?: string
          operator_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_unlocks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_unlocks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          certification_expires: string | null
          certification_number: string | null
          created_at: string
          equipment_id: string | null
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          organization_id: string
          phone: string | null
          retired_at: string | null
          status: Database["public"]["Enums"]["operator_status"]
          user_id: string | null
        }
        Insert: {
          certification_expires?: string | null
          certification_number?: string | null
          created_at?: string
          equipment_id?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          organization_id: string
          phone?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["operator_status"]
          user_id?: string | null
        }
        Update: {
          certification_expires?: string | null
          certification_number?: string | null
          created_at?: string
          equipment_id?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          organization_id?: string
          phone?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["operator_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operators_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
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
          payment_instructions: string | null
          payment_link_url: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          payment_instructions?: string | null
          payment_link_url?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          payment_instructions?: string | null
          payment_link_url?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      pilot_grants: {
        Row: {
          created_at: string
          ends_at: string
          granted_by: string | null
          id: string
          max_events: number
          organization_id: string
          sales_request_id: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string
          granted_by?: string | null
          id?: string
          max_events?: number
          organization_id: string
          sales_request_id?: string | null
          starts_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          granted_by?: string | null
          id?: string
          max_events?: number
          organization_id?: string
          sales_request_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_grants_sales_request_id_fkey"
            columns: ["sales_request_id"]
            isOneToOne: false
            referencedRelation: "sales_requests"
            referencedColumns: ["id"]
          },
        ]
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
      queue_drivers: {
        Row: {
          equipment_id: string
          event_id: string
          heartbeat_at: string
          operator_id: string
          organization_id: string
          ready: boolean
          ready_since: string
          user_id: string
        }
        Insert: {
          equipment_id: string
          event_id: string
          heartbeat_at?: string
          operator_id: string
          organization_id: string
          ready?: boolean
          ready_since?: string
          user_id: string
        }
        Update: {
          equipment_id?: string
          event_id?: string
          heartbeat_at?: string
          operator_id?: string
          organization_id?: string
          ready?: boolean
          ready_since?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_drivers_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: true
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_drivers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_drivers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: true
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_drivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          status: string
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
          status?: string
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
          status?: string
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
          pending_change_at: string | null
          pending_price_id: string | null
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
          pending_change_at?: string | null
          pending_price_id?: string | null
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
          pending_change_at?: string | null
          pending_price_id?: string | null
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
      ticket_crew: {
        Row: {
          added_by: string | null
          created_at: string
          equipment_id: string | null
          operator_id: string
          organization_id: string
          ticket_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          equipment_id?: string | null
          operator_id: string
          organization_id: string
          ticket_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          equipment_id?: string | null
          operator_id?: string
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_crew_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_crew_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_crew_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_crew_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_freight: {
        Row: {
          booth_verified: boolean | null
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          delivered_session_id: string | null
          flag: string | null
          freight_id: string
          organization_id: string
          picked_up_at: string | null
          picked_up_by: string | null
          picked_up_session_id: string | null
          scanned_at: string | null
          scanned_by: string | null
          ticket_id: string
        }
        Insert: {
          booth_verified?: boolean | null
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivered_session_id?: string | null
          flag?: string | null
          freight_id: string
          organization_id: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          picked_up_session_id?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          ticket_id: string
        }
        Update: {
          booth_verified?: boolean | null
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivered_session_id?: string | null
          flag?: string | null
          freight_id?: string
          organization_id?: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          picked_up_session_id?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_freight_delivered_session_id_fkey"
            columns: ["delivered_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "ticket_freight_picked_up_session_id_fkey"
            columns: ["picked_up_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
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
          delivery_update_id: string | null
          freight_id: string | null
          id: string
          organization_id: string
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          delivery_update_id?: string | null
          freight_id?: string | null
          id?: string
          organization_id: string
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          delivery_update_id?: string | null
          freight_id?: string | null
          id?: string
          organization_id?: string
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_photos_delivery_update_id_fkey"
            columns: ["delivery_update_id"]
            isOneToOne: false
            referencedRelation: "delivery_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_photos_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freight_items"
            referencedColumns: ["id"]
          },
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
          calculated_charge: number | null
          charge_adjusted_at: string | null
          charge_adjusted_by: string | null
          charge_adjustment_reason: string | null
          charge_amount: number | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          destination: string | null
          estimated_weight_lbs: number | null
          event_id: string
          exhibitor_id: string
          held_at: string | null
          held_by: string | null
          hold_reason: string | null
          id: string
          intake_key: string | null
          invoice_sent_at: string | null
          labor_hours: number | null
          organization_id: string
          paid_at: string | null
          paid_marked_by: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          request_source: string
          requested_at: string
          requested_by: string | null
          required_equipment_class: string
          service_only: boolean
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
          calculated_charge?: number | null
          charge_adjusted_at?: string | null
          charge_adjusted_by?: string | null
          charge_adjustment_reason?: string | null
          charge_amount?: number | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          destination?: string | null
          estimated_weight_lbs?: number | null
          event_id: string
          exhibitor_id: string
          held_at?: string | null
          held_by?: string | null
          hold_reason?: string | null
          id?: string
          intake_key?: string | null
          invoice_sent_at?: string | null
          labor_hours?: number | null
          organization_id: string
          paid_at?: string | null
          paid_marked_by?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          request_source?: string
          requested_at?: string
          requested_by?: string | null
          required_equipment_class?: string
          service_only?: boolean
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
          calculated_charge?: number | null
          charge_adjusted_at?: string | null
          charge_adjusted_by?: string | null
          charge_adjustment_reason?: string | null
          charge_amount?: number | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          destination?: string | null
          estimated_weight_lbs?: number | null
          event_id?: string
          exhibitor_id?: string
          held_at?: string | null
          held_by?: string | null
          hold_reason?: string | null
          id?: string
          intake_key?: string | null
          invoice_sent_at?: string | null
          labor_hours?: number | null
          organization_id?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          request_source?: string
          requested_at?: string
          requested_by?: string | null
          required_equipment_class?: string
          service_only?: boolean
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
          event_id: string | null
          exhibitor_id: string | null
          id: string
          operator_id: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          exhibitor_id?: string | null
          id?: string
          operator_id?: string | null
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          exhibitor_id?: string | null
          id?: string
          operator_id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
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
      work_session_pauses: {
        Row: {
          created_by: string | null
          id: string
          organization_id: string
          paused_at: string
          reason: string
          resumed_at: string | null
          session_id: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          organization_id: string
          paused_at?: string
          reason: string
          resumed_at?: string | null
          session_id: string
        }
        Update: {
          created_by?: string | null
          id?: string
          organization_id?: string
          paused_at?: string
          reason?: string
          resumed_at?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_session_pauses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_session_pauses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          adjusted_by: string | null
          adjustment_reason: string | null
          billable_amount: number | null
          billable_hours: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          ended_at: string | null
          equipment_id: string
          hourly_rate: number | null
          id: string
          operator_id: string
          organization_id: string
          paused_at: string | null
          paused_seconds: number
          started_at: string
          status: Database["public"]["Enums"]["work_session_status"]
          ticket_id: string
        }
        Insert: {
          adjusted_by?: string | null
          adjustment_reason?: string | null
          billable_amount?: number | null
          billable_hours?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          ended_at?: string | null
          equipment_id: string
          hourly_rate?: number | null
          id?: string
          operator_id: string
          organization_id: string
          paused_at?: string | null
          paused_seconds?: number
          started_at?: string
          status?: Database["public"]["Enums"]["work_session_status"]
          ticket_id: string
        }
        Update: {
          adjusted_by?: string | null
          adjustment_reason?: string | null
          billable_amount?: number | null
          billable_hours?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          ended_at?: string | null
          equipment_id?: string
          hourly_rate?: number | null
          id?: string
          operator_id?: string
          organization_id?: string
          paused_at?: string | null
          paused_seconds?: number
          started_at?: string
          status?: Database["public"]["Enums"]["work_session_status"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_my_invitations: { Args: never; Returns: number }
      calc_ticket_charge: {
        Args: {
          _completed: string
          _event: string
          _labor: number
          _org: string
          _service: Database["public"]["Enums"]["service_type"]
          _started: string
          _ticket: string
        }
        Returns: number
      }
      calculate_bonuses: {
        Args: { _period_start: string; _program: string }
        Returns: number
      }
      can_view_event_status: { Args: { _event: string }; Returns: boolean }
      can_view_ticket: { Args: { _ticket: string }; Returns: boolean }
      can_work_ticket: { Args: { _ticket: string }; Returns: boolean }
      compute_ticket_charge: { Args: { _ticket: string }; Returns: number }
      create_call_in: {
        Args: {
          _class: string
          _event: string
          _exhibitor: string
          _key: string
          _location: string
          _notes: string
          _priority: Database["public"]["Enums"]["ticket_priority"]
          _service: Database["public"]["Enums"]["service_type"]
          _service_only: boolean
          _source: string
          _weight: number
        }
        Returns: string
      }
      create_my_organization: { Args: { _name: string }; Returns: string }
      delete_event: { Args: { _event: string }; Returns: undefined }
      dispatch_next_available: { Args: { _event: string }; Returns: undefined }
      dispatch_staged_crates: {
        Args: {
          _destination?: string
          _freight: string[]
          _notes?: string
          _priority?: Database["public"]["Enums"]["ticket_priority"]
        }
        Returns: string
      }
      driver_go_online: {
        Args: { _driver: string; _equipment: string; _event: string }
        Returns: string
      }
      driver_roster: {
        Args: { _event: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      ensure_incentive_defaults: { Args: { _org: string }; Returns: undefined }
      event_freight_status: {
        Args: { _event: string }
        Returns: {
          arrival_status: Database["public"]["Enums"]["arrival_status"]
          booth_number: string
          created_at: string
          description: string
          exhibitor_id: string
          exhibitor_name: string
          freight_code: string
          freight_id: string
        }[]
      }
      event_status_board: {
        Args: { _event: string }
        Returns: {
          booth_number: string
          exhibitor_name: string
          freight_delivered: number
          freight_received: number
          freight_total: number
          jobs_completed: number
          jobs_held: number
          jobs_open: number
          open_issues: number
        }[]
      }
      exhibitor_event_ids: { Args: never; Returns: string[] }
      fleet_release: { Args: never; Returns: undefined }
      fleet_select: { Args: { _equipment: string }; Returns: undefined }
      forklift_current: {
        Args: never
        Returns: {
          event_id: string
          full_name: string
          operator_id: string
        }[]
      }
      forklift_go_online: {
        Args: { _equipment: string; _event: string }
        Returns: string
      }
      forklift_lock: { Args: never; Returns: undefined }
      forklift_operators: {
        Args: { _event: string }
        Returns: {
          full_name: string
          has_pin: boolean
          id: string
        }[]
      }
      forklift_unlock: {
        Args: { _event: string; _operator: string; _pin: string }
        Returns: Json
      }
      freight_chain_of_custody: { Args: { _freight: string }; Returns: Json }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_org_role: {
        Args: { _org: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      incentive_score: {
        Args: {
          _acc: number
          _doc: number
          _ontime: number
          _prod: number
          _rel: number
          _wa: number
          _wd: number
          _wo: number
          _wp: number
          _wr: number
        }
        Returns: number
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
      manage_worker: {
        Args: {
          _first?: string
          _last?: string
          _org: string
          _remove?: boolean
          _worker?: string
        }
        Returns: string
      }
      mark_bonus_paid: {
        Args: { _bonus: string; _paid: boolean; _reference?: string }
        Returns: undefined
      }
      mark_ticket_paid: {
        Args: { _paid: boolean; _ticket: string }
        Returns: undefined
      }
      my_operator_ids: { Args: never; Returns: string[] }
      my_operator_on_ticket: { Args: { _ticket: string }; Returns: string }
      op_complete_call_in: {
        Args: { _notes?: string; _ticket: string }
        Returns: undefined
      }
      op_complete_session: { Args: { _session: string }; Returns: undefined }
      op_pause_session: {
        Args: { _reason: string; _session: string }
        Returns: undefined
      }
      op_resume_session: { Args: { _session: string }; Returns: undefined }
      op_scan_freight: {
        Args: {
          _action: string
          _booth_ok?: boolean
          _equipment?: string
          _flag?: string
          _note?: string
          _ticket: string
          _token: string
        }
        Returns: Json
      }
      op_start_session: {
        Args: { _equipment: string; _ticket: string }
        Returns: string
      }
      operator_complete_job: {
        Args: { _notes?: string; _ticket: string }
        Returns: undefined
      }
      operator_exhibitor_ids: { Args: never; Returns: string[] }
      operator_freight_ids: { Args: never; Returns: string[] }
      operator_performance: {
        Args: {
          _event: string
          _from: string
          _operator?: string
          _org: string
          _to: string
        }
        Returns: {
          accuracy: number
          active_hours: number
          avg_accept_min: number
          avg_gap_min: number
          avg_pickup_min: number
          avg_transit_min: number
          confirmation_pct: number
          crates_delivered: number
          delivery_accuracy_pct: number
          documentation: number
          exceptions_reported: number
          full_name: string
          jobs_completed: number
          on_time: number
          on_time_pct: number
          open_assignments: number
          operator_id: string
          org_work_days: number
          productivity: number
          reliability: number
          scan_compliance_pct: number
          score: number
          shifts: number
          source_ticket_ids: string[]
          weight_lbs: number
        }[]
      }
      operator_pin_status: {
        Args: never
        Returns: {
          has_pin: boolean
          operator_id: string
        }[]
      }
      operator_start_job: { Args: { _ticket: string }; Returns: undefined }
      operator_ticket_ids: { Args: never; Returns: string[] }
      org_entitlement: {
        Args: { _org: string }
        Returns: {
          ends_at: string
          event_limit: number
          plan: string
          source: string
        }[]
      }
      org_has_active_subscription: {
        Args: { _org: string; check_env?: string }
        Returns: boolean
      }
      queue_compatible: {
        Args: { _equipment: string; _ticket: string }
        Returns: boolean
      }
      queue_dispatch: { Args: { _event: string }; Returns: undefined }
      queue_poll: { Args: { _ready?: boolean }; Returns: string }
      receive_bill_of_lading: {
        Args: {
          _booth: string
          _carrier: string
          _consignee: string
          _crates: Json
          _declared_pieces: number
          _description: string
          _event: string
          _exhibitor: string
          _file_size: number
          _filename: string
          _intake_key: string
          _mime: string
          _pro: string
          _shipper: string
          _special: string
          _storage_path: string
          _total_weight: number
        }
        Returns: Json
      }
      reset_operator_pin: { Args: { _operator: string }; Returns: undefined }
      reset_org_drivers: { Args: { _org: string }; Returns: number }
      resolve_issue: { Args: { _update: string }; Returns: undefined }
      review_bonus: {
        Args: { _approve: boolean; _bonus: string; _note?: string }
        Returns: undefined
      }
      sandbox_reset_event: {
        Args: { _deep?: boolean; _event: string }
        Returns: Json
      }
      scan_freight_to_queue: { Args: { _token: string }; Returns: Json }
      session_hourly_rate: { Args: { _ticket: string }; Returns: number }
      session_hours: {
        Args: { s: Database["public"]["Tables"]["work_sessions"]["Row"] }
        Returns: number
      }
      set_ticket_hold: {
        Args: { _hold: boolean; _reason?: string; _ticket: string }
        Returns: undefined
      }
      staff_correct_scan: {
        Args: {
          _freight: string
          _reason: string
          _ticket: string
          _what: string
        }
        Returns: undefined
      }
      user_exhibitor_ids: { Args: never; Returns: string[] }
      user_operator_ids: { Args: never; Returns: string[] }
      viewer_events: {
        Args: never
        Returns: {
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          venue: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "company_admin"
        | "dispatcher"
        | "operator"
        | "exhibitor"
        | "venue"
        | "organizer"
      arrival_status:
        | "expected"
        | "received"
        | "in_storage"
        | "delivered_to_booth"
        | "outbound"
        | "shipped"
      delivery_update_kind:
        | "picked_up"
        | "in_transit"
        | "at_booth"
        | "delivered"
        | "exception"
        | "note"
        | "issue"
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
      work_session_status: "active" | "paused" | "completed"
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
        "venue",
        "organizer",
      ],
      arrival_status: [
        "expected",
        "received",
        "in_storage",
        "delivered_to_booth",
        "outbound",
        "shipped",
      ],
      delivery_update_kind: [
        "picked_up",
        "in_transit",
        "at_booth",
        "delivered",
        "exception",
        "note",
        "issue",
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
      work_session_status: ["active", "paused", "completed"],
    },
  },
} as const
