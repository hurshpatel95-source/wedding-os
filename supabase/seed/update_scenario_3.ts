// Update existing Scenario 3 row to the Sept 11/12 lead option per Hursh.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

const sb = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: row } = await sb
    .from("pricing_scenarios")
    .select("id, inputs")
    .ilike("name", "Scenario 3%")
    .maybeSingle();

  if (!row) {
    console.error("! Scenario 3 not found");
    process.exit(1);
  }

  const inputs = row.inputs as Record<string, unknown>;
  const events = (inputs.events ?? []) as Array<Record<string, unknown>>;

  const newInputs = {
    ...inputs,
    description:
      "Sangeet @ Casa Del Mar (Sat 9/11) → Wedding @ Mas Sant Llei (Sun 9/12, whole venue) → Stay @ ME Barcelona. Sun MSL minimum is 220 → no shortfall at 220 guests.",
    date_range: { from: "2027-09-10", to: "2027-09-13" },
    events: events.map((e) => {
      if (e.key === "sangeet") {
        return { ...e, day: "weekend", date: "2027-09-11", label: "Sangeet — Casa Del Mar" };
      }
      if (e.key === "wedding") {
        return { ...e, day: "sunday", date: "2027-09-12", label: "Wedding — Mas Sant Llei (whole venue)" };
      }
      return e;
    }),
    open_items: [
      "Lead option: Sangeet Sat 9/11 @ Casa Del Mar + Wedding Sun 9/12 @ MSL whole venue.",
      "Casa Del Mar Sept 11 — confirm availability; deck listed Sept 4, 5, 17 (not 11).",
      "MSL Sunday min 220 → no shortfall at 220 guests (vs €4,800 shortfall on Saturday).",
      "Casa Del Mar (Sitges) ↔ MSL (Vilanova del Vallès) ≈ 1hr drive — coach transport recommended.",
    ],
  };

  const { error } = await sb
    .from("pricing_scenarios")
    .update({
      name: "Scenario 3 — Hybrid (Sept 11/12)",
      inputs: newInputs as never,
    })
    .eq("id", row.id);

  if (error) {
    console.error("! update failed:", error.message);
    process.exit(1);
  }
  console.log("✓ Scenario 3 updated to Sept 11 (Sat) Sangeet + Sept 12 (Sun) Wedding");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
