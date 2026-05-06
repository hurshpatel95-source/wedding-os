import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { anthropicReady, getAnthropic, DEFAULT_INTAKE_MODEL, estimateCost } from "@/lib/anthropic";
import type {
  GuestImportField,
  ImportPreview,
  NormalizedRow,
  GuestSide,
} from "@/lib/guest-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PREVIEW_ROWS = 12;

// Tool schema Claude must follow when mapping columns.
const COLUMN_MAPPING_TOOL: Anthropic.Tool = {
  name: "map_guest_columns",
  description:
    "Map a guest-list spreadsheet to wedding-os fields and emit normalized row data. " +
    "Use null when a field isn't in the source.",
  input_schema: {
    type: "object",
    required: ["column_mapping", "rows", "confidence"],
    properties: {
      column_mapping: {
        type: "object",
        description: "Map of wedding-os field → source column header (or null if not present).",
        properties: {
          full_name: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          side: { type: ["string", "null"] },
          relationship: { type: ["string", "null"] },
          address: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          region: { type: ["string", "null"] },
          postal_code: { type: ["string", "null"] },
          country: { type: ["string", "null"] },
          dietary: { type: ["string", "null"] },
          allergies: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rows: {
        type: "array",
        description: "Normalized rows in the same order as the input. Use null for missing fields.",
        items: {
          type: "object",
          required: ["full_name"],
          properties: {
            full_name: { type: "string" },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            side: { type: ["string", "null"], enum: ["groom", "bride", "both", null] },
            relationship: { type: ["string", "null"] },
            address: { type: ["string", "null"] },
            city: { type: ["string", "null"] },
            region: { type: ["string", "null"] },
            postal_code: { type: ["string", "null"] },
            country: { type: ["string", "null"] },
            dietary: { type: ["string", "null"] },
            allergies: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            warnings: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You map raw spreadsheet rows from a wedding planner's guest list into wedding-os's structured guest fields.

Rules:
- Combine first/last name columns into 'full_name' (e.g. "Aarav Patel"). If only one column exists, use it.
- 'side' must be one of: 'groom', 'bride', 'both', or null. Map any "Hursh side", "groom side", "G", "groom's family", "Hursh's side" → 'groom'. Same logic for bride. Default to null when unclear.
- 'phone' should be normalized to E.164 if obviously possible, otherwise pass through verbatim.
- 'relationship' should be a short label ("uncle", "college friend", "father").
- 'address' is the street line; split out city / region / postal_code / country if you can.
- 'dietary' captures "vegetarian", "jain", "halal", "no alcohol", etc. — combine into a comma-separated string.
- 'allergies' is for severe ones ("nut allergy"); soft preferences go in dietary or notes.
- Skip rows where you cannot construct a 'full_name'.
- Add a 'warnings' array on a row when you had to guess (e.g. "phone format unclear").
- Confidence reflects mapping quality across the whole sheet, 0-1.`;

function detectSide(raw: unknown): GuestSide | null {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase();
  if (
    v.includes("groom") ||
    v === "g" ||
    v.includes("hursh")
  )
    return "groom";
  if (v.includes("bride") || v === "b" || v.includes("nisha")) return "bride";
  if (v.includes("both") || v === "couple") return "both";
  return null;
}

// Fallback (no Claude): heuristic column mapping based on header names.
function heuristicMap(header: string[], rows: Record<string, unknown>[]): {
  mapping: Partial<Record<GuestImportField, string>>;
  rows: NormalizedRow[];
} {
  const lower = header.map((h) => String(h ?? "").trim());
  const find = (...patterns: RegExp[]) =>
    lower.find((h) => patterns.some((p) => p.test(h.toLowerCase()))) ?? undefined;

  const mapping: Partial<Record<GuestImportField, string>> = {};
  mapping.full_name =
    find(/^name$/, /full.*name/, /guest.*name/) ?? lower[0];
  mapping.email = find(/^e?-?mail/, /email/);
  mapping.phone = find(/phone/, /mobile/, /^cell/, /tel/);
  mapping.side = find(/^side/, /groom|bride|family/);
  mapping.relationship = find(/relationship|relation/);
  mapping.address = find(/address/, /street/);
  mapping.city = find(/city|town/);
  mapping.region = find(/state|region|province/);
  mapping.postal_code = find(/zip|postal|postcode/);
  mapping.country = find(/country/);
  mapping.dietary = find(/diet|meal|food.*pref/);
  mapping.allergies = find(/allerg/);
  mapping.notes = find(/notes?|comment/);

  const firstName = find(/first.*name|^first$|fname/);
  const lastName = find(/last.*name|^last$|^surname$|lname/);

  const out: NormalizedRow[] = [];
  for (const r of rows) {
    let fullName = mapping.full_name ? String(r[mapping.full_name] ?? "").trim() : "";
    if (!fullName && firstName && lastName) {
      fullName = `${String(r[firstName] ?? "")} ${String(r[lastName] ?? "")}`.trim();
    } else if (!fullName && firstName) {
      fullName = String(r[firstName] ?? "").trim();
    }
    if (!fullName) continue;

    const sideRaw = mapping.side ? r[mapping.side] : null;
    out.push({
      full_name: fullName,
      email: mapping.email ? String(r[mapping.email] ?? "").trim() || null : null,
      phone: mapping.phone ? String(r[mapping.phone] ?? "").trim() || null : null,
      side: detectSide(sideRaw),
      relationship: mapping.relationship
        ? String(r[mapping.relationship] ?? "").trim() || null
        : null,
      address: mapping.address ? String(r[mapping.address] ?? "").trim() || null : null,
      city: mapping.city ? String(r[mapping.city] ?? "").trim() || null : null,
      region: mapping.region ? String(r[mapping.region] ?? "").trim() || null : null,
      postal_code: mapping.postal_code
        ? String(r[mapping.postal_code] ?? "").trim() || null
        : null,
      country: mapping.country ? String(r[mapping.country] ?? "").trim() || null : null,
      dietary: mapping.dietary ? String(r[mapping.dietary] ?? "").trim() || null : null,
      allergies: mapping.allergies ? String(r[mapping.allergies] ?? "").trim() || null : null,
      notes: mapping.notes ? String(r[mapping.notes] ?? "").trim() || null : null,
      confidence: 0.5,
    });
  }
  return { mapping, rows: out };
}

// Call Claude to produce a column mapping + normalized rows.
async function claudeMap(
  header: string[],
  rows: Record<string, unknown>[],
): Promise<{
  mapping: Partial<Record<GuestImportField, string>>;
  rows: NormalizedRow[];
  confidence: number;
  cost_usd: number;
  prompt_tokens: number;
  output_tokens: number;
  raw_response: unknown;
}> {
  const anthropic = getAnthropic();

  // Send the header + up to 30 rows for column inference. The actual full
  // import processes all rows on the client-confirmed mapping in /commit.
  const sample = rows.slice(0, 30);

  const userText = [
    `Header row: ${JSON.stringify(header)}`,
    `Sample data rows (${sample.length}):`,
    JSON.stringify(sample),
  ].join("\n\n");

  const resp = await anthropic.messages.create({
    model: DEFAULT_INTAKE_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tool_choice: { type: "tool", name: COLUMN_MAPPING_TOOL.name },
    tools: [COLUMN_MAPPING_TOOL],
    messages: [{ role: "user", content: userText }],
  });

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }
  const out = toolBlock.input as {
    column_mapping: Record<string, string | null>;
    confidence: number;
    rows: NormalizedRow[];
  };

  const mapping: Partial<Record<GuestImportField, string>> = {};
  for (const [k, v] of Object.entries(out.column_mapping)) {
    if (typeof v === "string" && v.length > 0) {
      mapping[k as GuestImportField] = v;
    }
  }

  const inT = resp.usage?.input_tokens ?? 0;
  const outT = resp.usage?.output_tokens ?? 0;

  return {
    mapping,
    rows: out.rows,
    confidence: out.confidence ?? 0.7,
    cost_usd: estimateCost(inT, outT),
    prompt_tokens: inT,
    output_tokens: outT,
    raw_response: out,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // role + workspace
  const { data: profile } = await supabase
    .from("users")
    .select("role, workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "missing file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  const isCSV = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");

  // Parse with xlsx — handles both .xlsx and .csv
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch (err) {
    return NextResponse.json({ error: `Failed to read file: ${(err as Error).message}` }, { status: 400 });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ error: "Workbook has no sheets" }, { status: 400 });
  }
  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (rows.length === 0) {
    return NextResponse.json({ error: "Sheet has no data rows" }, { status: 400 });
  }
  const header = Object.keys(rows[0]!);

  // Persist the uploaded file privately + create the import audit row
  const objectKey = `${profile.workspace_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await supabase.storage.from("guest-imports").upload(objectKey, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  const { data: importRow, error: importErr } = await supabase
    .from("guest_imports")
    .insert({
      workspace_id: profile.workspace_id,
      uploaded_by: user.id,
      source_filename: file.name,
      storage_path: objectKey,
      source_kind: isCSV ? "csv" : "excel",
      rows_total: rows.length,
      status: "pending",
    })
    .select()
    .single();
  if (importErr || !importRow) {
    return NextResponse.json(
      { error: `Failed to record import: ${importErr?.message}` },
      { status: 500 },
    );
  }

  // Try Claude first; fall back to heuristic mapping if not configured / fails.
  let mapping: Partial<Record<GuestImportField, string>>;
  let normalized: NormalizedRow[];
  let claudeUsed = false;
  let claudeConfidence: number | undefined;
  let costUsd: number | undefined;

  if (anthropicReady) {
    try {
      const r = await claudeMap(header, rows);
      mapping = r.mapping;
      normalized = r.rows;
      claudeUsed = true;
      claudeConfidence = r.confidence;
      costUsd = r.cost_usd;

      await supabase
        .from("guest_imports")
        .update({
          status: "parsed",
          claude_model: DEFAULT_INTAKE_MODEL,
          claude_mapping: mapping as never,
          claude_confidence: r.confidence,
          claude_response: r.raw_response as never,
          prompt_tokens: r.prompt_tokens,
          output_tokens: r.output_tokens,
          cost_usd: r.cost_usd,
        })
        .eq("id", importRow.id);
    } catch (err) {
      console.error("Claude mapping failed, falling back:", err);
      const fb = heuristicMap(header, rows);
      mapping = fb.mapping;
      normalized = fb.rows;
      await supabase
        .from("guest_imports")
        .update({
          status: "parsed",
          claude_mapping: mapping as never,
          error: `Claude failed: ${(err as Error).message} — used heuristic fallback`,
        })
        .eq("id", importRow.id);
    }
  } else {
    const fb = heuristicMap(header, rows);
    mapping = fb.mapping;
    normalized = fb.rows;
    await supabase
      .from("guest_imports")
      .update({
        status: "parsed",
        claude_mapping: mapping as never,
        error: "ANTHROPIC_API_KEY not set — used heuristic fallback",
      })
      .eq("id", importRow.id);
  }

  const preview: ImportPreview = {
    import_id: importRow.id,
    source_filename: file.name,
    source_kind: isCSV ? "csv" : "excel",
    rows_total: rows.length,
    header_row: header,
    column_mapping: mapping,
    rows: normalized,
    raw_sample: rows.slice(0, MAX_PREVIEW_ROWS),
    claude_used: claudeUsed,
    claude_confidence: claudeConfidence,
    cost_usd: costUsd,
  };

  return NextResponse.json(preview);
}
