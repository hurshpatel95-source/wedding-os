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
export type OrgRole = "org_admin" | "member";
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
type AiRole = "user" | "assistant";
type IntakeSourceKind = "image" | "pdf" | "text" | "whatsapp_export";
type IntakeStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "partial"
  | "failed"
  | "applied"
  | "archived";
type IntakeProposalKind = "default_price" | "override" | "new_line_item";
type ProposalDecision = "pending" | "accepted" | "edited" | "rejected" | "needs_info";
type ChangeActorKind = "user" | "ai_intake" | "excel_import" | "seed" | "manual_admin";
type ChangeTarget =
  | "default_price"
  | "override_price"
  | "override_included"
  | "override_notes"
  | "new_line_item";
type TaskStatus = "not_started" | "in_progress" | "blocked" | "done" | "na";
type TaskPhase =
  | "pre_12_months"
  | "months_9_12"
  | "months_6_9"
  | "months_3_6"
  | "months_1_3"
  | "final_month"
  | "final_week"
  | "day_of"
  | "post_wedding";
type TaskOwner = "couple" | "planner" | "groom" | "bride" | "family" | "vendor";
type TaskCategory =
  | "venue"
  | "vendor"
  | "attire"
  | "paperwork"
  | "guest"
  | "logistics"
  | "design"
  | "ritual"
  | "finance"
  | "honeymoon"
  | "other";
