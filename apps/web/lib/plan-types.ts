import type { Database } from "@wedding-os/db";

export type TaskStatus = Database["public"]["Tables"]["planning_tasks"]["Row"]["status"];
export type TaskPhase = Database["public"]["Tables"]["planning_tasks"]["Row"]["phase"];
export type TaskOwner = Database["public"]["Tables"]["planning_tasks"]["Row"]["owner"];
export type TaskCategory = Database["public"]["Tables"]["planning_tasks"]["Row"]["category"];

export const PHASE_ORDER: TaskPhase[] = [
  "pre_12_months",
  "months_9_12",
  "months_6_9",
  "months_3_6",
  "months_1_3",
  "final_month",
  "final_week",
  "day_of",
  "post_wedding",
];

export const PHASE_LABEL: Record<TaskPhase, string> = {
  pre_12_months: "12+ months out",
  months_9_12: "9–12 months out",
  months_6_9: "6–9 months out",
  months_3_6: "3–6 months out",
  months_1_3: "1–3 months out",
  final_month: "Final month",
  final_week: "Final week",
  day_of: "Day of",
  post_wedding: "After the wedding",
};

export const PHASE_SUBTITLE: Record<TaskPhase, string> = {
  pre_12_months: "Lock the foundation — dates, budget, planner, big-ticket vendors",
  months_9_12: "Book the heavy hitters before they sell out",
  months_6_9: "Cultural + personal layer — pandit, MUA, mehndi, outfits begin",
  months_3_6: "Final selections, RSVPs, fittings, paperwork",
  months_1_3: "Counting down — headcount, seating, vows, payments",
  final_month: "Every last detail confirmed",
  final_week: "Mehndi, sangeet, pithi/haldi rituals",
  day_of: "Showtime — ceremony, reception, first dance",
  post_wedding: "Marriage cert, thank-yous, honeymoon, prints",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  na: "Skipped",
};

export const STATUS_VARIANT: Record<
  TaskStatus,
  "muted" | "warning" | "destructive" | "success" | "secondary"
> = {
  not_started: "muted",
  in_progress: "warning",
  blocked: "destructive",
  done: "success",
  na: "secondary",
};

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  venue: "Venue",
  vendor: "Vendor",
  attire: "Attire",
  paperwork: "Paperwork",
  guest: "Guests",
  logistics: "Logistics",
  design: "Design",
  ritual: "Ritual",
  finance: "Finance",
  honeymoon: "Honeymoon",
  other: "Other",
};

export const OWNER_LABEL: Record<TaskOwner, string> = {
  couple: "Couple",
  planner: "Astha",
  groom: "Hursh",
  bride: "Nisha",
  family: "Family",
  vendor: "Vendor",
};
