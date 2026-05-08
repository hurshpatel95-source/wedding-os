// 84-task wedding planning starter checklist for DIY couples (no planner).
// Phases approximately match the 12-month standard timeline. Each task has
// a `months_before` anchor — when wedding_date is set we compute due_date
// as wedding_date - months_before. When wedding_date is null we leave
// due_date null and the user sees an unanchored task list.

export interface StarterTask {
  phase: string;
  title: string;
  months_before: number;
  category?: string;
}

export const STARTER_CHECKLIST: StarterTask[] = [
  // ─── Foundation (12+ months out) ───────────────────────────────
  { phase: "Foundation", title: "Pick wedding date", months_before: 12 },
  { phase: "Foundation", title: "Set total budget", months_before: 12 },
  { phase: "Foundation", title: "Draft initial guest list (rough headcount)", months_before: 12 },
  { phase: "Foundation", title: "Pick wedding region / style", months_before: 12 },
  { phase: "Foundation", title: "Open joint planning email", months_before: 12 },
  { phase: "Foundation", title: "Tell parents and immediate family", months_before: 12 },

  // ─── Venue (10–12 months out) ──────────────────────────────────
  { phase: "Venue", title: "Shortlist 3–5 venues", months_before: 11 },
  { phase: "Venue", title: "Tour venues", months_before: 10 },
  { phase: "Venue", title: "Verify date availability", months_before: 10 },
  { phase: "Venue", title: "Negotiate venue contract terms", months_before: 9 },
  { phase: "Venue", title: "Sign venue contract", months_before: 9 },
  { phase: "Venue", title: "Pay venue deposit", months_before: 9 },

  // ─── Photo + video (9–10 months out) ───────────────────────────
  { phase: "Photo + video", title: "Research photographers", months_before: 9, category: "photo_video" },
  { phase: "Photo + video", title: "Tour 3+ photographer portfolios", months_before: 9, category: "photo_video" },
  { phase: "Photo + video", title: "Book photographer", months_before: 9, category: "photo_video" },
  { phase: "Photo + video", title: "Research videographers", months_before: 8, category: "photo_video" },
  { phase: "Photo + video", title: "Book videographer (if wanted)", months_before: 8, category: "photo_video" },
  { phase: "Photo + video", title: "Schedule engagement shoot", months_before: 8, category: "photo_video" },

  // ─── Food + drinks (8–9 months out) ────────────────────────────
  { phase: "Food + drinks", title: "Research caterers", months_before: 9, category: "catering" },
  { phase: "Food + drinks", title: "Schedule catering tasting", months_before: 8, category: "catering" },
  { phase: "Food + drinks", title: "Lock catering menu", months_before: 7, category: "catering" },
  { phase: "Food + drinks", title: "Book caterer", months_before: 8, category: "catering" },
  { phase: "Food + drinks", title: "Decide bar package (cash / open / signature)", months_before: 6, category: "bar" },
  { phase: "Food + drinks", title: "Book bartender (if not in-house)", months_before: 6, category: "bar" },

  // ─── Music + entertainment (7–8 months out) ────────────────────
  { phase: "Music + entertainment", title: "Decide DJ vs band", months_before: 8, category: "music" },
  { phase: "Music + entertainment", title: "Research DJs / bands", months_before: 7, category: "music" },
  { phase: "Music + entertainment", title: "Listen to demos / live samples", months_before: 7, category: "music" },
  { phase: "Music + entertainment", title: "Book DJ or band", months_before: 7, category: "music" },
  { phase: "Music + entertainment", title: "Pick ceremony music", months_before: 3, category: "music" },
  { phase: "Music + entertainment", title: "Build cocktail hour playlist", months_before: 2, category: "music" },
  { phase: "Music + entertainment", title: "Build reception playlist + must-plays", months_before: 1, category: "music" },

  // ─── Flowers + design (6–8 months out) ─────────────────────────
  { phase: "Flowers + design", title: "Research florists", months_before: 8, category: "flowers_decor" },
  { phase: "Flowers + design", title: "Build inspiration mood board", months_before: 7, category: "flowers_decor" },
  { phase: "Flowers + design", title: "Lock design palette", months_before: 6, category: "flowers_decor" },
  { phase: "Flowers + design", title: "Sign with florist", months_before: 6, category: "flowers_decor" },
  { phase: "Flowers + design", title: "Order specialty rentals (linens, lounge, etc.)", months_before: 4, category: "rentals" },

  // ─── Wedding party + attire (6–8 months out) ───────────────────
  { phase: "Wedding party + attire", title: "Choose wedding party", months_before: 8, category: "attire" },
  { phase: "Wedding party + attire", title: "Pick wedding dress", months_before: 8, category: "attire" },
  { phase: "Wedding party + attire", title: "Pick suit / tux", months_before: 6, category: "attire" },
  { phase: "Wedding party + attire", title: "Order bridesmaid dresses", months_before: 6, category: "attire" },
  { phase: "Wedding party + attire", title: "Order groomsmen attire", months_before: 5, category: "attire" },
  { phase: "Wedding party + attire", title: "Order parents' attire", months_before: 4, category: "attire" },

  // ─── Save-the-dates + invitations (6–7 months out) ─────────────
  { phase: "Save-the-dates + invitations", title: "Send save the dates", months_before: 7, category: "stationery" },
  { phase: "Save-the-dates + invitations", title: "Build wedding website", months_before: 7, category: "stationery" },
  { phase: "Save-the-dates + invitations", title: "Order invitations", months_before: 5, category: "stationery" },
  { phase: "Save-the-dates + invitations", title: "Set up RSVP system", months_before: 5, category: "stationery" },

  // ─── Logistics (4–6 months out) ────────────────────────────────
  { phase: "Logistics", title: "Book hotel block", months_before: 6, category: "transportation" },
  { phase: "Logistics", title: "Book transportation (shuttle / bus)", months_before: 4, category: "transportation" },
  { phase: "Logistics", title: "Plan rehearsal dinner", months_before: 4 },
  { phase: "Logistics", title: "Order cake / dessert", months_before: 4, category: "catering" },
  { phase: "Logistics", title: "Hire hair & makeup artist", months_before: 5, category: "hair_makeup" },
  { phase: "Logistics", title: "Schedule hair & makeup trial", months_before: 5, category: "hair_makeup" },
  { phase: "Logistics", title: "Book officiant", months_before: 6, category: "officiant" },
  { phase: "Logistics", title: "Decide ceremony order", months_before: 4, category: "officiant" },

  // ─── Stationery + paper goods (4–5 months out) ─────────────────
  { phase: "Stationery + paper goods", title: "Order ceremony programs", months_before: 4, category: "stationery" },
  { phase: "Stationery + paper goods", title: "Order menu cards", months_before: 4, category: "stationery" },
  { phase: "Stationery + paper goods", title: "Order seating cards / escort cards", months_before: 3, category: "stationery" },
  { phase: "Stationery + paper goods", title: "Order favors", months_before: 3, category: "favors" },

  // ─── Detail work (2–4 months out) ──────────────────────────────
  { phase: "Detail work", title: "Mail invitations", months_before: 3, category: "stationery" },
  { phase: "Detail work", title: "Schedule first dress fitting", months_before: 3, category: "attire" },
  { phase: "Detail work", title: "Book honeymoon", months_before: 3 },
  { phase: "Detail work", title: "Apply for marriage license", months_before: 2 },
  { phase: "Detail work", title: "Finalize day-of timeline", months_before: 2 },
  { phase: "Detail work", title: "Order welcome bags", months_before: 2, category: "welcome_bags" },
  { phase: "Detail work", title: "Write vows", months_before: 1 },
  { phase: "Detail work", title: "Choose first dance song", months_before: 2, category: "music" },

  // ─── Final stretch (1 month – 1 week out) ──────────────────────
  { phase: "Final stretch", title: "Final headcount to caterer", months_before: 1, category: "catering" },
  { phase: "Final stretch", title: "Build seating chart", months_before: 1 },
  { phase: "Final stretch", title: "Final dress fitting", months_before: 1, category: "attire" },
  { phase: "Final stretch", title: "Confirm vendor logistics + arrival times", months_before: 1 },
  { phase: "Final stretch", title: "Pay final balances to all vendors", months_before: 1 },
  { phase: "Final stretch", title: "Pack for honeymoon", months_before: 1 },
  { phase: "Final stretch", title: "Buy day-of emergency kit", months_before: 1 },
  { phase: "Final stretch", title: "Write thank-you notes for showers / pre-events", months_before: 1 },

  // ─── Wedding week ──────────────────────────────────────────────
  { phase: "Wedding week", title: "Drop off marriage license", months_before: 0 },
  { phase: "Wedding week", title: "Final phone calls with vendors", months_before: 0 },
  { phase: "Wedding week", title: "Rehearsal", months_before: 0 },
  { phase: "Wedding week", title: "Rehearsal dinner", months_before: 0 },
  { phase: "Wedding week", title: "Wedding day", months_before: 0 },
  { phase: "Wedding week", title: "Honeymoon", months_before: 0 },

  // ─── After ─────────────────────────────────────────────────────
  { phase: "After", title: "Thank-you cards", months_before: 0 },
  { phase: "After", title: "Vendor reviews", months_before: 0 },
  { phase: "After", title: "Photo album curation", months_before: 0 },
  { phase: "After", title: "Change name (if applicable)", months_before: 0 },
];
