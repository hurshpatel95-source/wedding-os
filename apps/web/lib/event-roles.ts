import type { Database } from "@wedding-os/db";

type EventRole = Database["public"]["Enums"]["event_role"];

export const EVENT_ROLES: EventRole[] = [
  "mehndi",
  "sangeet",
  "haldi",
  "welcome",
  "ceremony",
  "reception",
  "wedding",
  "stay",
];

export const EVENT_ROLE_LABEL: Record<EventRole, string> = {
  mehndi: "Mehndi",
  sangeet: "Sangeet",
  haldi: "Haldi",
  welcome: "Welcome / cocktail",
  ceremony: "Ceremony",
  reception: "Reception",
  wedding: "Wedding (full)",
  stay: "Stay only",
};

// short labels for compact badges
export const EVENT_ROLE_SHORT: Record<EventRole, string> = {
  mehndi: "Mehndi",
  sangeet: "Sangeet",
  haldi: "Haldi",
  welcome: "Welcome",
  ceremony: "Ceremony",
  reception: "Reception",
  wedding: "Wedding",
  stay: "Stay",
};
