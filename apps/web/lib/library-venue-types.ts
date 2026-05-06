import type { Database } from "@wedding-os/db";

export type LibraryVenue = Database["public"]["Tables"]["library_venues"]["Row"];
export type LibraryVenueInsert =
  Database["public"]["Tables"]["library_venues"]["Insert"];
export type LibraryVenueUpdate =
  Database["public"]["Tables"]["library_venues"]["Update"];

export type LibraryVenueMedia =
  Database["public"]["Tables"]["library_venue_media"]["Row"];
export type LibraryVenueMediaKind = "photo" | "video";

export const LIBRARY_MEDIA_BUCKET = "library-media";

// Shape of the editable form, separate from the database row so we can ferry
// number inputs as strings between the form and the API.
export interface LibraryVenueFormPayload {
  name: string;
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
  event_roles: Database["public"]["Enums"]["event_role"][];
  pros: string[];
  cons: string[];
  description: string | null;
  internal_notes: string | null;
}

// Brochure-intake AI shape — Sonnet returns these fields as a tool call.
export interface LibraryVenueBrochureExtraction {
  name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  capacity_seated: number | null;
  capacity_standing: number | null;
  hire_fee_eur: number | null;
  hire_fee_notes: string | null;
  description: string | null;
  event_roles: Database["public"]["Enums"]["event_role"][];
  confidence: number;
  notes: string | null;
}
