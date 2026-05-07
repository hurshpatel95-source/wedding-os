// Shared types/data for the planner onboarding wizard at /admin/welcome.
//
// Imported by both the wizard UI components and the wizard API routes so
// the starter-venue catalog stays in one place.

export interface StarterVenue {
  id: string;
  name: string;
  region: string;
  city: string;
  country: string;
  capacity_min: number;
  capacity_max: number;
  description: string;
  pros: string[];
  cons: string[];
}

export const STARTER_VENUES: StarterVenue[] = [
  {
    id: "destination-villa",
    name: "Destination Villa",
    region: "Costa Brava",
    city: "Begur",
    country: "Spain",
    capacity_min: 60,
    capacity_max: 180,
    description:
      "A private cliff-top villa with sea-view terraces, a courtyard for ceremony, and indoor reception space. Sleeps wedding party on-site.",
    pros: [
      "Multi-day weekend feel",
      "Stunning ceremony backdrop",
      "Sleeps 18+ on-site",
    ],
    cons: [
      "No on-site catering — outside vendor required",
      "Difficult last-mile transport for guests",
    ],
  },
  {
    id: "beachfront-resort",
    name: "Beachfront Resort",
    region: "Sitges",
    city: "Sitges",
    country: "Spain",
    capacity_min: 100,
    capacity_max: 300,
    description:
      "Five-star beachfront resort with a glass-walled ballroom, private beach for ceremony, and a 90-room block for guests.",
    pros: [
      "Full-service in-house catering",
      "Easy guest logistics",
      "Photo-ready beach setup",
    ],
    cons: ["Inflexible vendor list", "Higher per-guest minimum"],
  },
  {
    id: "rustic-masia",
    name: "Rustic Masia",
    region: "Penedès",
    city: "Vilafranca del Penedès",
    country: "Spain",
    capacity_min: 80,
    capacity_max: 220,
    description:
      "Working wine estate set in 200 hectares of vineyards. Stone barn for reception, outdoor ceremony aisle through the vines.",
    pros: [
      "Iconic Catalan setting",
      "On-site wine pairings",
      "Indoor + outdoor flexibility",
    ],
    cons: [
      "1-hour transfer from Barcelona airport",
      "Limited rain plan for ceremony",
    ],
  },
  {
    id: "rooftop-terrace",
    name: "Rooftop Terrace",
    region: "Barcelona",
    city: "Barcelona",
    country: "Spain",
    capacity_min: 50,
    capacity_max: 150,
    description:
      "Eighteenth-floor private rooftop in Eixample with unbroken Sagrada Família views. Perfect for intimate elopement-style weddings.",
    pros: [
      "No transport needed for city-center guests",
      "Iconic skyline backdrop",
      "Intimate scale",
    ],
    cons: [
      "Hard 80-pax cap due to fire code",
      "Wind can be a problem on top floor",
    ],
  },
  {
    id: "private-yacht",
    name: "Private Yacht Charter",
    region: "Marina Port Vell",
    city: "Barcelona",
    country: "Spain",
    capacity_min: 20,
    capacity_max: 80,
    description:
      "Crewed sailing yacht for half-day or full-day charter. Sunset ceremony at sea, return to harbor for dinner ashore.",
    pros: [
      "Once-in-a-lifetime experience",
      "Built-in entertainment for guests",
      "Stunning photos",
    ],
    cons: ["Hard guest cap (80 max)", "Weather contingency required"],
  },
];

export const STARTER_VENUE_BY_ID = new Map(
  STARTER_VENUES.map((v) => [v.id, v]),
);

export interface WelcomeState {
  // Has the public booking page been published?
  bookingPublished: boolean;
  // Number of library_venues rows in this org.
  librarySize: number;
  // Has any playbook_phase been created (i.e. has a playbook been "started")?
  playbookSeeded: boolean;
  // Has at least one workspace beyond the auto-created Sandbox been created?
  hasFirstClient: boolean;
  // The org's id and current name (we pre-fill brand step from here)
  orgId: string;
  orgName: string;
  // Current contact details + tagline so we can pre-fill the brand step.
  contactEmail: string | null;
  contactPhone: string | null;
  publicTagline: string | null;
  publicSlug: string | null;
  publicBrandMd: string | null;
}

// Five wizard steps in order. Used by the page to interpret ?step= and by
// the wizard component to render the progress bar.
export const WELCOME_STEPS = [
  { id: 1, key: "brand", label: "Brand" },
  { id: 2, key: "library", label: "Library" },
  { id: 3, key: "playbook", label: "Playbook" },
  { id: 4, key: "booking", label: "Booking page" },
  { id: 5, key: "first-client", label: "First client" },
] as const;

export type WelcomeStepId = (typeof WELCOME_STEPS)[number]["id"];

// Determine which step the wizard should land on based on the org's current
// state. We always advance to the FIRST unfinished step so a planner who
// closes the tab and comes back later picks up where they left off.
export function deriveStartingStep(state: WelcomeState): WelcomeStepId {
  if (!state.publicTagline && !state.publicBrandMd && !state.contactEmail) {
    return 1;
  }
  if (state.librarySize === 0) return 2;
  if (!state.playbookSeeded) return 3;
  if (!state.bookingPublished) return 4;
  if (!state.hasFirstClient) return 5;
  return 5;
}
