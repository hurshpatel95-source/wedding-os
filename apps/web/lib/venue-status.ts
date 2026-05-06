import type { Database } from "@wedding-os/db";

type VenueStatus = Database["public"]["Enums"]["venue_status"];

export const VENUE_STATUSES: VenueStatus[] = [
  "shortlisted",
  "visited",
  "quoted",
  "decided",
  "passed",
];

export const STATUS_LABEL: Record<VenueStatus, string> = {
  shortlisted: "Shortlisted",
  visited: "Visited",
  quoted: "Quoted",
  decided: "Decided",
  passed: "Passed",
};

export const STATUS_VARIANT: Record<VenueStatus, "default" | "muted" | "success" | "warning"> = {
  shortlisted: "muted",
  visited: "default",
  quoted: "warning",
  decided: "success",
  passed: "muted",
};
