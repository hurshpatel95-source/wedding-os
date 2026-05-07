import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isUuid(params.token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const sb = adminClient();

  const { data: prop } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; status: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("proposals")
    .select("id, status")
    .eq("public_token", params.token)
    .maybeSingle();

  if (!prop) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (prop.status === "accepted") {
    return NextResponse.json({ ok: true, already: true });
  }
  if (prop.status !== "sent" && prop.status !== "viewed") {
    return NextResponse.json(
      { error: `cannot accept a ${prop.status} proposal` },
      { status: 409 },
    );
  }

  const { error } = await (
    sb as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .from("proposals")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", prop.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
