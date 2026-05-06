// Hand-rolled stub. Replace with `pnpm db:types` output once Supabase is running.
// Format mirrors `supabase gen types typescript` so supabase-js generics resolve correctly.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UserRole = "admin" | "couple";
type VenueStatus = "shortlisted" | "visited" | "quoted" | "decided" | "passed";
type IndoorOutdoor = "indoor" | "outdoor" | "both";
type PricingUnit = "per_guest" | "per_event" | "flat" | "per_hour" | "per_day";
type PricingTier = "basic" | "standard" | "premium";
type EventRole =
  | "mehndi"
  | "sangeet"
  | "welcome"
  | "haldi"
  | "ceremony"
  | "reception"
  | "wedding"
  | "stay";
type VenueDecisionKind = "shortlisted" | "visited" | "quoted" | "decided" | "passed" | "note";
type VenueQuestionStatus = "open" | "answered" | "wont_answer";
type RsvpStatus = "pending" | "yes" | "no" | "maybe";
type GuestSide = "groom" | "bride" | "both";

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          wedding_date: string | null;
          base_currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          wedding_date?: string | null;
          base_currency?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          wedding_date?: string | null;
          base_currency?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          org_id: string;
          workspace_id: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: UserRole;
          org_id: string;
          workspace_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          org_id?: string;
          workspace_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          workspace_id: string;
          org_id: string;
          name: string;
          address: string | null;
          geo_lat: number | null;
          geo_lng: number | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          hero_photo_url: string | null;
          capacity_min: number | null;
          capacity_max: number | null;
          indoor_outdoor: IndoorOutdoor | null;
          in_house_catering: boolean;
          has_accommodation: boolean;
          planner_notes: string | null;
          status: VenueStatus;
          event_roles: EventRole[];
          is_lead_pick: boolean;
          hire_fee_weekend_eur: number | null;
          hire_fee_weekday_eur: number | null;
          hire_fee_sunday_eur: number | null;
          minimum_pax_weekend: number | null;
          minimum_pax_sunday: number | null;
          minimum_pax_weekday: number | null;
          shortfall_per_pax_eur: number | null;
          extra_hour_eur: number | null;
          spaces: { label: string; price_eur: number }[];
          hire_fee_notes: string | null;
          pros: string[];
          cons: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          org_id: string;
          name: string;
          address?: string | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          hero_photo_url?: string | null;
          capacity_min?: number | null;
          capacity_max?: number | null;
          indoor_outdoor?: IndoorOutdoor | null;
          in_house_catering?: boolean;
          has_accommodation?: boolean;
          planner_notes?: string | null;
          status?: VenueStatus;
          event_roles?: EventRole[];
          is_lead_pick?: boolean;
          hire_fee_weekend_eur?: number | null;
          hire_fee_weekday_eur?: number | null;
          hire_fee_sunday_eur?: number | null;
          minimum_pax_weekend?: number | null;
          minimum_pax_sunday?: number | null;
          minimum_pax_weekday?: number | null;
          shortfall_per_pax_eur?: number | null;
          extra_hour_eur?: number | null;
          spaces?: { label: string; price_eur: number }[];
          hire_fee_notes?: string | null;
          pros?: string[];
          cons?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          org_id?: string;
          name?: string;
          address?: string | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          hero_photo_url?: string | null;
          capacity_min?: number | null;
          capacity_max?: number | null;
          indoor_outdoor?: IndoorOutdoor | null;
          in_house_catering?: boolean;
          has_accommodation?: boolean;
          planner_notes?: string | null;
          status?: VenueStatus;
          event_roles?: EventRole[];
          is_lead_pick?: boolean;
          hire_fee_weekend_eur?: number | null;
          hire_fee_weekday_eur?: number | null;
          hire_fee_sunday_eur?: number | null;
          minimum_pax_weekend?: number | null;
          minimum_pax_sunday?: number | null;
          minimum_pax_weekday?: number | null;
          shortfall_per_pax_eur?: number | null;
          extra_hour_eur?: number | null;
          spaces?: { label: string; price_eur: number }[];
          hire_fee_notes?: string | null;
          pros?: string[];
          cons?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venue_decisions: {
        Row: {
          id: string;
          venue_id: string;
          kind: VenueDecisionKind;
          body: string;
          decided_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          kind: VenueDecisionKind;
          body: string;
          decided_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          kind?: VenueDecisionKind;
          body?: string;
          decided_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      venue_questions: {
        Row: {
          id: string;
          venue_id: string;
          asked_by: string | null;
          body: string;
          answer: string | null;
          answered_by: string | null;
          answered_at: string | null;
          status: VenueQuestionStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          asked_by?: string | null;
          body: string;
          answer?: string | null;
          answered_by?: string | null;
          answered_at?: string | null;
          status?: VenueQuestionStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          asked_by?: string | null;
          body?: string;
          answer?: string | null;
          answered_by?: string | null;
          answered_at?: string | null;
          status?: VenueQuestionStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      guests: {
        Row: {
          id: string;
          workspace_id: string;
          org_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          side: GuestSide | null;
          relationship: string | null;
          household_id: string | null;
          is_household_head: boolean;
          address: string | null;
          city: string | null;
          region: string | null;
          postal_code: string | null;
          country: string | null;
          dietary: string | null;
          allergies: string | null;
          notes: string | null;
          overall_rsvp: RsvpStatus;
          added_by: string | null;
          imported_from: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          org_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          side?: GuestSide | null;
          relationship?: string | null;
          household_id?: string | null;
          is_household_head?: boolean;
          address?: string | null;
          city?: string | null;
          region?: string | null;
          postal_code?: string | null;
          country?: string | null;
          dietary?: string | null;
          allergies?: string | null;
          notes?: string | null;
          overall_rsvp?: RsvpStatus;
          added_by?: string | null;
          imported_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          workspace_id: string;
          org_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          side: GuestSide | null;
          relationship: string | null;
          household_id: string | null;
          is_household_head: boolean;
          address: string | null;
          city: string | null;
          region: string | null;
          postal_code: string | null;
          country: string | null;
          dietary: string | null;
          allergies: string | null;
          notes: string | null;
          overall_rsvp: RsvpStatus;
          added_by: string | null;
          imported_from: string | null;
        }>;
        Relationships: [];
      };
      guest_event_invitations: {
        Row: {
          id: string;
          guest_id: string;
          event_role: EventRole;
          is_invited: boolean;
          rsvp: RsvpStatus;
          table_assignment: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          guest_id: string;
          event_role: EventRole;
          is_invited?: boolean;
          rsvp?: RsvpStatus;
          table_assignment?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          guest_id: string;
          event_role: EventRole;
          is_invited: boolean;
          rsvp: RsvpStatus;
          table_assignment: string | null;
          notes: string | null;
        }>;
        Relationships: [];
      };
      guest_imports: {
        Row: {
          id: string;
          workspace_id: string;
          uploaded_by: string | null;
          source_filename: string | null;
          storage_path: string | null;
          source_kind: "excel" | "csv" | "paste";
          rows_total: number | null;
          rows_imported: number | null;
          rows_skipped: number | null;
          claude_model: string | null;
          claude_mapping: Json | null;
          claude_confidence: number | null;
          claude_request: Json | null;
          claude_response: Json | null;
          prompt_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          status: string;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          uploaded_by?: string | null;
          source_filename?: string | null;
          storage_path?: string | null;
          source_kind: "excel" | "csv" | "paste";
          rows_total?: number | null;
          rows_imported?: number | null;
          rows_skipped?: number | null;
          claude_model?: string | null;
          claude_mapping?: Json | null;
          claude_confidence?: number | null;
          claude_request?: Json | null;
          claude_response?: Json | null;
          prompt_tokens?: number | null;
          output_tokens?: number | null;
          cost_usd?: number | null;
          status?: string;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          status: string;
          rows_total: number | null;
          rows_imported: number | null;
          rows_skipped: number | null;
          claude_model: string | null;
          claude_mapping: Json | null;
          claude_confidence: number | null;
          claude_request: Json | null;
          claude_response: Json | null;
          prompt_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          error: string | null;
        }>;
        Relationships: [];
      };
      venue_visits: {
        Row: {
          id: string;
          venue_id: string;
          visit_date: string;
          attendees: string[] | null;
          walkthrough_notes: string | null;
          couple_rating: number | null;
          couple_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          visit_date: string;
          attendees?: string[] | null;
          walkthrough_notes?: string | null;
          couple_rating?: number | null;
          couple_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          visit_date?: string;
          attendees?: string[] | null;
          walkthrough_notes?: string | null;
          couple_rating?: number | null;
          couple_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      venue_photos: {
        Row: {
          id: string;
          venue_id: string;
          visit_id: string | null;
          url: string;
          caption: string | null;
          uploaded_by: string | null;
          taken_at: string | null;
          favorited_by: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          visit_id?: string | null;
          url: string;
          caption?: string | null;
          uploaded_by?: string | null;
          taken_at?: string | null;
          favorited_by?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          visit_id?: string | null;
          url?: string;
          caption?: string | null;
          uploaded_by?: string | null;
          taken_at?: string | null;
          favorited_by?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      venue_notes: {
        Row: {
          id: string;
          venue_id: string;
          author_id: string;
          body: string;
          pinned: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          author_id: string;
          body: string;
          pinned?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          author_id?: string;
          body?: string;
          pinned?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pricing_templates: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          version: number;
          currency_default: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          version?: number;
          currency_default?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          version?: number;
          currency_default?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pricing_categories: {
        Row: { id: string; template_id: string; label: string; sort_order: number };
        Insert: { id?: string; template_id: string; label: string; sort_order?: number };
        Update: { id?: string; template_id?: string; label?: string; sort_order?: number };
        Relationships: [];
      };
      pricing_line_items: {
        Row: {
          id: string;
          category_id: string;
          label: string;
          description: string | null;
          unit: PricingUnit;
          default_unit_price: number;
          currency: string;
          tier: PricingTier | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          category_id: string;
          label: string;
          description?: string | null;
          unit: PricingUnit;
          default_unit_price: number;
          currency?: string;
          tier?: PricingTier | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          category_id?: string;
          label?: string;
          description?: string | null;
          unit?: PricingUnit;
          default_unit_price?: number;
          currency?: string;
          tier?: PricingTier | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      venue_pricing: {
        Row: {
          id: string;
          venue_id: string;
          template_id: string;
          overrides: Json;
          last_synced_at: string | null;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          template_id: string;
          overrides?: Json;
          last_synced_at?: string | null;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          template_id?: string;
          overrides?: Json;
          last_synced_at?: string | null;
          source?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pricing_scenarios: {
        Row: {
          id: string;
          workspace_id: string;
          venue_id: string;
          name: string;
          inputs: Json;
          calculated_total: number;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          venue_id: string;
          name: string;
          inputs: Json;
          calculated_total: number;
          currency?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          venue_id?: string;
          name?: string;
          inputs?: Json;
          calculated_total?: number;
          currency?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      timeline_items: {
        Row: {
          id: string;
          workspace_id: string;
          org_id: string;
          event_role: EventRole;
          occurs_at: string | null;
          duration_minutes: number;
          what: string;
          who_responsible: string | null;
          location: string | null;
          vendor_id: string | null;
          notes: string | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          org_id: string;
          event_role: EventRole;
          occurs_at?: string | null;
          duration_minutes?: number;
          what: string;
          who_responsible?: string | null;
          location?: string | null;
          vendor_id?: string | null;
          notes?: string | null;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          org_id?: string;
          event_role?: EventRole;
          occurs_at?: string | null;
          duration_minutes?: number;
          what?: string;
          who_responsible?: string | null;
          location?: string | null;
          vendor_id?: string | null;
          notes?: string | null;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      venue_status: VenueStatus;
      indoor_outdoor: IndoorOutdoor;
      pricing_unit: PricingUnit;
      pricing_tier: PricingTier;
      event_role: EventRole;
      venue_decision_kind: VenueDecisionKind;
      venue_question_status: VenueQuestionStatus;
      rsvp_status: RsvpStatus;
      guest_side: GuestSide;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
