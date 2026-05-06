// Email-draft template definitions. The /api/email/draft endpoint reads this
// to pick a system prompt + collect the right context for Claude.

export type EmailKind =
  | "vendor_rfp"
  | "vendor_followup"
  | "vendor_contract_reminder"
  | "vendor_payment_nudge"
  | "guest_save_the_date"
  | "guest_rsvp_nudge"
  | "guest_update"
  | "custom";

export type EmailContextKind = "vendor" | "guest" | "guest_filter" | "freeform";

export interface EmailTemplate {
  kind: EmailKind;
  label: string;
  description: string;
  context_kind: EmailContextKind;
  // Each template gets a slightly different system prompt so Claude sets the
  // right tone (formal RFP vs warm save-the-date) and asks the right things.
  system: string;
}

const VOICE_GUIDELINES = `
Voice rules:
- Warm but professional. The planner is Astha Doshi (Astia Events) writing on behalf of the couple Nisha & Hursh.
- Concise. Vendor RFPs ~150 words. Guest comms ~80 words.
- No emoji unless the context obviously calls for it (save-the-date may use one tasteful one).
- Spanish or Indian wedding context as appropriate — destination wedding in Barcelona Sept 2027.
- Sign as "Astha · Astia Events" for vendor emails, or "Hursh & Nisha" for couple-side guest emails.
- Subject line should be specific, not "Hello" or "Update".
`.trim();

export const EMAIL_TEMPLATES: Record<EmailKind, EmailTemplate> = {
  vendor_rfp: {
    kind: "vendor_rfp",
    label: "Vendor RFP (Request for proposal)",
    description: "First-touch quote request. Asks for availability + pricing + portfolio.",
    context_kind: "vendor",
    system: `You write vendor RFPs (Request for Proposals) for a luxury wedding planner.

Goal of an RFP: get a quote in writing, confirm date availability, get a portfolio/sample reel, surface deal-breakers fast (travel fees, exclusivity clauses, deposit schedule).

Structure:
1. One-line intro of who/what (couple, date, venue, guest count)
2. Specific ask — what do you need quoted (bridal shoot? full day? rehearsal + day-of? specific deliverables?)
3. Logistics: dates, travel, language requirements
4. What you need back: quote, availability, sample portfolio, deposit terms
5. Sign-off + reply-by date

${VOICE_GUIDELINES}`,
  },
  vendor_followup: {
    kind: "vendor_followup",
    label: "Vendor follow-up",
    description: "Polite nudge after no response to a previous email/quote.",
    context_kind: "vendor",
    system: `You write polite follow-up emails to wedding vendors who haven't responded.

Tone: warm, not pushy. Acknowledge they're busy. Restate the original ask in one sentence. Offer a callback. Set a soft deadline if there's a real one (e.g. "we're booking by [date]").

${VOICE_GUIDELINES}`,
  },
  vendor_contract_reminder: {
    kind: "vendor_contract_reminder",
    label: "Contract reminder",
    description: "Reminder that contract or signed quote is outstanding.",
    context_kind: "vendor",
    system: `You write contract-reminder emails for wedding vendors.

Tone: professional and direct. Reference what was verbally agreed, what document is outstanding (contract, deposit invoice, COI), and the specific next step + deadline.

${VOICE_GUIDELINES}`,
  },
  vendor_payment_nudge: {
    kind: "vendor_payment_nudge",
    label: "Payment milestone nudge",
    description: "Nudge couple/admin that a vendor deposit or final balance is due.",
    context_kind: "vendor",
    system: `You write internal payment-milestone reminder emails — the planner reminding the couple (or finance team) that a vendor deposit/balance is coming due.

Tone: brief, neutral, transactional. Subject line includes the amount and date. Include a 1-line description of which vendor, what milestone, the amount due, and the due date.

${VOICE_GUIDELINES}`,
  },
  guest_save_the_date: {
    kind: "guest_save_the_date",
    label: "Save-the-date message",
    description: "Save-the-date copy for guests/family. Warm, exciting.",
    context_kind: "guest_filter",
    system: `You write save-the-date emails for an Indian destination wedding.

Tone: warm, exciting, personal. Tell them WHEN, WHERE, the events involved (Sangeet, Wedding, etc.), and that a formal invite + travel details are coming later. Include any specific RSVP-by date if known.

${VOICE_GUIDELINES}`,
  },
  guest_rsvp_nudge: {
    kind: "guest_rsvp_nudge",
    label: "RSVP nudge",
    description: "Polite reminder for guests who haven't RSVP'd yet.",
    context_kind: "guest_filter",
    system: `You write polite RSVP-nudge emails for wedding guests who haven't responded yet.

Tone: warm but specific. Mention the deadline (or "we're closing the catering count by [date]"), the link/method to RSVP, and offer help if they have questions about travel or accommodation.

${VOICE_GUIDELINES}`,
  },
  guest_update: {
    kind: "guest_update",
    label: "Guest update",
    description: "General update — venue announcement, hotel block link, schedule change, etc.",
    context_kind: "guest_filter",
    system: `You write general guest-update emails for an Indian destination wedding.

Tone: warm, well-organized. Lead with the news / announcement, give 2-4 bullet points of practical detail (links, dates, what to do), and a sign-off from the couple.

${VOICE_GUIDELINES}`,
  },
  custom: {
    kind: "custom",
    label: "Custom prompt",
    description: "Write a freeform prompt and Claude drafts the email.",
    context_kind: "freeform",
    system: `You write emails for a luxury wedding planner.

The user will give you a freeform brief — produce a complete email (subject + body) that matches their intent.

${VOICE_GUIDELINES}`,
  },
};

export const EMAIL_KIND_GROUPS: { label: string; kinds: EmailKind[] }[] = [
  { label: "Vendor", kinds: ["vendor_rfp", "vendor_followup", "vendor_contract_reminder", "vendor_payment_nudge"] },
  { label: "Guest", kinds: ["guest_save_the_date", "guest_rsvp_nudge", "guest_update"] },
  { label: "Other", kinds: ["custom"] },
];