type VenueDateStatus =
  | "available"
  | "tentative"
  | "held_by_us"
  | "booked_by_us"
  | "unavailable"
  | "unknown";

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
          org_role: OrgRole;
          org_id: string;
          workspace_id: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: UserRole;
          org_role?: OrgRole;
          org_id: string;
          workspace_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          org_role?: OrgRole;
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
      pricing_intake_sources: {
        Row: {
          id: string;
          org_id: string;
          workspace_id: string;
          template_id: string;
          venue_id: string | null;
          uploaded_by: string;
          kind: IntakeSourceKind;
          status: IntakeStatus;
          storage_path: string | null;
          mime_type: string | null;
          byte_size: number | null;
          raw_text: string | null;
          source_label: string | null;
          source_dated_at: string | null;
          model: string | null;
          claude_response: Json | null;
          prompt_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          workspace_id: string;
          template_id: string;
          venue_id?: string | null;
          uploaded_by: string;
          kind: IntakeSourceKind;
          status?: IntakeStatus;
          storage_path?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          raw_text?: string | null;
          source_label?: string | null;
          source_dated_at?: string | null;
          model?: string | null;
          claude_response?: Json | null;
          prompt_tokens?: number | null;
          output_tokens?: number | null;
          cost_usd?: number | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          status: IntakeStatus;
          model: string | null;
          claude_response: Json | null;
          prompt_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          error: string | null;
        }>;
        Relationships: [];
      };
      pricing_intake_proposals: {
        Row: {
          id: string;
          source_id: string;
          kind: IntakeProposalKind;
          matched_line_item_id: string | null;
          proposed_category: string | null;
          proposed_label: string | null;
          proposed_description: string | null;
          proposed_unit: PricingUnit | null;
          proposed_tier: PricingTier | null;
          proposed_unit_price: number | null;
          proposed_currency: string | null;
          proposed_included: boolean | null;
          proposed_notes: string | null;
          confidence: number;
          rationale: string | null;
          evidence: Json | null;
          needs_info: string | null;
          decision: ProposalDecision;
          decided_by: string | null;
          decided_at: string | null;
          applied_change_log_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          kind: IntakeProposalKind;
          matched_line_item_id?: string | null;
          proposed_category?: string | null;
          proposed_label?: string | null;
          proposed_description?: string | null;
          proposed_unit?: PricingUnit | null;
          proposed_tier?: PricingTier | null;
          proposed_unit_price?: number | null;
          proposed_currency?: string | null;
          proposed_included?: boolean | null;
          proposed_notes?: string | null;
          confidence: number;
          rationale?: string | null;
          evidence?: Json | null;
          needs_info?: string | null;
          decision?: ProposalDecision;
          decided_by?: string | null;
          decided_at?: string | null;
          applied_change_log_id?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          decision: ProposalDecision;
          decided_by: string | null;
          decided_at: string | null;
          applied_change_log_id: string | null;
        }>;
        Relationships: [];
      };
      pricing_change_log: {
        Row: {
          id: string;
          org_id: string;
          workspace_id: string | null;
          template_id: string;
          line_item_id: string | null;
          venue_id: string | null;
          target: ChangeTarget;
          old_value: Json | null;
          new_value: Json | null;
          actor_kind: ChangeActorKind;
          actor_user_id: string | null;
          source_id: string | null;
          proposal_id: string | null;
          evidence: Json | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          workspace_id?: string | null;
          template_id: string;
          line_item_id?: string | null;
          venue_id?: string | null;
          target: ChangeTarget;
          old_value?: Json | null;
          new_value?: Json | null;
          actor_kind: ChangeActorKind;
          actor_user_id?: string | null;
          source_id?: string | null;
          proposal_id?: string | null;
          evidence?: Json | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          note: string | null;
        }>;
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          title: string | null;
        }>;
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: AiRole;
          content: string;
          model: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          cache_read_tokens: number | null;
          cache_creation_tokens: number | null;
          cost_usd: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: AiRole;
          content: string;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          cache_read_tokens?: number | null;
          cache_creation_tokens?: number | null;
          cost_usd?: number | null;
          created_at?: string;
        };
        Update: Partial<{
          content: string;
        }>;
        Relationships: [];
      };
      ai_usage_daily: {
        Row: {
          workspace_id: string;
          user_id: string;
          day: string;
          message_count: number;
          total_cost_usd: number;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          day: string;
          message_count?: number;
          total_cost_usd?: number;
        };
        Update: Partial<{
          message_count: number;
          total_cost_usd: number;
        }>;
        Relationships: [];
      };
      planning_tasks: {
        Row: {
          id: string;
          workspace_id: string;
          org_id: string;
          category: TaskCategory;
          phase: TaskPhase;
          phase_id: string | null;
          is_user_added: boolean;
          sort_order: number;
          title: string;
          description: string | null;
          status: TaskStatus;
          owner: TaskOwner;
          months_before: number | null;
          due_date: string | null;
          auto_derive_kind: string | null;
          notes: string | null;
          done_at: string | null;
          done_by: string | null;
          related_kind: string | null;
          related_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          org_id: string;
          category: TaskCategory;
          phase: TaskPhase;
          phase_id?: string | null;
          is_user_added?: boolean;
          sort_order?: number;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          owner?: TaskOwner;
          months_before?: number | null;
          due_date?: string | null;
          auto_derive_kind?: string | null;
          notes?: string | null;
          done_at?: string | null;
          done_by?: string | null;
          related_kind?: string | null;
          related_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          category: TaskCategory;
          phase: TaskPhase;
          phase_id: string | null;
          is_user_added: boolean;
          sort_order: number;
          title: string;
          description: string | null;
          status: TaskStatus;
          owner: TaskOwner;
          months_before: number | null;
          due_date: string | null;
          auto_derive_kind: string | null;
          notes: string | null;
          done_at: string | null;
          done_by: string | null;
          related_kind: string | null;
          related_id: string | null;
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
      venue_date_marks: {
        Row: {
          id: string;
          workspace_id: string;
          venue_id: string;
          date: string;
          status: VenueDateStatus;
          notes: string | null;
          source: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          venue_id: string;
          date: string;
          status?: VenueDateStatus;
          notes?: string | null;
          source?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          venue_id?: string;
          date?: string;
          status?: VenueDateStatus;
          notes?: string | null;
          source?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_estimates: {
        Row: {
          id: string;
          org_id: string;
          workspace_id: string;
          name: string;
          source_label: string | null;
          scenario_summary: string | null;
          cover_emoji: string | null;
          guest_count: number | null;
          start_date: string | null;
          end_date: string | null;
          sections: unknown;
          baseline_total_eur: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          workspace_id: string;
          name: string;
          source_label?: string | null;
          scenario_summary?: string | null;
          cover_emoji?: string | null;
          guest_count?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          sections: unknown;
          baseline_total_eur?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          workspace_id?: string;
          name?: string;
          source_label?: string | null;
          scenario_summary?: string | null;
          cover_emoji?: string | null;
          guest_count?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          sections?: unknown;
          baseline_total_eur?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      library_venues: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          slug: string | null;
          address: string | null;
          city: string | null;
          region: string | null;
          country: string | null;
          lat: number | null;
          lng: number | null;
          capacity_seated: number | null;
          capacity_standing: number | null;
          hire_fee_eur: number | null;
          hire_fee_notes: string | null;
          spaces: unknown;
          event_roles: EventRole[];
          pros: string[];
          cons: string[];
          description: string | null;
          internal_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          slug?: string | null;
          address?: string | null;
          city?: string | null;
          region?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          capacity_seated?: number | null;
          capacity_standing?: number | null;
          hire_fee_eur?: number | null;
          hire_fee_notes?: string | null;
          spaces?: unknown;
          event_roles?: EventRole[];
          pros?: string[];
          cons?: string[];
          description?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          org_id: string;
          name: string;
          slug: string | null;
          address: string | null;
          city: string | null;
          region: string | null;
          country: string | null;
          lat: number | null;
          lng: number | null;
          capacity_seated: number | null;
          capacity_standing: number | null;
          hire_fee_eur: number | null;
          hire_fee_notes: string | null;
          spaces: unknown;
          event_roles: EventRole[];
          pros: string[];
          cons: string[];
          description: string | null;
          internal_notes: string | null;
          created_by: string | null;
        }>;
        Relationships: [];
      };
      library_venue_media: {
        Row: {
          id: string;
          library_venue_id: string;
          kind: "photo" | "video";
          storage_path: string | null;
          sort_order: number;
          alt: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          library_venue_id: string;
          kind: "photo" | "video";
          storage_path?: string | null;
          sort_order?: number;
          alt?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          library_venue_id: string;
          kind: "photo" | "video";
          storage_path: string | null;
          sort_order: number;
          alt: string | null;
        }>;
        Relationships: [];
      };
      library_vendors: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          category: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          default_quoted_price_eur: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          category: string;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          default_quoted_price_eur?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          org_id: string;
          name: string;
          category: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          default_quoted_price_eur: number | null;
          notes: string | null;
        }>;
        Relationships: [];
      };
      playbook_phases: {
        Row: {
          id: string;
          org_id: string;
          label: string;
          sort_order: number;
          anchor_kind: string | null;
          anchor_value_int: number | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          label: string;
          sort_order?: number;
          anchor_kind?: string | null;
          anchor_value_int?: number | null;
        };
        Update: Partial<{
          org_id: string;
          label: string;
          sort_order: number;
          anchor_kind: string | null;
          anchor_value_int: number | null;
        }>;
        Relationships: [];
      };
      playbook_tasks: {
        Row: {
          id: string;
          playbook_phase_id: string;
          title: string;
          description: string | null;
          owner_default: string | null;
          category: string | null;
          sort_order: number;
          auto_derive_kind: string | null;
        };
        Insert: {
          id?: string;
          playbook_phase_id: string;
          title: string;
          description?: string | null;
          owner_default?: string | null;
          category?: string | null;
          sort_order?: number;
          auto_derive_kind?: string | null;
        };
        Update: Partial<{
          playbook_phase_id: string;
          title: string;
          description: string | null;
          owner_default: string | null;
          category: string | null;
          sort_order: number;
          auto_derive_kind: string | null;
        }>;
        Relationships: [];
      };
      workspace_branding: {
        Row: {
          workspace_id: string;
          accent_hex: string;
          logo_storage_path: string | null;
          planner_display_name: string | null;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          accent_hex?: string;
          logo_storage_path?: string | null;
          planner_display_name?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          accent_hex: string;
          logo_storage_path: string | null;
          planner_display_name: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      org_role: OrgRole;
      venue_status: VenueStatus;
      indoor_outdoor: IndoorOutdoor;
      pricing_unit: PricingUnit;
      pricing_tier: PricingTier;
      event_role: EventRole;
      venue_decision_kind: VenueDecisionKind;
      venue_question_status: VenueQuestionStatus;
      rsvp_status: RsvpStatus;
      guest_side: GuestSide;
      venue_date_status: VenueDateStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
