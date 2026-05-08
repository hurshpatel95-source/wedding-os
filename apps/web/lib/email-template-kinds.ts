// Allowed `kind` values for the saved email-template library
// (`email_templates` table). Distinct from the AI prompt-template
// catalogue in /lib/email-templates.ts — these are the categories
// the planner picks from when saving a hand-written email so it can
// be re-found later.

export const EMAIL_TEMPLATE_LIBRARY_KINDS = [
  "vendor_rfp",
  "vendor_followup",
  "guest_save_the_date",
  "guest_rsvp_nudge",
  "guest_update",
  "contract_followup",
  "custom",
] as const;

export type EmailTemplateLibraryKind =
  (typeof EMAIL_TEMPLATE_LIBRARY_KINDS)[number];

export const EMAIL_TEMPLATE_KIND_LABEL: Record<
  EmailTemplateLibraryKind,
  string
> = {
  vendor_rfp: "Vendor RFP",
  vendor_followup: "Vendor follow-up",
  guest_save_the_date: "Save the date",
  guest_rsvp_nudge: "RSVP nudge",
  guest_update: "Guest update",
  contract_followup: "Contract follow-up",
  custom: "Custom",
};

export function isEmailTemplateLibraryKind(
  v: unknown,
): v is EmailTemplateLibraryKind {
  return (
    typeof v === "string" &&
    (EMAIL_TEMPLATE_LIBRARY_KINDS as readonly string[]).includes(v)
  );
}

// Tokens supported in template subject + body. Replaced per-recipient
// when a template is dropped into the composer (or sent as a campaign
// later). The composer side just inserts the literal token text — final
// substitution happens at send time.
export const EMAIL_TEMPLATE_TOKENS = [
  "{first_name}",
  "{couple_names}",
  "{planner_name}",
  "{studio_name}",
  "{wedding_date}",
] as const;

export interface EmailTemplateTokenValues {
  first_name?: string;
  couple_names?: string;
  planner_name?: string;
  studio_name?: string;
  wedding_date?: string;
}

/**
 * Replace {token} occurrences with the supplied values. Missing values
 * fall back to a friendly placeholder so the preview pane never shows
 * an empty hole.
 */
export function substituteTemplateTokens(
  text: string,
  vars: EmailTemplateTokenValues,
  fallback: "placeholder" | "blank" = "placeholder",
): string {
  const fb = (label: string) =>
    fallback === "placeholder" ? `[${label}]` : "";
  return text
    .split("{first_name}")
    .join(vars.first_name ?? fb("guest first name"))
    .split("{couple_names}")
    .join(vars.couple_names ?? fb("couple names"))
    .split("{planner_name}")
    .join(vars.planner_name ?? fb("your name"))
    .split("{studio_name}")
    .join(vars.studio_name ?? fb("studio name"))
    .split("{wedding_date}")
    .join(vars.wedding_date ?? fb("wedding date"));
}
