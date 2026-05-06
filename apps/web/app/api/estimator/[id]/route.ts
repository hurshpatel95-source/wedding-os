import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EstimateDocument } from "@/lib/estimator-types";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    sections?: EstimateDocument;
    name?: string;
  };

  if (!body.sections && !body.name) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // Light validation: must have version & sections array
  if (body.sections) {
    if (
      typeof body.sections !== "object" ||
      !Array.isArray((body.sections as EstimateDocument).sections)
    ) {
      return NextResponse.json(
        { error: "sections must be { version, sections: [] }" },
        { status: 400 },
      );
    }
  }

  const patch: { sections?: unknown; name?: string } = {};
  if (body.sections) patch.sections = body.sections;
  if (body.name) patch.name = body.name;

  const { error } = await supabase
    .from("budget_estimates")
    .update(patch as never)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
