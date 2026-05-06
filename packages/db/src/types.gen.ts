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
          created_at?: string;
          updated_at?: string;
        };
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
    };
    CompositeTypes: { [_ in never]: never };
  };
};
