import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/wave2-types";

export const runtime = "nodejs";

const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60;

type LooseSb = {
  from: (t: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{
          data: DocumentRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.org_role !== "org_admin" || !profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = supabase as unknown as LooseSb;
  const { data: doc } = await sb
    .from("documents")
    .select(
      "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (doc.org_id !== profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: doc.name,
    });
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "could not sign url" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
