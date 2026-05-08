// Pure functions for rendering the daily digest email. Kept template-only
// (no Supabase/IO imports) so they can be unit-tested in isolation and
// reused by future channels (Slack/SMS) that want the same copy.

import type { AlertRow, AlertSeverity } from "@/lib/autopilot-types";

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  urgent: "Needs your attention",
  warn: "Heads up",
  success: "Wins",
  info: "Updates",
};

const SEVERITY_ORDER: AlertSeverity[] = ["urgent", "warn", "success", "info"];

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  urgent: "[!]",
  warn: "[~]",
  success: "[+]",
  info: "[i]",
};

export function renderDigestSubject(
  workspaceName: string,
  alertCount: number,
): string {
  const noun = alertCount === 1 ? "update" : "updates";
  // Keep the workspace name out of the subject line by default — most
  // couples have a single workspace and the recipient already knows what
  // wedding it is. We include it only as a postfix when there are multiple.
  const _ = workspaceName; // kept for future per-workspace tagging
  return `Today on wedding-os: ${alertCount} ${noun}`;
}

interface DigestBody {
  text: string;
  html: string;
}

export function renderDigestBody(
  workspaceName: string,
  alerts: AlertRow[],
  baseUrl: string,
): DigestBody {
  const grouped = groupBySeverity(alerts);
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const ctaUrl = `${cleanBase}/autopilot`;

  // ─── plain text ────────────────────────────────────────────────────
  const textLines: string[] = [];
  textLines.push(`Hi ${workspaceName || "there"} —`);
  textLines.push("");
  textLines.push(
    `Here's what your wedding-os autopilot picked up over the last 24 hours.`,
  );
  textLines.push("");

  for (const sev of SEVERITY_ORDER) {
    const items = grouped[sev];
    if (!items || items.length === 0) continue;
    textLines.push(`-- ${SEVERITY_LABEL[sev]} --`);
    for (const a of items) {
      textLines.push(`${SEVERITY_EMOJI[sev]} ${a.title}`);
      if (a.body) {
        const excerpt = truncate(stripMarkdown(a.body), 240);
        textLines.push(`   ${excerpt}`);
      }
      if (a.action_url) {
        const link = absolutize(a.action_url, cleanBase);
        textLines.push(`   Open: ${link}`);
      }
      textLines.push("");
    }
  }

  textLines.push(`View all updates → ${ctaUrl}`);
  textLines.push("");
  textLines.push(
    "You can mute these in Settings → Notifications inside wedding-os.",
  );
  const text = textLines.join("\n");

  // ─── HTML ──────────────────────────────────────────────────────────
  const htmlSections: string[] = [];
  for (const sev of SEVERITY_ORDER) {
    const items = grouped[sev];
    if (!items || items.length === 0) continue;
    const rows = items
      .map((a) => {
        const dot = severityDot(sev);
        const titleEsc = escapeHtml(a.title);
        const bodyEsc = a.body
          ? `<div style="margin-top:6px;color:#52525b;font-size:14px;line-height:1.5;">${escapeHtml(
              truncate(stripMarkdown(a.body), 240),
            )}</div>`
          : "";
        const link = a.action_url
          ? `<div style="margin-top:8px;"><a href="${escapeAttr(
              absolutize(a.action_url, cleanBase),
            )}" style="color:#9d174d;text-decoration:none;font-weight:500;font-size:14px;">Open →</a></div>`
          : "";
        return `<tr><td style="padding:12px 0;border-bottom:1px solid #f4f4f5;">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-top:7px;flex-shrink:0;"></span>
            <div style="flex:1;">
              <div style="font-weight:600;color:#18181b;font-size:15px;line-height:1.4;">${titleEsc}</div>
              ${bodyEsc}
              ${link}
            </div>
          </div>
        </td></tr>`;
      })
      .join("");
    htmlSections.push(
      `<div style="margin-top:24px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">${escapeHtml(
          SEVERITY_LABEL[sev],
        )}</div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px;">${rows}</table>
      </div>`,
    );
  }

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#9d174d;">wedding-os autopilot</div>
      <h1 style="margin:8px 0 0 0;font-size:22px;color:#18181b;font-weight:700;">Hi ${escapeHtml(workspaceName || "there")} —</h1>
      <p style="color:#52525b;font-size:15px;line-height:1.6;margin-top:12px;">Here's what your autopilot picked up over the last 24 hours. Tap anything below to jump in.</p>
      ${htmlSections.join("")}
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e4e4e7;">
        <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:#9d174d;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:500;font-size:14px;">View all updates →</a>
      </div>
      <p style="margin-top:24px;color:#a1a1aa;font-size:12px;line-height:1.5;">You can mute these in Settings → Notifications inside wedding-os.</p>
    </div>
  </body>
</html>`;

  return { text, html };
}

// ─── helpers ─────────────────────────────────────────────────────────

function groupBySeverity(alerts: AlertRow[]): Record<AlertSeverity, AlertRow[]> {
  const out: Record<AlertSeverity, AlertRow[]> = {
    urgent: [],
    warn: [],
    success: [],
    info: [],
  };
  for (const a of alerts) {
    const bucket = out[a.severity] ?? out.info;
    bucket.push(a);
  }
  return out;
}

function severityDot(sev: AlertSeverity): string {
  switch (sev) {
    case "urgent":
      return "#dc2626";
    case "warn":
      return "#d97706";
    case "success":
      return "#059669";
    default:
      return "#3b82f6";
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function stripMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/[*_`#>]+/g, "")                // bold/italic/code/heading
    .replace(/\n+/g, " ")
    .trim();
}

function absolutize(url: string, base: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
