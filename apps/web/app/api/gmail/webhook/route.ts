import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/gmail/webhook
// Public Pub/Sub push endpoint for Gmail watch() notifications.
//
// Pub/Sub sends a JSON envelope:
//   { message: { data: <base64 of {emailAddress, historyId}>, messageId, publishTime, attributes }, subscription }
//
// Stub for now: log the payload and ack with 204 so Pub/Sub doesn't retry.
// Eventually: decode the email, look up the gmail_connections row by
// email, and trigger a sync. Wired up on a follow-up task.
export async function POST(request: NextRequest) {
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    // ignore
  }

  let parsed: unknown = null;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    // ignore — log raw
  }

  // Minimal observability — printed to Railway logs for debugging.
  // eslint-disable-next-line no-console
  console.log("[gmail-webhook] received", {
    hasBody: bodyText.length > 0,
    parsedShape:
      parsed && typeof parsed === "object"
        ? Object.keys(parsed as Record<string, unknown>)
        : null,
  });

  // 204 No Content — Pub/Sub treats 2xx as ack.
  return new NextResponse(null, { status: 204 });
}

// Pub/Sub does not require GET, but some setups use a verification GET
// to make sure the endpoint is reachable. Return 200 OK.
export async function GET() {
  return NextResponse.json({ ok: true, service: "gmail-webhook" });
}
